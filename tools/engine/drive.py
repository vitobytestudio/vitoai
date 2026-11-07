"""The mechanics every platform adapter needs, so that none of them invents its own.

Three problems, solved once here:

1. **Finding something that may not exist.** These UIs are rewritten constantly, so a lookup
   takes a *list* of candidate selectors and returns the first one that is actually on screen.
2. **Deciding that an answer is finished.** No fixed sleep, no spinner guessing: the last
   answer's fingerprint (visible text length, image count, whether a busy control is up) has to
   stop changing for several polls *and* have to contain something. An empty answer is "not yet",
   never "done" — the classic way these scripts end up saving nothing.
3. **Taking the result out without losing it.** Images come at full fidelity in three attempts:
   the page's own download (the original bytes), then the ``<img>`` URL fetched *through the
   browser context* (so the session cookies travel with it — Google's image URLs do not work
   without them), then a screenshot of the element, which still works when the source is a
   ``blob:`` object. Text is written as markdown with the prompt and the page URL in front
   matter, because an answer without its question is an anecdote.
"""
from __future__ import annotations

import json
import re
import time
import unicodedata
from pathlib import Path
from typing import Iterable, Optional

if __package__ in (None, ""):
    import sys

    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
    __package__ = "tools.engine"

from tools.engine import log  # noqa: E402

ANSWER_IMG = "img"


# ---------------------------------------------------------------------------- naming
def slugify(text: str, n: int = 46) -> str:
    """Filesystem-safe in any script. Arabic letters survive; spaces, slashes and emoji don't."""
    text = unicodedata.normalize("NFKC", text or "").strip().lower()
    keep = [ch if ch.isalnum() else ("-" if ch in " -_\t" else "") for ch in text]
    out = re.sub(r"-{2,}", "-", "".join(keep)).strip("-")
    return (out[:n] or "task") if out else "task"


def stamp() -> str:
    return time.strftime("%Y%m%d-%H%M%S")


# ------------------------------------------------------------------------ selectors
def find_first(target, selectors: Iterable[str], timeout: float = 0.0, visible: bool = True):
    """The first selector from the list that matches something live. None if none ever do.

    ``target`` may be a Page or a Locator — both expose ``.locator``.
    """
    sels = [s for s in selectors if s]
    deadline = time.monotonic() + max(0.0, timeout)
    while True:
        for sel in sels:
            try:
                loc = target.locator(sel).first
                if loc.count() > 0 and (not visible or loc.is_visible()):
                    return loc
            except Exception:
                continue
        if time.monotonic() >= deadline:
            return None
        time.sleep(0.3)


FOLD = re.compile(r"[^0-9a-z\u0600-\u06ff]+")
WALL_PHRASES = ("sign in", "signed in", "signed out", "sign out", "log in", "logged out", "login",
                "get started", "create an account", "continue to", "sign up", "use a browser account",
                "not available in your location", "تسجيل الدخول", "إنشاء حساب", "غير متاح في منطقتك")


def fold(text: str) -> str:
    """Lowercase letters and digits, latin and Arabic, everything else a single space."""
    return FOLD.sub(" ", (text or "").lower()).strip()


def is_echo(text: str, prompt: str) -> bool:
    """Is this *answer* only our own prompt coming back?

    A logged-out assistant still paints the question into the conversation, and that echo settles
    exactly like a reply — stable, non-empty, one new turn — so a pipeline that trusts "settled"
    ends up cutting a film out of a sign-in wall. Blank counts as an echo: an empty answer node is
    not an answer either. The small slack on the length is for a "Thinking" label or a trailing
    cursor; anything that says something the prompt did not is a real reply.
    """
    a, p = fold(text), fold(prompt)
    if not a:
        return True
    if a == p:
        return True
    # A wall around an echo is still an echo: take the authentication wording out first, then ask
    # whether anything the prompt did not already say is left.
    residual = a
    for phrase in (fold(w) for w in WALL_PHRASES):
        if phrase:
            residual = residual.replace(phrase, " ")
    residual = " ".join(residual.split())
    if not residual or residual == p:
        return True
    return len(residual) <= len(p) + 16 and (residual in p or p in residual)


