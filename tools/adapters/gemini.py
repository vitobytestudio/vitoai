"""Gemini — the web app in the operator's browser, asked for a picture.

Only the four hooks live here. The tab, the cleanup, the settle rule and the three-way harvest
come from the engine, so this file is the part that changes when Google changes its markup — and
nothing else does.

Waiting is deliberately not a sleep: a generated image appears as an ``<img>`` inside the newest
``model-response``, so the answer is taken when its text length, its image count and the "stop"
control all agree for several polls. A draft that is still growing is never harvested.
"""
from __future__ import annotations

from pathlib import Path
from typing import Optional

if __package__ in (None, ""):  # pragma: no cover
    import sys

    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
    __package__ = "tools.adapters"

from tools.adapters.base import BaseAdapter, NoResult, SessionExpired  # noqa: E402
from tools.engine import log  # noqa: E402


class Gemini(BaseAdapter):
    name = "gemini"
    aliases = ("gemini-web", "gemini-image")
    title = "Gemini web app — generated images (and the text beside them)"
    entry = "https://gemini.google.com/app"
    hosts = ("gemini.google.com",)

    COMPOSERS = (
        'div.ql-editor[contenteditable="true"]',
        'div[contenteditable="true"][role="textbox"]',
        'textarea[aria-label*="prompt" i]',
        '[role="textbox"]',
    )
    SEND = ('button[aria-label*="Send" i]', 'button.send-button', 'button:has-text("Send")')
    BUSY = (
        'button[aria-label*="Stop" i]',
        ".stop-icon",
        "mat-progress-bar",
        'button:has-text("Stop generating")',
    )
    #: a Gemini job without a picture in it did not happen, however well the sentence reads
    WANTS_IMAGE = True
    TURNS = 'model-response, .model-response-text, [data-test-id*="response"]'
    CONSENT = (
        'button:has-text("Accept all")',
        'button:has-text("التالي")',
        'button[aria-label*="accept" i]',
        'form[action*="consent"] button[type="submit"]',
    )
    MIN_WAIT = 6.0
    SETTLE = 1.5
    QUIET = 3

    def __init__(self, tab, cfg: Optional[object] = None):
        super().__init__(tab, cfg)
        self._composer = None

    # ---------------------------------------------------------------- hook 1 of 4
    def check_session(self) -> None:
        """Consent wall if it is standing, then the composer is the whole test.

        Everything Google shows when it will not talk to us — the account chooser, the interstitial,
        the logged-out shell — has no composer, so this catches the "attached to a browser that is
        not actually signed in" case that a URL check would miss.
        """
        if "consent.google.com" in (self.page.url or ""):
            agree = self.find(self.CONSENT, timeout=5)
            if agree is not None:
                log("consent wall — accepting it for this tab only")
                try:
                    agree.click()
                    self.page.wait_for_load_state("domcontentloaded", timeout=20_000)
                except Exception:
                    pass
        self._composer = self.find(self.COMPOSERS, timeout=self.cfg.login_wait)
        if self._composer is None:
            low = (self.page.url or "").lower()
            if "accounts.google.com" in low or "signin" in low:
                raise SessionExpired("Gemini bounced the tab to Google's sign-in page — log in once in that browser")
            raise SessionExpired(
                f"no composer on {self.page.url} within {self.cfg.login_wait:.0f}s — "
                "either the account is signed out or Gemini moved the input; try --keep-tab --mode look"
            )

    # ---------------------------------------------------------------- hook 2 of 4
    def submit(self, prompt: str) -> None:
        if self._composer is None:
            self._composer = self.find(self.COMPOSERS, timeout=6) or self.find(self.COMPOSERS, timeout=0)
        if self._composer is None:
            raise NoResult("the composer vanished between the check and the send")
        self._composer.click()
        # insert_text, not fill(): a contenteditable Quill editor only reacts to real input events
        self.page.keyboard.insert_text(prompt)
        try:
            self._composer.press("Enter")
        except Exception:
            pass
        # Three signs that it left (a new answer node, a busy indicator, an emptied composer) — see
        # BaseAdapter.looks_sent. If none of them show, fall back to the Send button; and if even
        # that is missing, do *not* raise: the settle rule will fail loudly and correctly instead
        # of this line guessing wrong about a page that was merely slow.
        self.page.wait_for_timeout(1200)
        if not self.looks_sent(getattr(self, "_before", 0), self._composer):
            btn = self.find(self.SEND, timeout=6)
            if btn is not None:
                btn.click()
            else:
                log("no Send button and no sign of submission yet — letting the wait rule decide")

    # ---------------------------------------------------------------- hook 3 of 4
    def wait_for_answer(self):
        return self.wait_stable(before=getattr(self, "_before", 0), progress="waiting for gemini,")

    # ---------------------------------------------------------------- hook 4 of 4
    def extract(self, answer, stem: str) -> list:
        out = self.save_images(answer, stem)
        # The words around a picture are the brief's receipt: what it asked for, what it said.
        out += self.save_text(answer, stem, prompt=stem)
        return out
