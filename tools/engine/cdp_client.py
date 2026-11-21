"""Attach to the browser that is already open. Never start one.

The studio has no login and does not want one. The machine that has the accounts — Gemini,
ChatGPT, whatever gets an adapter later — exposes its browser over the DevTools protocol, usually
through a reverse tunnel onto ``127.0.0.1:9222``. Everything here follows from that:

* ``connect_over_cdp`` only. There is no code path that launches Chromium, downloads a browser,
  or writes a profile.
* The **existing** context is used, because that is where the sessions live. A fresh context
  would be a logged-out browser wearing the user's face.
* A task gets **its own tab**, and only that tab is ever closed — on success, on timeout, on
  error, on Ctrl-C. Tabs that already existed when we attached are counted and never touched,
  never read, never re-navigated.
* Before a page is driven at all, its host is checked against the adapter's allow-list. The
  connected browser is a real signed-in one, so "type this and read that" is limited to the
  platform the adapter was written for.

    from tools.engine.cdp_client import CDP

    with CDP.open() as cdp:                       # $CDP_ENDPOINT, --cdp-url, or :9222
        with cdp.tab("https://gemini.google.com/app", hosts=("gemini.google.com",)) as tab:
            tab.page.goto(...)                    # …the task, then the tab closes itself

``probe()`` is separate on purpose: an HTTP GET on ``/json/version`` tells you in half a second
whether the tunnel is up, which is a much better error than a Playwright stack trace.
"""
from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Iterable, Optional

if __package__ in (None, ""):  # allow `python3 tools/engine/cdp_client.py`
    sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parents[2]))
    __package__ = "tools.engine"

from tools.engine import log  # noqa: E402

DEFAULT_ENDPOINT = "http://127.0.0.1:9222"


class CDPError(RuntimeError):
    """Anything that stops the run before a task can be attempted."""


class Unavailable(CDPError):
    """The endpoint is not there: tunnel down, port not forwarded, browser not started with
    ``--remote-debugging-port``. Exit code 5 — an environment problem, not a task problem."""


class Offsite(CDPError):
    """The tab ended up somewhere the adapter is not allowed to speak to."""


def resolve(endpoint: Optional[str] = None) -> str:
    """``--cdp-url`` beats ``$CDP_ENDPOINT`` beats ``$CDP_HOST`` beats localhost:9222.

    ``CDP_HOST`` is accepted because ``tools/drive.mjs`` and ``tools/shots.mjs`` already use that
    name in this repo, and they write it as ``127.0.0.1:9222`` — a bare host:port. Both shapes
    work from both tools.
    """
    raw = (endpoint or os.environ.get("CDP_ENDPOINT") or os.environ.get("CDP_HOST") or DEFAULT_ENDPOINT).strip()
    if not raw:
        raw = DEFAULT_ENDPOINT
    if "://" not in raw:
        raw = "http://" + raw
    return raw.rstrip("/")


def probe(endpoint: Optional[str] = None, timeout: float = 4.0) -> dict:
    """Ask the DevTools endpoint who it is. Raises ``Unavailable`` with a sentence a human can act on."""
    url = resolve(endpoint) + "/json/version"
    try:
        with urllib.request.urlopen(url, timeout=timeout) as r:  # noqa: S310 - fixed local endpoint
            data = json.loads(r.read().decode("utf-8", "replace"))
    except Exception as e:
        raise Unavailable(
            f"nothing answering at {url} ({type(e).__name__}: {e}). "
            "Is the tunnel up, and is the browser started with --remote-debugging-port?"
        ) from e
    if not isinstance(data, dict) or "Browser" not in data:
        raise Unavailable(f"{url} answered, but not with a DevTools version document")
    return data


class Tab:
    """One tab we opened, and the promise that it goes away."""

    def __init__(self, cdp: "CDP", page, url: str, hosts: Iterable[str] = ()):
        self.cdp, self.page, self.url = cdp, page, url
        self.opened_at = time.time()
        self._closed = False
        if hosts:
            self.assert_host(hosts)

    @property
    def host(self) -> str:
        try:
            return urllib.parse.urlparse(self.page.url or "").hostname or ""
        except Exception:
            return ""

    def assert_host(self, hosts: Iterable[str]) -> None:
        allowed = [h.lstrip(".").lower() for h in hosts if h]
        if not allowed:
            return
        host = self.host.lower()
        if not host or not any(host == h or host.endswith("." + h) for h in allowed):
            raise Offsite(
                f"refusing to drive {host or '(blank page)'} — this adapter only speaks to "
                + ", ".join(allowed)
                + ". (The connected browser is a real signed-in one; the guard is the point.)"
            )

    def close(self) -> None:
        if self._closed:
            return
        self._closed = True
        self.cdp._release(self)

    def __enter__(self) -> "Tab":
        return self

    def __exit__(self, *exc) -> bool:
        self.close()  # success, timeout or traceback — the tab does not outlive the task
        return False


