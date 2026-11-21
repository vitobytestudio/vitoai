"""ChatGPT — interactive text, with the patience a long answer needs.

Same four hooks, different animal: a chat answer streams for tens of seconds and a research run
for minutes, so the settle numbers are the interesting part of this file. Extraction takes the
visible text (written as markdown, prompt and URL in the front matter), plus any file the answer
offers to download and every citation link it referenced — a research report whose sources were
dropped is half a result.

Deliberately **not** done here: clicking feature menus (Research, canvas, model pickers). Those
controls move every few weeks, and a script that chases them fails on the day it is needed. Pick
the mode in the browser you already have open, or say it in the prompt; ``--mode research`` only
changes how long and how hard this adapter waits and harvests.
"""
from __future__ import annotations

from pathlib import Path

if __package__ in (None, ""):  # pragma: no cover
    import sys

    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
    __package__ = "tools.adapters"

from tools.adapters.base import BaseAdapter, NoResult, SessionExpired  # noqa: E402
from tools.engine import drive, log  # noqa: E402


class ChatGPT(BaseAdapter):
    name = "chatgpt"
    aliases = ("gpt", "openai", "chat")
    title = "ChatGPT — answers and research, saved as markdown with their sources"
    entry = "https://chatgpt.com/"
    hosts = ("chatgpt.com", "openai.com", "chat.openai.com")

    COMPOSERS = (
        'div#prompt-textarea[contenteditable="true"]',
        '[data-testid="composer"] [contenteditable="true"]',
        'div[contenteditable="true"][role="textbox"]',
        'textarea[aria-label*="prompt" i]',
    )
    SEND = ('[data-testid="send-button"]', 'button[aria-label*="Send" i]', "#composer-submit-button", 'button:has-text("Send")')
    BUSY = (
        'button[data-testid="stop-button"]',
        'button[aria-label*="Stop" i]',
        "div.result-streaming",
        '[data-testid="thinking-block"]',
        'button:has-text("Stop generating")',
    )
    TURNS = 'div[data-message-author-role="assistant"], [data-message-author-role="assistant"], article[id^="message-id"]'
    NEWCHAT = ('[aria-label*="New chat" i]', 'button[data-testid="sidebar-new-chat-button"]')

    MIN_WAIT = 4.0
    SETTLE = 1.2
    QUIET = 3

    # ------------------------------------------------------------ tuning per mode
    def _mode(self) -> str:
        return (self.cfg.mode or "").strip().lower()

    def _apply_mode(self) -> None:
        """A long answer is not a stuck answer: give research minutes, and stop polling it twice
        as often. Everything else about the run is identical."""
        if self._mode().startswith(("research", "deep")):
            self.MIN_WAIT, self.SETTLE, self.QUIET = 25.0, 3.0, 2
            log("mode=research — patient waiting, links and citations harvested hard")
        elif self._mode() == "look":
            self.MIN_WAIT, self.SETTLE, self.QUIET = 0.0, 0.5, 1

    # ---------------------------------------------------------------- hook 1 of 4
    def check_session(self) -> None:
        self._apply_mode()
        composer = self.find(self.COMPOSERS, timeout=self.cfg.login_wait)
        if composer is None:
            low = (self.page.url or "").lower()
            if "auth" in low or "signin" in low or "accounts." in low:
                raise SessionExpired(f"ChatGPT wants a login ({self.page.url}) — sign in once in that browser")
            raise SessionExpired(f"no composer on {self.page.url} within {self.cfg.login_wait:.0f}s")
        self._composer = composer

    # ---------------------------------------------------------------- hook 2 of 4
    def submit(self, prompt: str) -> None:
        composer = getattr(self, "_composer", None) or self.find(self.COMPOSERS, timeout=6)
        if composer is None:
            raise NoResult("the composer disappeared before the send")
        composer.click()
        self.page.keyboard.insert_text(prompt)
        try:
            composer.press("Enter")
        except Exception:
            pass
        self.page.wait_for_timeout(1400)
        if not self.looks_sent(getattr(self, "_before", 0), composer):
            btn = self.find(self.SEND, timeout=6)
            if btn is not None:
                btn.click()
            else:
                log("neither Enter nor a Send button registered — letting the wait rule decide")

    # ---------------------------------------------------------------- hook 3 of 4
    def wait_for_answer(self):
        ans = self.wait_stable(before=getattr(self, "_before", 0), progress="waiting for chatgpt,")
        if ans is not None and self._mode().startswith(("research", "deep")):
            # lazily-rendered footnotes and attachment tiles only exist once they have been near
            # the viewport, and the download affordances are built when you look at them
            try:
                ans.scroll_into_view_if_needed(timeout=8_000)
                self.page.wait_for_timeout(2200)
            except Exception:
                pass
        return ans

    # ---------------------------------------------------------------- hook 4 of 4
    def extract(self, answer, stem: str) -> list:
        out = self.save_text(answer, stem, prompt=getattr(self, "_prompt", ""))
        out += self.save_images(answer, stem)      # charts and generated pictures, if it made any
        out += self.save_links(answer, stem)        # the report file, when the answer offers one
        cites = drive.citations(answer)
        if cites:
            log(f"{len(cites)} reference link(s) recorded")
            out.append(self.sidecar(stem + "-sources", platform=self.name, citations=cites))
        return [a for a in out if a]
