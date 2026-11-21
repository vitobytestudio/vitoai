"""The contract a platform adapter signs — four questions, nothing else.

A site-specific adapter knows where its composer is, how to send, how to tell that the answer
stopped growing, and what counts as the output. It does **not** open tabs, close tabs, decide
where files go, or write its own retry logic: that is the engine's, so a new adapter inherits the
tab-isolation and full-fidelity-safety rules instead of re-inventing them (badly, at 2 a.m.).

Adding a platform is one new file in this folder. Nothing here, in the engine, or in the runner
has to know it exists.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from pathlib import Path
from typing import Optional

if __package__ in (None, ""):
    import sys

    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
    __package__ = "tools.adapters"

from tools.engine import drive, log  # noqa: E402


class SessionExpired(Exception):
    """The browser attached fine; this platform is not logged in (or bounced to a login wall)."""


class NotSettled(Exception):
    """Sent, and the answer never stopped growing within the budget."""


class NoResult(Exception):
    """The answer settled and had nothing in it that this adapter knows how to take."""


class Config:
    """One place for the knobs, so an adapter never reads argv."""

    def __init__(self, *, out: str | Path = "assets", timeout: float = 240.0, login_wait: float = 12.0,
                 mode: str = "", raw: bool = False, use_download_btn: bool = True, min_px: int = 180,
                 extra: Optional[dict] = None):
        self.out = Path(out).expanduser()
        self.timeout = float(timeout)
        self.login_wait = float(login_wait)
        self.mode = mode or ""
        self.raw = bool(raw)
        self.use_download_btn = bool(use_download_btn)
        self.min_px = int(min_px)
        self.extra = dict(extra or {})

    @classmethod
    def from_args(cls, args) -> "Config":
        return cls(
            out=getattr(args, "out", "assets"),
            timeout=getattr(args, "timeout", 240.0),
            login_wait=getattr(args, "login_wait", 12.0),
            mode=getattr(args, "mode", ""),
            raw=getattr(args, "raw", False),
            use_download_btn=not getattr(args, "no_download_btn", False),
            min_px=getattr(args, "min_px", 180),
            extra=getattr(args, "extra", None) or {},
        )

    def as_dict(self) -> dict:
        return {"out": str(self.out), "timeout": self.timeout, "login_wait": self.login_wait,
                "mode": self.mode or None, "raw": self.raw, "min_px": self.min_px}


class BaseAdapter(ABC):
    #: what `--platform` matches, plus any aliases the operator is more likely to type
    name: str = ""
    aliases: tuple = ()
    title: str = ""
    #: the page a task starts on; the engine opens it in a tab of its own
    entry: str = ""
    #: hosts this adapter is allowed to drive. Empty means "anything", which no adapter should do.
    hosts: tuple = ()
    #: what a finished answer is made of, for the waiting rule
    IMG_SEL: str = "img"
    #: the stability budget, in the adapter's own voice — deep research needs minutes, a chat
    #: line needs seconds, and a single global number makes one of them wrong
    SETTLE: float = 1.5
    QUIET: int = 3
    MIN_WAIT: float = 6.0

    # --------------------------------------------------------------- the four hooks
    @abstractmethod
    def check_session(self) -> None:
        """Decide whether this platform is usable right now. Raise ``SessionExpired`` if not.

        Consent walls and "continue as …" interstitials belong here: they are page knowledge, and
        the answer this function gives is a yes/no the runner turns into an exit code.
        """

    @abstractmethod
    def submit(self, prompt: str) -> None:
        """Type it, send it, and be sure it left. No waiting for the answer here."""

    @abstractmethod
    def wait_for_answer(self):
        """Return the finished answer's locator, or None if it never settled."""

    @abstractmethod
    def extract(self, answer, stem: str) -> list:
        """Take everything worth keeping out of ``answer``, saving it under ``stem``.

        Return the list of ``drive.harvest_*`` results; the runner reports them verbatim, so a
        file that is not in this list does not exist as far as the caller is concerned.
        """

    # ------------------------------------------------------------------- provided
    def __init__(self, tab, cfg: Optional[Config] = None):
        self.tab = tab
        self.page = tab.page
        self.cfg = cfg or Config()
        self.out_dir = self.cfg.out

    def find(self, selectors, timeout: float = 0.0, target=None):
        return drive.find_first(target if target is not None else self.page, selectors, timeout=timeout)

    def turn_count(self) -> int:
        try:
            return self.page.locator(self.TURNS).count()
        except Exception:
            return 0

    def looks_sent(self, before: int, composer=None) -> bool:
        """Did the prompt leave? Any of three signs is enough.

        Counting answer nodes right after Enter is flaky on its own — the first node can appear
        only once streaming starts — so a busy indicator or an emptied composer counts too. What
        this protects against is the expensive mistake: sending the same prompt twice because the
        UI had not caught up yet.
        """
        if self.turn_count() > before:
            return True
        if drive.any_visible(self.page, getattr(self, "BUSY", ())):
            return True
        if composer is not None:
            try:
                return (composer.inner_text() or "").strip() == ""
            except Exception:
                return False
        return False

    def wait_stable(self, *, before: int = 0, busy=None, progress: str = ""):
        """The shared settle rule, configured by the adapter's own numbers."""
        return drive.wait_until_stable(
            self.page,
            self.TURNS,
            busy=tuple(busy if busy is not None else getattr(self, "BUSY", ())),
            before=before,
            timeout=self.cfg.timeout,
            settle=self.SETTLE,
            quiet=self.QUIET,
            min_wait=self.MIN_WAIT,
            img_sel=self.IMG_SEL,
            progress=progress,
        )

    def reject_echo(self, answer, prompt: str) -> None:
        """Refuse to call a mirror an answer, and refuse to call an apology a picture.

        Three ways a settled node is not a result. It can be only the prompt we sent back at us (the
        logged-out shell paints the question into the conversation, and that echo is stable, non-empty
        and arrives as one new turn — indistinguishable by shape). It can be a wall: prose about signing
        in, an account state, a feature unavailable here. Or it can be a courteous refusal with nothing
        in it, which no rule about wording will ever catch reliably.

        So the rules, in order of trustworthiness: a picture in the answer ends the enquiry; an adapter
        that was asked for a picture *requires* one, whatever the sentence says; and everything else
        falls back to the mirror test. An echo with authentication wording is a session problem, since
        there is exactly one fix and it is a person. A refusal without a picture is `NoResult` with the
        page's own words quoted, because the alternative is filing 282 bytes of regret as a deliverable.
        """
        text = ""
        try:
            text = answer.inner_text() if hasattr(answer, "inner_text") else (getattr(answer, "text", "") or "")
        except Exception:  # noqa: BLE001 - a node that vanished mid-read is not an answer either
            text = ""
        try:
            pictures = int(answer.locator(self.IMG_SEL).count()) if hasattr(answer, "locator") else 0
        except Exception:  # noqa: BLE001
            pictures = 0
        if pictures:
            return
        quoted = " ".join((text or "").split())[:160]
        wall = drive.says_wall(text or "") or bool(drive.says_wall(getattr(self, "page_hint", "") or ""))
        echo = drive.is_echo(text, prompt)
        # A text-first adapter keeps a sentence about sessions: asked about logins, that is the answer.
        wants = bool(getattr(self, "WANTS_IMAGE", False)) and not self.cfg.mode.strip().lower().startswith(("text", "look"))
        if wants or echo:
            if wall:
                raise SessionExpired(
                    f"{self.name}: the page is talking about signing in, not about the job — "
                    f"log in once in that browser (it said: {quoted!r})"
                )
            if wants:
                raise NoResult(
                    f"{self.name}: {self.cfg.mode or 'image'} was asked for a picture and the settled "
                    f"answer holds none ({len((text or '').strip())} chars of prose: {quoted!r})"
                )
            raise NoResult(
                f"{self.name}: the settled answer is only an echo of the prompt "
                f"({len((text or '').strip())} chars, no image) — nothing was answered"
            )

    def save_images(self, answer, stem: str) -> list:
        return drive.harvest_images(
            self.page, self.tab.page.context, answer, self.out_dir, stem,
            min_px=self.cfg.min_px, use_download_btn=self.cfg.use_download_btn, img_sel=getattr(self, "IMG_SEL", "img") or "img",
        )

    def save_text(self, answer, stem: str, **meta) -> list:
        prompt = meta.pop("prompt", "") or getattr(self, "_prompt", "")
        head = {"platform": self.name, "page": self.page.url, "prompt": (prompt or "").replace("\n", " ")[:240]}
        head.update({k: v for k, v in meta.items() if v})
        return drive.harvest_text(answer, self.out_dir, stem, head, raw=self.cfg.raw)

    def save_links(self, answer, stem: str) -> list:
        return drive.harvest_links(answer, self.out_dir, stem, self.tab.page.context)

    def sidecar(self, stem: str, **payload) -> Optional[dict]:
        if not payload:
            return None
        return drive.write_sidecar(self.out_dir, stem, payload)

    # ---------------------------------------------------------------- orchestration
    def run(self, prompt: str) -> dict:
        """check → send → wait → extract. Every adapter gets the same guarantees this way."""
        self._prompt = prompt
        self.check_session()
        self._before = self.turn_count()
        self.submit(prompt)
        answer = self.wait_for_answer()
        if answer is None:
            raise NotSettled(f"{self.name}: no settled answer within {self.cfg.timeout:.0f}s")
        self.reject_echo(answer, prompt)
        stem = f"{self.name}-{drive.slugify(prompt)}"
        artifacts = [a for a in (self.extract(answer, stem) or []) if a]
        if not artifacts:
            raise NoResult(f"{self.name}: the answer settled but held nothing this adapter can save")
        side = self.sidecar(stem, platform=self.name, prompt=prompt, url=self.page.url, config=self.cfg.as_dict())
        if side:
            artifacts.append(side)
        total = sum(int(a.get("bytes", 0)) for a in artifacts)
        log(f"{self.name}: {len(artifacts)} artifact(s), {total} bytes")
        return {"stem": stem, "artifacts": artifacts, "bytes": total, "host": self.tab.host}

    @classmethod
    def matches(cls, other: str) -> bool:
        other = (other or "").strip().lower()
        return other in {cls.name.lower(), *(a.lower() for a in cls.aliases)} or other == cls.__name__.lower()


def contract(cls) -> dict:
    """What the runner shows for ``--list``: enough to pick an adapter, and enough to see whether
    a newly dropped file is wired up correctly."""
    missing = [m for m in ("check_session", "submit", "wait_for_answer", "extract") if getattr(cls, m, None) is getattr(BaseAdapter, m, None)]
    return {
        "platform": cls.name,
        "class": f"{cls.__module__}.{cls.__name__}",
        "title": cls.title or "",
        "entry": cls.entry,
        "hosts": list(cls.hosts),
        "aliases": list(cls.aliases),
        "missing_hooks": missing,
    }