class CDP:
    """The connection. Use it as a context manager; it disconnects on the way out."""

    def __init__(self, endpoint: Optional[str] = None, timeout: float = 30.0, keep_tab: bool = False):
        self.endpoint = resolve(endpoint)
        self.timeout = timeout
        self.keep_tab = keep_tab
        self.version = "?"
        self.tabs_opened = 0
        self.operator_tabs = 0
        self._pw = None
        self._browser = None
        self._ctx = None
        self._owned: list = []

    # ------------------------------------------------------------------ lifecycle
    @classmethod
    def open(cls, endpoint: Optional[str] = None, timeout: float = 30.0, keep_tab: bool = False) -> "CDP":
        cdp = cls(endpoint, timeout=timeout, keep_tab=keep_tab)
        cdp._start()
        return cdp

    def _start(self) -> "CDP":
        try:
            from playwright.sync_api import sync_playwright
        except ImportError as e:
            raise CDPError(
                "playwright isn't importable:  pip install playwright  — and that is all; "
                "no `playwright install` is needed because nothing here launches a browser"
            ) from e
        info = probe(self.endpoint, timeout=min(8.0, max(3.0, self.timeout / 3)))
        self.version = str(info.get("Browser", "?"))
        log(f"attached to {self.version} at {self.endpoint}")
        self._pw = sync_playwright().start()
        try:
            self._browser = self._pw.chromium.connect_over_cdp(self.endpoint, timeout=int(self.timeout * 1000))
        except Exception as e:
            self._stop()
            raise Unavailable(f"{self.endpoint} is answering but Playwright could not attach: {e}") from e
        if not self._browser.contexts:
            self._stop()
            raise CDPError("the connected browser reports no context — is a window actually open, not just the process?")
        self._ctx = self._browser.contexts[0]  # the operator's own context: where the logins are
        self.operator_tabs = len(self._ctx.pages)
        log(f"using the existing context; {self.operator_tabs} operator tab(s) left untouched")
        return self

    def _stop(self) -> None:
        for attr in ("_browser", "_pw"):
            obj = getattr(self, attr, None)
            if obj is None:
                continue
            try:
                obj.close() if attr == "_browser" else obj.stop()
            except Exception:
                pass
            setattr(self, attr, None)

    def close(self) -> None:
        """Close the tabs we opened, then drop the connection. Never quits the browser: over CDP
        ``browser.close()`` disconnects, and the operator's windows are none the wiser."""
        for tab in list(getattr(self, "_tabs", []) or []):
            try:
                tab.close()
            except Exception:
                pass
        for page in list(self._owned):
            try:
                if not page.is_closed():
                    page.close(run_before_unload=False)
            except Exception:
                pass
        self._owned.clear()
        self._stop()

    def __enter__(self) -> "CDP":
        self._tabs = []
        return self

    def __exit__(self, *exc) -> bool:
        self.close()
        return False

    # ------------------------------------------------------------------------ tabs
    def tab(self, url: str, hosts: Iterable[str] = ()) -> Tab:
        """Open a tab for this task only. On any failure before it is handed back, it is closed."""
        if self._ctx is None:
            raise CDPError("not connected")
        page = self._ctx.new_page()
        self._owned.append(page)
        self.tabs_opened += 1
        tab = Tab.__new__(Tab)
        try:
            tab.cdp, tab.page, tab.url = self, page, url
            tab.opened_at = time.time()
            tab._closed = False
            page.goto(url, wait_until="domcontentloaded", timeout=int(self.timeout * 1000))
            tab.assert_host(tuple(hosts or ()))
        except Exception:
            tab.close()
            raise
        self._tabs = getattr(self, "_tabs", []) + [tab]
        if self.keep_tab:
            log(f"tab kept open at {page.url} (--keep-tab)")
        return tab

    def _release(self, tab: Tab) -> None:
        if self.keep_tab:
            return
        page = tab.page
        try:
            if page in self._owned:
                self._owned.remove(page)
            if not page.is_closed():
                page.close(run_before_unload=False)
            log(f"tab closed after {time.time() - tab.opened_at:.1f}s")
        except Exception as e:
            log(f"tab close failed ({type(e).__name__}) — leaving it alone rather than touching the browser")

    # -------------------------------------------------------------------- reporting
    def status(self) -> dict:
        return {
            "endpoint": self.endpoint,
            "browser": self.version,
            "operator_tabs": self.operator_tabs,
            "tabs_opened": self.tabs_opened,
            "tabs_still_ours": len(self._owned),
        }


def _cli(argv=None) -> int:
    """``python3 -m tools.engine.cdp_client [--cdp-url …]`` — just the handshake, printed."""
    import argparse

    ap = argparse.ArgumentParser(description="Check the CDP tunnel without driving anything.")
    ap.add_argument("--cdp-url", default=None, help=f"default {DEFAULT_ENDPOINT}, or $CDP_ENDPOINT")
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args(argv)
    try:
        info = probe(a.cdp_url)
    except CDPError as e:
        print(f"[ERROR] {e}", file=sys.stderr)
        return 5
    out = {"ok": True, **info}
    print(json.dumps(out, ensure_ascii=False, indent=2 if a.json else None))
    return 0


if __name__ == "__main__":
    sys.exit(_cli())