def says_wall(text: str) -> bool:
    """Does this text read like an authentication state rather than an answer?

    Deliberately wider than a login button: the logged-out assistants do answer, in prose, with an
    apology about signing in or a feature that is unavailable here. That is not an answer to save,
    and it is not a page-shape failure either — it is the one case where the fix is a person, so it
    has to leave as exit 2 and say so."""
    low = fold(text)
    return any(phrase in low for phrase in (fold(p) for p in WALL_PHRASES) if phrase)


def any_visible(target, selectors: Iterable[str]) -> bool:
    return find_first(target, selectors, timeout=0) is not None


# ---------------------------------------------------------------------- stability
def fingerprint(turn, img_sel: str = ANSWER_IMG) -> tuple:
    """(characters of visible text, images on screen, does it contain anything yet)."""
    try:
        text = len(turn.inner_text().strip())
        pics = turn.locator(img_sel).count() if img_sel else 0
        return (text, pics, text > 24 or pics > 0)
    except Exception:
        return (-1, -1, False)


def wait_until_stable(
    page,
    turns: str,
    *,
    busy: Iterable[str] = (),
    before: int = 0,
    timeout: float = 240.0,
    settle: float = 1.5,
    quiet: int = 3,
    min_wait: float = 6.0,
    img_sel: str = ANSWER_IMG,
    progress: Optional[str] = None,
):
    """Poll until a *new* answer stops growing. Returns its locator, or None on timeout.

    ``before`` is how many answers existed when the prompt was sent, so a stale answer from
    earlier in the conversation can never be mistaken for this one.
    """
    t0 = time.monotonic()
    deadline = t0 + timeout
    last = None
    stable = 0
    while time.monotonic() < deadline:
        try:
            count = page.locator(turns).count()
        except Exception:
            count = 0
        loc = page.locator(turns)
        turn = loc.last if count > before else None
        busy_up = any_visible(page, busy)
        if turn is not None and not busy_up:
            fp = fingerprint(turn, img_sel)
            if not fp[2]:
                last, stable = None, 0          # nothing in it yet — the answer has not started
            else:
                # A picture *is* an ending: with one on screen and the busy control gone, two
                # identical samples take it. Text alone is not — a stream can pause mid-sentence
                # for longer than a poll — so that waits out the floor before being believed.
                ready = (time.monotonic() - t0) >= min_wait or fp[1] > 0
                if fp == last and ready:
                    return turn
                stable = stable + 1 if fp == last else 0
                if stable >= quiet and ready:
                    return turn
                last = fp
        else:
            last, stable = None, 0
        if progress:
            log(f"{progress} {time.monotonic() - t0:.0f}s" + (f" · {count} answer(s)" if count != before else ""))
        time.sleep(settle)
    return None


# ------------------------------------------------------------------------ harvest
def harvest_images(page, ctx, turn, out_dir: Path, stem: str, *, min_px: int = 180, use_download_btn: bool = True,
                   download_sel: str = 'button[aria-label*="download" i], [role="menuitem"]:has-text("Download"), .download-icon',
                   img_sel: str = ANSWER_IMG) -> list:
    """Every picture-sized element in ``turn``, written to ``out_dir``. Best available bytes.

    ``img_sel`` is a knob because some answers put the picture inside a tile, a carousel or a
    preview element; the adapter knows its own DOM, and the size test does the rest.
    """
    out_dir.mkdir(parents=True, exist_ok=True)
    sel = img_sel or ANSWER_IMG
    imgs = turn.locator(sel)
    n = imgs.count()
    found = []
    for i in range(n):
        el = imgs.nth(i)
        try:
            box = el.bounding_box()
            src = el.get_attribute("src") or ""
        except Exception:
            continue
        if not box or min(box["width"], box["height"]) < min_px:
            continue  # icons, avatars, spinner art
        found.append((i, el, src, box))
    if not found:
        log(f"no picture-sized element in the answer ({n} image element(s) seen)")
        return []

    out = []
    multi = len(found) > 1
    for i, el, src, box in found:
        dest = out_dir / (f"{stem}-{stamp()}-{i}.png" if multi else f"{stem}-{stamp()}.png")
        how = None
        if use_download_btn:
            try:
                el.hover()
                time.sleep(0.35)
                btn = turn.locator(download_sel).first
                if btn.count() > 0 and btn.is_visible():
                    with page.expect_download(timeout=15_000) as dl:
                        btn.click()
                    dl.value.save_as(str(dest))
                    how = "download"
            except Exception as e:
                log(f"the page's own download did not work ({type(e).__name__}); keeping the picture anyway")
        if how is None and src.startswith("http"):
            try:
                r = ctx.request.get(src, timeout=30_000)
                if r.ok and len(r.body()) > 2048:
                    dest.write_bytes(r.body())
                    how = "url"
            except Exception as e:
                log(f"direct URL fetch failed ({type(e).__name__})")
        if how is None:
            try:
                el.screenshot(path=str(dest))
                how = f"element {int(box['width'])}x{int(box['height'])}"
            except Exception as e:
                log(f"element screenshot failed ({type(e).__name__}) — this one is lost")
                continue
        out.append({"path": str(dest), "bytes": dest.stat().st_size, "kind": "image", "how": how})
        log(f"saved {dest} · {how}")
    return out


def harvest_text(turn, out_dir: Path, stem: str, meta: dict, raw: bool = False) -> list:
    """The answer as markdown, with its own provenance. Optionally the HTML beside it."""
    out_dir.mkdir(parents=True, exist_ok=True)
    body = (turn.inner_text() or "").strip()
    if not body:
        return []
    dest = out_dir / f"{stem}-{stamp()}.md"
    head = "\n".join(f"# {k}: {v}" for k, v in meta.items() if v)
    dest.write_text(f"{head}\n\n{body}\n", encoding="utf-8")
    out = [{"path": str(dest), "bytes": dest.stat().st_size, "kind": "text", "how": "inner_text"}]
    log(f"saved {dest} · {len(body)} chars")
    if raw:
        try:
            html = out_dir / (dest.stem + ".html")
            html.write_text(turn.inner_html() or "", encoding="utf-8")
            out.append({"path": str(html), "bytes": html.stat().st_size, "kind": "html", "how": "inner_html"})
        except Exception as e:
            log(f"raw html skipped: {type(e).__name__}")
    return out


def harvest_links(turn, out_dir: Path, stem: str, ctx, *, exts: Iterable[str] = (".md", ".pdf", ".txt", ".html", ".csv", ".docx")) -> list:
    """Files the answer offers to download (a research report, a table) — fetched with the session."""
    out = []
    try:
        links = turn.locator("a[href]")
        n = links.count()
    except Exception:
        return out
    for i in range(n):
        a = links.nth(i)
        try:
            href = a.get_attribute("href") or ""
            label = (a.inner_text() or "").strip()
        except Exception:
            continue
        if not href.startswith("http"):
            continue
        low = href.lower().split("?")[0]
        if not low.endswith(tuple(exts)):
            continue
        ext = "." + low.rsplit(".", 1)[-1]
        dest = out_dir / f"{stem}-{stamp()}-{slugify(label or 'file', 28)}{ext}"
        try:
            r = ctx.request.get(href, timeout=30_000)
            if r.ok and len(r.body()) > 16:
                dest.write_bytes(r.body())
                out.append({"path": str(dest), "bytes": dest.stat().st_size, "kind": "file", "how": "link"})
                log(f"saved {dest} · link")
        except Exception as e:
            log(f"link fetch failed for {href[:70]} ({type(e).__name__})")
    return out


def citations(turn) -> list:
    """Reference links inside an answer, kept in the sidecar so a claim can be traced."""
    out = []
    try:
        links = turn.locator('a[href^="http"]')
        for i in range(min(links.count(), 40)):
            a = links.nth(i)
            try:
                href = a.get_attribute("href") or ""
                txt = (a.inner_text() or "").strip()[:120]
            except Exception:
                continue
            if href:
                out.append({"title": txt, "url": href})
    except Exception:
        pass
    return out


def write_sidecar(out_dir: Path, stem: str, payload: dict) -> dict:
    dest = out_dir / f"{stem}-{stamp()}.json"
    dest.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"path": str(dest), "bytes": dest.stat().st_size, "kind": "sidecar", "how": "metadata"}
