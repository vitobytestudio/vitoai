#!/usr/bin/env python3
"""A task queue whose only transport is git.

The agent and the browser sit on opposite sides of a NAT. The agent has no inbound port and a
filtered egress (it can reach its git host and a package index, not much else); the operator's
laptop has no public address and runs no server. What both sides *do* have is a remote they are
already allowed to push to. So the queue lives in the repository and nobody opens anything:

* the client writes ``tasks/pending/<id>.json``, commits, pushes, then polls with ``git fetch``;
* a worker on the machine that owns the browser sees the new file, claims it, runs
  ``python3 -m tools.runner`` against ``127.0.0.1:9222``, copies the outputs into
  ``tasks/done/<id>/`` and pushes;
* the client reads the result out of the fetched head (``git show``, not a merge — waiting on a
  queue must never rearrange the working tree of the person doing other work in it) and writes
  the files next to its own work.

Every connection on both sides is one-directional HTTPS to the git host. No port to forward, no
tunnel to keep alive, no shared secret beyond a push credential that already exists. A
GitHub-hosted runner is just another worker: same queue, ``--env hosted``, with a throwaway
browser of its own.

Layout, all under ``tasks/`` at the repository root::

    tasks/pending/<id>.json      request           (client writes, worker deletes)
    tasks/running/<id>.json      claim             (worker writes, worker deletes)
    tasks/cancel/<id>.json       "don't/stop"      (client writes, worker deletes)
    tasks/done/<id>/result.json  outcome + index   (worker writes)
    tasks/done/<id>/artifacts/*  the files         (worker writes)
    tasks/HEARTBEAT.json         liveness          (worker rewrites while idle)

One file per task rather than one shared log, on purpose: two writers appending to the same JSONL
is a merge conflict, and a queue that needs a merge strategy is not a queue.

Two commands carry the day::

    python3 tools/gh_bridge.py ask --platform gemini --prompt "hero shot, 35mm"   # client
    python3 tools/gh_bridge.py worker                                              # the laptop

Notes that each cost an hour to learn:

* **Nothing here is run through a shell.** A task names a platform from the adapter registry and
  flags from a fixed allowlist; there is no key that carries a command. The worker refuses a task
  whose keys it does not know, so a queue file stays data and never becomes code.
* **The queue is git history.** Whatever you type into a prompt is committed and permanent, on
  every clone of this branch. Put no credentials in it, and run ``prune`` so payloads do not pile
  up.
* **The debug port stays local.** Chrome's CDP endpoint has no authentication: whoever reaches it
  owns every tab. The worker talks to localhost and this module writes nothing to the network
  except git traffic.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import platform as _platform
import re
import shlex
import shutil
import socket
import subprocess
import sys
import time
from pathlib import Path
from typing import Any, Iterable, Optional
from urllib.parse import urlsplit

if __package__ in (None, ""):  # direct execution: python3 tools/gh_bridge.py
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    __package__ = "tools"

from tools.engine import log  # noqa: E402  (stderr chatter only)
from tools.engine.cdp_client import probe, resolve  # noqa: E402

REPO = Path(__file__).resolve().parents[1]
Q = "tasks"
PENDING, RUNNING, DONE, CANCEL, HEARTBEAT = f"{Q}/pending", f"{Q}/running", f"{Q}/done", f"{Q}/cancel", f"{Q}/HEARTBEAT.json"
WORKDIR = ".vito-bridge"

EXIT = {"ok": 0, "session": 2, "timeout": 3, "noresult": 4, "env": 5, "usage": 6, "bridge": 7}
MAX_PROMPT = 20_000
MAX_ARTIFACT = 25 * 1024 * 1024
MAX_TOTAL = 150 * 1024 * 1024
ID_RE = re.compile(r"^\d{13}-[a-z0-9-]{1,48}$")

# The runner flags a task may set, and what each becomes. Anything else is refused during
# validation, so a queue file cannot smuggle in an argument the runner was never meant to get.
ASK_KEYS = {
    "platform": "--platform",
    "prompt": "--prompt",
    "mode": "--mode",
    "timeout": "--timeout",
    "connect_timeout": "--connect-timeout",
    "login_wait": "--login-wait",
    "min_px": "--min-px",
    "raw": "--raw",
    "no_download_btn": "--no-download-btn",
}
# Deliberately absent: --out (the worker owns the output dir), --cdp-url (the worker owns the
# endpoint), --keep-tab (would strand a tab in someone else's browser), --adapters (a path on
# another machine), --jobs/--probe/--list/--self-check (this module is the queue).
TOP_KEYS = {"id", "kind", "env", "created_at", "client", "note", "ask"}
KINDS = {"ask", "ping"}
ENVS = {"local", "hosted", "any"}
NUMERIC = {"timeout": (10.0, 3600.0), "connect_timeout": (3.0, 300.0), "login_wait": (0.0, 300.0), "min_px": (16, 4096)}
BOOLS = ("raw", "no_download_btn")


class BridgeError(RuntimeError):
    """Anything the caller can act on without reading this file first."""


# ------------------------------------------------------------------------------ task shape
def slugify(text: str) -> str:
    """A filesystem-safe hint from arbitrary (often Arabic) text. No transliteration fantasy:
    non-ASCII collapses to nothing, the timestamp and the random tail carry the identity."""
    out = re.sub(r"[^a-z0-9]+", "-", (text or "").lower()).strip("-")[:28].strip("-")
    return out or "task"


def make_id(prompt: str = "") -> str:
    return f"{int(time.time() * 1000):013d}-{slugify(prompt)}-{os.urandom(3).hex()}"


def dump(obj: Any) -> str:
    return json.dumps(obj, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def validate_task(raw: Any) -> dict:
    """Normalize and police a task. Raises ``BridgeError`` naming what to change."""
    if not isinstance(raw, dict):
        raise BridgeError("task must be a JSON object")
    unknown = sorted(set(raw) - TOP_KEYS)
    if unknown:
        raise BridgeError(f"unknown task key(s) {', '.join(unknown)}; allowed: {', '.join(sorted(TOP_KEYS))}")
    t: dict[str, Any] = {"kind": "ask", "env": "local", "note": "", "client": "", "ask": {}}
    t["id"] = str(raw["id"]) if "id" in raw else make_id(str((raw.get("ask") or {}).get("prompt", "")) + " " + str(raw.get("note", "")))
    if not ID_RE.match(t["id"]):
        raise BridgeError(f"task id {t['id']!r} must look like 0000000000000-slug-hex6 (lowercase, no slashes)")
    for key in ("kind", "env"):
        if key in raw:
            t[key] = str(raw[key])
    if t["kind"] not in KINDS:
        raise BridgeError(f"kind must be one of {', '.join(sorted(KINDS))}")
    if t["env"] not in ENVS:
        raise BridgeError(f"env must be one of {', '.join(sorted(ENVS))}")
    try:
        t["created_at"] = float(raw.get("created_at", time.time()))
    except (TypeError, ValueError):
        raise BridgeError("created_at must be a number (epoch seconds)") from None
    t["client"] = str(raw.get("client") or os.environ.get("BRIDGE_CLIENT") or "agent")[:80]
    t["note"] = str(raw.get("note") or "")[:400]
    if t["kind"] == "ping":
        return t
    ask = raw.get("ask")
    if not isinstance(ask, dict):
        raise BridgeError('an ask task needs an "ask" object with at least platform and prompt')
    bad = sorted(set(ask) - set(ASK_KEYS))
    if bad:
        raise BridgeError(f"ask key(s) not allowed in the queue: {', '.join(bad)}; allowed: {', '.join(sorted(ASK_KEYS))}")
    out: dict[str, Any] = {}
    for key in ("platform", "prompt", "mode"):
        val = ask.get(key, "")
        if not isinstance(val, str):
            raise BridgeError(f"ask.{key} must be a string")
        out[key] = val.strip()
    if not out["platform"]:
        raise BridgeError("ask.platform is required (see: python3 -m tools.runner --list)")
    if not out["prompt"]:
        raise BridgeError("ask.prompt is required and must not be blank")
    if len(out["prompt"]) > MAX_PROMPT:
        raise BridgeError(f"ask.prompt is {len(out['prompt'])} chars; the cap is {MAX_PROMPT}")
    for key, (lo, hi) in NUMERIC.items():
        if ask.get(key) not in (None, ""):
            try:
                val = int(ask[key]) if key == "min_px" else float(ask[key])
            except (TypeError, ValueError):
                raise BridgeError(f"ask.{key} must be a number") from None
            out[key] = min(max(val, lo), hi)
    for key in BOOLS:
        if key in ask:
            out[key] = bool(ask[key])
    t["ask"] = out
    return t


def runner_argv(ask: dict, out_dir: Path, python: str, runner_cmd: str = "") -> list[str]:
    """Build the runner invocation. ``=`` form everywhere, so a prompt that starts with a dash
    stays a prompt and argparse never gets to reinterpret it as a flag."""
    argv = [a.replace("{python}", python) for a in (shlex.split(runner_cmd) if runner_cmd else [python, "-m", "tools.runner"])]
    for key in ("platform", "prompt", "mode"):
        if ask.get(key):
            argv.append(f"{ASK_KEYS[key]}={ask[key]}")
    for key in NUMERIC:
        if key in ask:
            argv.append(f"{ASK_KEYS[key]}={ask[key]:g}")
    for key in BOOLS:
        if ask.get(key):
            argv.append(ASK_KEYS[key])
    return argv + [f"--out={out_dir}", "--indent=0"]


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def done_id(name: str) -> str:
    """The task id inside ``tasks/done/<id>/...``. ``parents`` guessing has already cost a bug:
    a result one level deep and an artifact two levels deep must resolve to the same task."""
    parts = Path(name).as_posix().split("/")
    try:
        return parts[parts.index(DONE.split("/")[1]) + 1]
    except ValueError:
        return ""


def host_tag() -> str:
    return f"{_platform.system().lower()}-{socket.gethostname()}"


def endpoint_alive(cdp_url: str = "") -> tuple[bool, str]:
    try:
        info = probe(cdp_url or None)
    except Exception as e:  # Unavailable, URLError, bad JSON — the sentence is the product here
        return False, str(e)
    return True, str(info.get("Browser") or info.get("webSocketDebuggerUrl") or "ok")


def known_platforms() -> set[str]:
    try:
        from tools import adapters

        found: set[str] = set()
        for cat in adapters.catalogue([]):
            found.add(cat["platform"])
            found.update(cat.get("aliases") or [])
        return found
    except Exception:
        return set()


def parse_envelope(stdout: str) -> Optional[dict]:
    """The runner prints exactly one JSON document on stdout. Tolerate a stray line before it."""
    text = (stdout or "").strip()
    for chunk in [text] + [ln.strip() for ln in text.splitlines() if ln.strip().startswith("{")]:
        if not chunk.startswith("{"):
            continue
        try:
            obj = json.loads(chunk)
        except ValueError:
            continue
        if isinstance(obj, dict):
            return obj
    return None


# ------------------------------------------------------------------------------ git plumbing
class Git:
    """Enough git to run a queue, with the two hard parts handled once.

    First, transactions happen in a **disposable detached worktree** under ``.vito-bridge/ws``,
    never in the checkout that asked for them: a queue writer that stages into someone's index
    will eventually commit their half-written file, and a ``reset --hard`` in a busy tree destroys
    work. Second, the commit object is built from a **temporary index** — the paths the task owns
    and nothing else — because a partial ``git commit -- <path>`` refuses a path that has been
    deleted, and a plain ``git commit`` takes everything.
    """

    def __init__(self, repo: Optional[Path] = None, branch: str = "", remote: str = "origin",
                 workspace: Optional[Path] = None):
        self.origin = Path(repo or REPO).resolve()
        self._branch = branch
        self.remote = remote
        self.ref = ""
        self._ws = Path(workspace).resolve() if workspace else self.origin / WORKDIR / "ws"
        self._active = self.origin

    @property
    def repo(self) -> Path:
        """Where commands run: the workspace once it exists, the checkout until then."""
        return self._active

    @property
    def scratch(self) -> Path:
        return self.origin / WORKDIR

    @property
    def branch(self) -> str:
        """The branch we push to, read from the checkout that asked — never from the workspace,
        which is detached by design and would answer ``HEAD``."""
        if not self._branch:
            b = self.run("rev-parse", "--abbrev-ref", "HEAD", cwd=self.origin).stdout.strip()
            if b in ("", "HEAD"):
                raise BridgeError("no branch to push to: pass --branch <name>")
            self._branch = b
        return self._branch

    # -- basics ---------------------------------------------------------------
    def run(self, *args: str, cwd: Optional[Path] = None, env: Optional[dict] = None,
            check: bool = False, binary: bool = False) -> subprocess.CompletedProcess:
        p = subprocess.run(["git", *args], cwd=str(cwd or self.repo), capture_output=True,
                           text=not binary, env=env)
        if binary:
            p.combined = (p.stderr or b"").decode("utf-8", "replace").strip()  # type: ignore[attr-defined]
        else:
            p.combined = ((p.stdout or "") + (p.stderr or "")).strip()  # type: ignore[attr-defined]
        if check and p.returncode:
            raise BridgeError(f"git {' '.join(args)}: {p.combined or 'no output'}")
        return p

    def out(self, *args: str) -> str:
        return self.run(*args, check=True).stdout.strip()

    def identity(self) -> list[str]:
        if self.run("config", "user.email").stdout.strip():
            return []
        return ["-c", "user.name=vito-bridge", "-c", "user.email=vito-bridge@users.noreply.github.com"]

    def ensure_open(self) -> "Git":
        return self if self._active == self._ws and self.ref else self.open()

    # -- the workspace --------------------------------------------------------
    def open(self) -> "Git":
        """Create or reuse the transaction workspace, and align it with the remote. Idempotent."""
        self.run("worktree", "prune")
        marker = self._ws / ".git"
        if not marker.exists():
            self._ws.parent.mkdir(parents=True, exist_ok=True)
            if self._ws.exists():
                shutil.rmtree(self._ws, ignore_errors=True)
            start = self.out("rev-parse", "HEAD")
            p = self.run("worktree", "add", "--detach", "-q", str(self._ws), start, cwd=self.origin)
            if p.returncode:
                raise BridgeError(f"could not create the queue workspace at {self._ws}: {p.combined}")
            got = self.run("config", "--get", f"remote.{self.remote}.url", cwd=self.origin).stdout.strip()
            if got:
                self.run("remote", "set-url", self.remote, got, cwd=self._ws)
        self._active = self._ws
        self.refresh()
        return self

    def refresh(self) -> str:
        """Fetch, hard-align the workspace to the remote head, and drop queue files that the
        remote no longer has. An unborn remote branch is not an error — it is a fresh repo."""
        head = self._fetch()
        if not head:
            self._active = self._ws
            return self.out("rev-parse", "HEAD")
        if head != self.out("rev-parse", "HEAD"):
            self.run("reset", "--hard", "-q", head, check=True)
        self.run("clean", "-q", "-f", "-d", "--", Q)  # ours to own; nothing else lives there
        self.ref = head
        return head

    def _fetch(self) -> str:
        p = self.run("fetch", "-q", "--no-tags", self.remote, self.branch)
        if p.returncode:
            if "couldn't find remote ref" in p.combined or "not found" in p.combined:
                return ""
            raise BridgeError(f"git fetch {self.remote} {self.branch}: {p.combined}")
        return self.run("rev-parse", "FETCH_HEAD").stdout.strip()

    def fetch(self) -> str:
        """Read-side fetch: only moves the ref we read blobs from, never the tree."""
        head = self._fetch()
        if head:
            self.ref = head
        return head

    def read(self, path: str, ref: str = "", dest: Optional[Path] = None) -> Optional[bytes]:
        """A file as it sits on a head that may not be checked out. Bytes, not text: artifacts are
        PNGs and a text decode would quietly destroy them."""
        p = self.run("show", f"{ref or self.ref or 'HEAD'}:{path}", binary=True)
        if p.returncode:
            return None
        data = p.stdout
        if dest is not None:
            dest = Path(dest)
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(data)
        return data

    def read_json(self, path: str, ref: str = "") -> Optional[dict]:
        raw = self.read(path, ref)
        if raw is None:
            return None
        try:
            return json.loads(raw.decode("utf-8", "replace"))
        except ValueError:
            return None

    def list_dir(self, prefix: str, ref: str = "") -> list[str]:
        names = self.run("ls-tree", "-r", "--name-only", ref or self.ref or "HEAD", "--", prefix).stdout.split()
        return sorted(names)

    # -- files ----------------------------------------------------------------
    def write(self, path: str, data: str | bytes) -> Path:
        p = self.repo / path
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(data if isinstance(data, bytes) else data.encode("utf-8"))
        return p

    def copy_in(self, src: Path, path: str) -> Path:
        dest = self.write(path, Path(src).read_bytes())
        shutil.copystat(src, dest)
        return dest

    def drop(self, *paths: str) -> None:
        for path in paths:
            p = self.repo / path
            if p.is_dir():
                shutil.rmtree(p, ignore_errors=True)
            elif p.exists() or p.is_symlink():
                p.unlink()

    # -- the two primitives a queue needs --------------------------------------
    def commit(self, paths: Iterable[str], message: str) -> bool:
        """Commit exactly these paths (deletions included) onto the workspace tip. False when the
        tree would not change, so a retry never produces an empty commit."""
        paths = sorted(set(paths))
        if not paths:
            return False
        for attempt in range(3):
            base = self.out("rev-parse", "HEAD")
            sha = self._plumbing_commit(base, paths, message)
            if not sha:
                return False
            moved = self.run("update-ref", "HEAD", sha, base)
            if moved.returncode == 0:
                # The index was bypassed, so realign it: an index that disagrees with HEAD makes
                # ``git status`` lie and ``git clean`` delete files the new commit still tracks.
                self.run("reset", "-q", "--mixed", sha)
                self.ref = sha
                return True
            time.sleep(0.2 * (attempt + 1))  # tip moved under us; rebuild on the new one
        raise BridgeError(f"could not commit onto {self.branch}: the tip keeps moving mid-write ({self.run('rev-parse', 'HEAD').combined[:160]})")

    def _plumbing_commit(self, base: str, paths: list[str], message: str) -> str:
        import tempfile

        fd, idx = tempfile.mkstemp(prefix="vito-index-", suffix=".idx")
        os.close(fd)
        env = {**os.environ, "GIT_INDEX_FILE": idx}
        try:
            if base and self.run("rev-parse", "--verify", "-q", f"{base}^{{tree}}").returncode == 0:
                if self._git(env, "read-tree", base).returncode:
                    raise BridgeError(f"git read-tree {base[:10]} failed")
            for path in paths:
                if (self.repo / path).exists():
                    self._git(env, "add", "-f", "--", path, check=True)
                else:
                    # A removed *directory* is not a single index entry, and ``--force-remove`` on a
                    # path the base tree does not have is an error worth not making: ask the base
                    # tree which files this path actually covered, and remove exactly those.
                    listing = self.run("ls-tree", "-r", "--name-only", base, "--", path).stdout.split() if base else []
                    for gone in listing:
                        self._git(env, "update-index", "--force-remove", "--", gone)
            tree = self._git(env, "write-tree").stdout.strip()
            if not tree:
                raise BridgeError("git write-tree produced nothing")
            if base and tree == self.run("rev-parse", f"{base}^{{tree}}").stdout.strip():
                return ""  # nothing of ours to say
            args = ["commit-tree", tree] + (["-p", base] if base else []) + ["-m", f"{message} [skip ci]"]
            sha = self._git(env, *args, extra=self.identity()).stdout.strip()
            if not sha:
                raise BridgeError("git commit-tree failed")
            return sha
        finally:
            os.unlink(idx)

    def _git(self, env: dict, *args: str, extra: tuple[str, ...] = (), check: bool = False) -> subprocess.CompletedProcess:
        p = subprocess.run(["git", *(extra or ()), *args], cwd=str(self.repo), capture_output=True, text=True, env=env)
        if check and p.returncode:
            raise BridgeError(f"git {' '.join(args)}: {((p.stdout or '') + (p.stderr or '')).strip()}")
        return p

    def push(self, tries: int = 4) -> bool:
        """Push the workspace tip, re-aligning onto whoever got there first. Our commits only
        ever touch ``tasks/``, so a genuine conflict means two writers edited the same task."""
        last = ""
        for attempt in range(1, tries + 1):
            p = self.run("push", "-q", self.remote, f"HEAD:refs/heads/{self.branch}")
            if p.returncode == 0:
                self.ref = self.out("rev-parse", "HEAD")
                return True
            last = p.combined
            if any(k in last for k in ("non-fast-forward", "fetch first", "stale info", "rejected")):
                time.sleep(0.4 * attempt)
                head = self._fetch()
                if head:
                    rebase = self.run("rebase", head, check=False)
                    if rebase.returncode:
                        self.run("rebase", "--abort")
                        raise BridgeError(
                            f"push rejected and rebasing onto {self.branch} conflicted ({rebase.combined}). "
                            "The queue file is safe inside a commit in the workspace: "
                            f"{self._ws}. Rebase there, push, and the client will pick it up."
                        )
                continue
            break
        raise BridgeError(f"git push: {last or 'rejected for a reason git did not explain'}")

    def close(self) -> None:
        if self._ws.exists():
            self.run("worktree", "remove", "--force", str(self._ws), cwd=self.origin)


# ------------------------------------------------------------------------------ client
class Bridge:
    """The side that asks: write files, push them, wait by fetching."""

    def __init__(self, g: Git, out: Path, cdp_url: str = "", poll: float = 3.0, verbose: bool = True):
        self.g, self.out, self.cdp_url, self.poll, self.verbose = g, Path(out), cdp_url, poll, verbose

    def say(self, msg: str) -> None:
        if self.verbose:
            log(msg)

    @staticmethod
    def pending_path(tid: str) -> str:
        return f"{PENDING}/{tid}.json"

    @staticmethod
    def result_path(tid: str) -> str:
        return f"{DONE}/{tid}/result.json"

    def submit(self, task: dict) -> str:
        self.g.ensure_open()
        path = self.pending_path(task["id"])
        if (self.g.repo / path).exists():
            raise BridgeError(f"{path} already exists in this checkout — reuse nothing, queue a new id")
        self.g.write(path, dump(task))
        if self.g.commit([path], f"bridge: queue {task['id']} ({task['kind']}/{task['ask'].get('platform', '-')})"):
            self.g.push()
        self.say(f"queued {task['id']} → {self.g.remote}/{self.g.branch}")
        return task["id"]

    def state(self, tid: str, ref: str = "") -> str:
        ref = ref or self.g.ref
        if self.g.read(self.result_path(tid), ref) is not None:
            return "done"
        if self.g.read(f"{RUNNING}/{tid}.json", ref) is not None:
            return "running"
        if self.g.read(self.pending_path(tid), ref) is not None:
            return "pending"
        return "gone"

    def cancel(self, tid: str) -> None:
        self.g.ensure_open()
        path = f"{CANCEL}/{tid}.json"
        self.g.write(path, dump({"id": tid, "at": time.time(), "client": host_tag()}))
        if self.g.commit([path], f"bridge: cancel {tid}"):
            self.g.push()
        self.say(f"cancel requested for {tid} — a worker honours it before it starts, not mid-page")

    def status(self, tid: str = "") -> dict:
        ref = self.g.fetch() or "HEAD"
        names = self.g.run("ls-tree", "-r", "--name-only", ref, "--", Q).stdout.split()
        # a name is a task only if it matches the id shape — .gitkeep and any file a human drops in
        # are not tasks, and must never be pruned as if they were
        live = sorted({Path(n).name[:-5] for n in names
                       if n.startswith((PENDING + "/", RUNNING + "/")) and ID_RE.match(Path(n).stem)})
        done = sorted({d for d in (done_id(n) for n in names if n.startswith(DONE + "/")) if ID_RE.match(d)}, reverse=True)
        seen = sorted(set(live) | set(done))
        if tid and tid not in seen:
            raise BridgeError(f"no task {tid} on {self.g.branch} (newest first: {', '.join(seen[-8:]) or 'none yet'})")
        hb = self.g.read_json(HEARTBEAT, ref) or {}
        return {
            "ok": True,
            "branch": self.g.branch,
            "head": ref[:10],
            "workers": 1 if hb else 0,
            "heartbeat": hb,
            "heartbeat_age": round(time.time() - float(hb["epoch"]), 1) if hb.get("epoch") else None,
            "tasks": {i: self.state(i, ref) for i in ([tid] if tid else seen)},
        }

    # -- waiting --------------------------------------------------------------
    def wait(self, tid: str, timeout: float = 900.0) -> dict:
        started, deadline, next_poll = time.time(), time.time() + timeout, 0.0
        warned, poll = False, max(0.1, self.poll)
        while True:
            remaining = deadline - time.time()
            if remaining <= 0:
                break
            if time.time() >= next_poll:
                ref = self.g.fetch()
                if ref:
                    raw = self.g.read(self.result_path(tid), ref)
                    if raw is not None:
                        return self.ingest(json.loads(raw.decode("utf-8", "replace")), tid, ref, time.time() - started)
                    if not warned and time.time() - started > 90:
                        warned = True
                        self.say(self.stall_note(tid, ref, time.time() - started))
                poll = min(poll * 1.6, 15.0)
                next_poll = time.time() + min(poll, max(0.1, deadline - time.time()))
            time.sleep(0.2)
        raise BridgeError(
            f"task {tid} did not finish within {timeout:.0f}s (state: {self.state(tid)}). "
            + self.stall_note(tid, self.g.ref, timeout)
        )

    def stall_note(self, tid: str, ref: str, waited: float) -> str:
        hb = self.g.read_json(HEARTBEAT, ref) or {}
        pending = self.g.read_json(self.pending_path(tid), ref) or {}
        age = round(time.time() - float(hb["epoch"]), 0) if hb.get("epoch") else None
        if not hb:
            return ("nobody has ever written " + HEARTBEAT + " on this branch: start a worker on the "
                    "machine with the browser — python3 tools/gh_bridge.py worker")
        if age is not None and age > 180:
            return (f"the last heartbeat (host {hb.get('host')}, env {hb.get('env')}) is {age:.0f}s old: the worker "
                    "is stopped or offline. Restart it, then: python3 tools/gh_bridge.py status " + tid)
        return (f"worker {hb.get('host')} is alive (idle {hb.get('idle')}s, env {hb.get('env')}, cdp_alive "
                f"{hb.get('cdp_alive')}) and has not taken {tid} — this task wants env "
                f"{pending.get('env', 'local')}. Match it (--env any to take everything) or check the endpoint")

    def ingest(self, result: dict, tid: str, ref: str, waited: float) -> dict:
        out = self.out / tid
        out.mkdir(parents=True, exist_ok=True)
        files, total = [], 0
        for art in result.get("artifacts", []):
            name = art.get("name") or ""
            if not name or name.startswith(("/", "..")) or ".." in Path(name).parts:
                files.append({**art, "error": "unsafe name in result index, skipped"})
                continue
            data = self.g.read(f"{DONE}/{tid}/artifacts/{name}", ref)
            if data is None:
                files.append({**art, "error": "not on the branch — pruned mid-flight?"})
                continue
            want = art.get("sha256", "")
            if want and hashlib.sha256(data).hexdigest() != want:
                raise BridgeError(f"{name}: sha256 mismatch after the transfer")
            dest = out / name
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(data)
            total += len(data)
            files.append({**art, "path": str(dest), "bytes": len(data)})
        runner_env = result.get("runner") or {}
        return {
            "ok": result.get("status") == "ok",
            "platform": result.get("platform") or runner_env.get("platform"),
            "exit_code": int(result.get("exit_code", 0)),
            "seconds": result.get("timings", {}).get("seconds", runner_env.get("seconds")),
            "bytes": total,
            "artifacts": files,
            "skipped": result.get("skipped") or [],
            "error": result.get("error") or runner_env.get("error"),
            "bridge": {
                "task": tid,
                "ref": f"{DONE}/{tid}",
                "env": result.get("env"),
                "waited": round(waited, 1),
                "worker": result.get("worker"),
                "chrome": result.get("chrome"),
            },
        }

    # -- one call for the agent: local when it can be, the queue when it cannot --
    def ask(self, task: dict, wait: bool = True, timeout: float = 900.0, local: Optional[bool] = None,
             runner_cmd: str = "", python: str = "") -> dict:
        if task.get("kind") == "ping":
            # The question is whether the *worker* can see a browser, which is a fact about the
            # other machine. Asking it of ourselves would only tell us about ours.
            local = False
        if local is None:
            alive, detail = endpoint_alive(self.cdp_url)
            self.say(f"{resolve(self.cdp_url or None)}: {detail}")
            local = alive
        if local:
            env = self.run_local(task, runner_cmd=runner_cmd, python=python)
            if int(env.get("exit_code", 0)) != EXIT["env"]:
                env["bridge"] = {"task": None, "via": "local"}
                return env
            self.say("nothing to attach to locally — routing through the queue instead")
        tid = self.submit(task)
        if not wait:
            return {"ok": True, "queued": True, "task": tid, "ref": self.pending_path(tid),
                    "resume": f"python3 tools/gh_bridge.py wait {tid}"}
        return self.wait(tid, timeout)

    def run_local(self, task: dict, runner_cmd: str = "", python: str = "") -> dict:
        """The same envelope with no git involved — for a machine that really can reach the
        endpoint. A local run that fails for environment reasons is what makes ``ask`` fall back."""
        ask = dict(task.get("ask") or {})
        ask.setdefault("platform", "gemini")
        out = self.out / task["id"]
        out.mkdir(parents=True, exist_ok=True)
        argv = runner_argv(ask, out, python or sys.executable, runner_cmd)
        if self.cdp_url:
            argv.append(f"--cdp-url={self.cdp_url}")
        t0 = time.time()
        p = subprocess.run(argv, cwd=str(self.g.origin), capture_output=True, text=True)
        env = parse_envelope(p.stdout) or {"ok": False, "error": (p.stderr or p.stdout or "the runner printed nothing").strip()[-1500:]}
        env.setdefault("exit_code", p.returncode)
        env["exit_code"] = p.returncode
        env["seconds"] = round(time.time() - t0, 1)
        env["artifacts"] = [
            {"name": f.relative_to(out).as_posix(), "path": str(f), "bytes": f.stat().st_size,
             "kind": f.suffix.lstrip(".").lower() or "file"}
            for f in sorted(out.rglob("*")) if f.is_file()
        ]
        return env


# ------------------------------------------------------------------------------ worker
class Worker:
    """The side that owns the browser: poll, claim, run, push. No inbound anything."""

    def __init__(self, g: Git, cfg: argparse.Namespace):
        self.g, self.cfg = g, cfg
        self.env = cfg.env
        self.interval = max(0.2, cfg.interval)
        self.total = 0
        self.idle = 0.0
        self.last_hb = 0.0
        self.max_artifact = int(getattr(cfg, "max_artifact_mb", 0) or 0) * 1024 * 1024 or MAX_ARTIFACT
        self.allow = {p.strip() for p in (cfg.allow or "").split(",") if p.strip()} or None
        self.chrome: dict[str, Any] = {"launched": False, "detail": "not checked"}

    # -- browser --------------------------------------------------------------
    def ensure_chrome(self) -> bool:
        alive, detail = endpoint_alive(self.cfg.cdp_url)
        self.chrome = {"launched": False, "detail": detail, "endpoint": resolve(self.cfg.cdp_url or None)}
        if alive or not self.cfg.launch_chrome:
            if not alive:
                log(f"cdp: {detail}")
            return alive
        exe = self.chrome_binary()
        if not exe:
            log("no Chrome found: set CHROME_PATH, start one yourself with --remote-debugging-port, "
                "or run this worker with --no-launch-chrome")
            return False
        profile = Path(self.cfg.profile).expanduser()
        profile.mkdir(parents=True, exist_ok=True)
        fresh = not (profile / "Default" / "Cookies").exists()
        port = urlsplit(resolve(self.cfg.cdp_url or None)).port or 9222
        argv = [
            exe,
            f"--user-data-dir={profile}",
            f"--remote-debugging-port={port}",
            "--remote-debugging-address=127.0.0.1",
            "--no-first-run",
            "--no-default-browser-check",
            "--disable-backgrounding-occluded-windows",
            "--disable-features=Translate",
        ] + (["--headless=new"] if self.cfg.headless else []) + ["about:blank"]
        logfile = Path(str(profile) + ".cdp.log")
        log(f"launching {Path(exe).name}: profile {profile}, port {port}, "
            f"{'headless' if self.cfg.headless else 'visible'}")
        with logfile.open("ab") as fh:
            subprocess.Popen(argv, stdout=fh, stderr=fh, start_new_session=True, cwd=str(profile.parent))
        deadline = time.time() + float(self.cfg.launch_wait)
        while time.time() < deadline:
            alive, detail = endpoint_alive(self.cfg.cdp_url)
            if alive:
                self.chrome = {"launched": True, "detail": detail, "endpoint": resolve(self.cfg.cdp_url or None), "log": str(logfile)}
                if fresh:
                    log(f"profile {profile} holds no cookies yet — sign in once with "
                        "python3 tools/gh_bridge.py worker --visible, then Ctrl-C")
                return True
            time.sleep(0.4)
        self.chrome = {"launched": True, "detail": f"started, but {resolve(self.cfg.cdp_url or None)} never answered", "endpoint": resolve(self.cfg.cdp_url or None), "log": str(logfile)}
        log(f"{self.chrome['detail']} — the last lines are in {logfile}")
        return False

    @staticmethod
    def chrome_binary() -> str:
        env = os.environ.get("CHROME_PATH", "")
        if env and Path(env).exists():
            return env
        cands = {
            "Darwin": ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
                       "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
                       "/Applications/Chromium.app/Contents/MacOS/Chromium"],
            "Linux": ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable",
                      "/opt/google/chrome/chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"],
            "Windows": [os.path.expandvars(r"%ProgramFiles%\Google\Chrome\Application\chrome.exe"),
                        os.path.expandvars(r"%LocalAppData%\Google\Chrome\Application\chrome.exe")],
        }.get(_platform.system(), [])
        for cand in cands:
            if Path(cand).exists():
                return cand
        for name in ("google-chrome", "google-chrome-stable", "chromium", "chrome"):
            found = shutil.which(name)
            if found:
                return found
        return ""

    # -- loop -----------------------------------------------------------------
    def run_forever(self) -> int:
        allow = ",".join(sorted(self.allow)) if self.allow else "all installed"
        log(f"worker on {self.g.branch} (env={self.env}, cdp={resolve(self.cfg.cdp_url or None)}, allow={allow}, "
            f"once={bool(self.cfg.once)}, dry_run={bool(self.cfg.dry_run)})")
        if not self.cfg.dry_run:
            self.ensure_chrome()
        self.g.ensure_open()
        empty = 0
        while True:
            ran = self.tick()
            if self.cfg.once:
                return 0
            if ran:
                empty = 0
            else:
                empty += 1
                self.idle += self.interval
                if self.cfg.idle_exit and empty * self.interval >= self.cfg.idle_exit:
                    log(f"nothing to do for {self.cfg.idle_exit:g}s — exiting")
                    return 0
            self.heartbeat()
            time.sleep(self.interval)

    def pending(self) -> list[str]:
        """Pending ids, oldest first (the id starts with a millisecond clock). A task that already
        has a result is not pending, whatever the working tree says — that is what makes a retry
        safe and a half-finished prune harmless."""
        base = self.g.repo / PENDING
        found = sorted(p.stem for p in base.glob("*.json")) if base.is_dir() else []
        return [tid for tid in found if ID_RE.match(tid) and not (self.g.repo / Bridge.result_path(tid)).exists()]

    def tick(self) -> bool:
        self.g.ensure_open()
        self.g.refresh()
        took = False
        for tid in self.pending():
            raw = self.g.repo / Bridge.pending_path(tid)
            if not raw.exists():
                continue
            try:
                task = validate_task(json.loads(raw.read_text(encoding="utf-8")))
                task["id"] = tid  # the filename is the identity, always
            except (BridgeError, ValueError) as e:
                self.reject(tid, f"malformed task: {e}")
                took = True
                continue
            if not self.wants(task):
                continue
            if self.cfg.dry_run:
                log(f"would run {tid} ({task['env']}/{task['ask'].get('platform', '-')})")
                took = True
                continue
            if not self.claim(task):
                continue
            self.execute(task)
            self.total += 1
            self.idle = 0.0
            took = True
            if self.cfg.max_tasks and self.total >= self.cfg.max_tasks:
                break
        return took

    def wants(self, task: dict) -> bool:
        return self.env == "any" or task.get("env") in (self.env, "any")

    def claim(self, task: dict) -> bool:
        """Take the task in public. Pushing the claim before doing the work is the point: two
        workers, one task, and the loser sees it and moves on."""
        tid = task["id"]
        if (self.g.repo / f"{CANCEL}/{tid}.json").exists():
            self.finish(tid, {"status": "cancelled", "exit_code": EXIT["bridge"], "error": "cancelled before it started"}, task)
            return False
        paths = [f"{RUNNING}/{tid}.json", Bridge.pending_path(tid)]
        self.g.write(paths[0], dump({"claim": {"host": host_tag(), "pid": os.getpid(), "at": time.time(), "env": self.env}, "task": task}))
        self.g.drop(paths[1])
        if not self.g.commit(paths, f"bridge: claim {tid}"):
            return False
        try:
            self.g.push()
        except BridgeError as e:
            log(f"could not publish the claim: {e}")
            self.g.drop(paths[0])
            return False
        self.g.refresh()
        if not (self.g.repo / paths[0]).exists():  # someone beat me to it after my push
            return False
        return True

    def reject(self, tid: str, message: str) -> None:
        """A task we will not run still gets an answer. Silence is the worst failure mode."""
        log(f"rejecting {tid}: {message}")
        self.finish(tid, {"status": "rejected", "exit_code": EXIT["usage"], "error": message}, {"id": tid})

    def refuse(self, tid: str, message: str, task: dict, code: int = EXIT["usage"]) -> None:
        log(f"{tid}: {message}")
        self.finish(tid, {"status": "rejected", "exit_code": code, "error": message}, task)

    # -- the work -------------------------------------------------------------
    def execute(self, task: dict) -> None:
        tid, kind = task["id"], task.get("kind", "ask")
        if kind == "ping":
            alive, detail = endpoint_alive(self.cfg.cdp_url)
            self.finish(tid, {"status": "ok" if alive else "error", "exit_code": EXIT["ok"] if alive else EXIT["env"],
                              "error": None if alive else detail, "ping": {"alive": alive, "browser": detail,
                              "endpoint": resolve(self.cfg.cdp_url or None)}}, task)
            return
        ask = dict(task["ask"])
        name = ask.get("platform", "")
        known = known_platforms()
        if known and name not in known:
            self.refuse(tid, f"platform {name!r} is not installed here (have: {', '.join(sorted(known))})", task)
            return
        if self.allow and name not in self.allow:
            self.refuse(tid, f"platform {name!r} is not in this worker's --allow list", task)
            return
        if self.cfg.check_endpoint and not self.ensure_chrome():
            self.finish(tid, {"status": "error", "exit_code": EXIT["env"],
                              "error": f"no CDP endpoint at {resolve(self.cfg.cdp_url or None)}: {self.chrome.get('detail')}"}, task)
            return
        art_dir = self.g.scratch / "work" / tid / "artifacts"
        shutil.rmtree(art_dir.parent, ignore_errors=True)
        art_dir.mkdir(parents=True, exist_ok=True)
        argv = runner_argv(ask, art_dir, self.cfg.python, self.cfg.runner_cmd)
        if self.cfg.cdp_url:
            argv.append(f"--cdp-url={self.cfg.cdp_url}")
        budget = float(ask.get("timeout", 240.0)) + 120.0
        log(f"{tid}: $ {' '.join(a if len(a) < 68 else a[:65] + '...' for a in argv[1:])}")
        t0 = time.time()
        try:
            p = subprocess.run(argv, cwd=str(self.g.origin), capture_output=True, text=True, timeout=budget)
            env = parse_envelope(p.stdout) or {"ok": False, "error": (p.stderr or p.stdout or "the runner printed nothing").strip()[-1500:]}
            code = p.returncode
        except subprocess.TimeoutExpired:
            env, code = {"ok": False, "error": f"the runner was killed after its {budget:.0f}s budget"}, EXIT["timeout"]
        except OSError as e:
            env, code = {"ok": False, "error": f"could not start the runner: {e}"}, EXIT["env"]
        env["seconds"] = round(time.time() - t0, 1)
        env.setdefault("platform", name)
        by_name = {Path(a["path"]).name: a for a in (env.get("artifacts") or []) if isinstance(a, dict) and a.get("path")}
        arts, skipped, total = [], [], 0
        dest_root = self.g.repo / DONE / tid / "artifacts"
        shutil.rmtree(self.g.repo / DONE / tid, ignore_errors=True)
        dest_root.mkdir(parents=True, exist_ok=True)
        for f in sorted(art_dir.rglob("*")):
            if not f.is_file():
                continue
            rel = f.relative_to(art_dir).as_posix()
            size = f.stat().st_size
            if size > self.max_artifact or total + size > MAX_TOTAL:
                skipped.append({"name": rel, "bytes": size, "why": f"over the {self.max_artifact // (1024 * 1024)} MB cap"})
                continue
            total += size
            staged = self.g.copy_in(f, f"{DONE}/{tid}/artifacts/{rel}")
            meta = by_name.get(f.name, {})
            arts.append({"name": rel, "bytes": size, "sha256": sha256(staged),
                         "kind": meta.get("kind") or (f.suffix.lstrip(".").lower() or "file"),
                         "how": meta.get("how")})
        result = {
            "id": tid,
            "status": "ok" if env.get("ok") else "error",
            "exit_code": int(env.get("exit_code", code)),
            "error": env.get("error"),
            "env": task["env"],
            "kind": task["kind"],
            "platform": name,
            "worker": {"host": host_tag(), "pid": os.getpid(), "python": sys.version.split()[0],
                       "endpoint": resolve(self.cfg.cdp_url or None)},
            "chrome": self.chrome,
            "runner": env,
            "artifacts": arts,
            "skipped": skipped,
            "timings": {"queued_at": task.get("created_at"), "started_at": t0, "finished_at": time.time(),
                        "seconds": round(time.time() - t0, 1)},
        }
        self.finish_result(tid, result, arts, extra=[Bridge.pending_path(tid), f"{RUNNING}/{tid}.json", f"{CANCEL}/{tid}.json"])
        shutil.rmtree(art_dir.parent, ignore_errors=True)
        log(f"{tid}: {result['status']}, {len(arts)} file(s) in {result['timings']['seconds']}s"
            + (f" — {result['error']}" if result.get("error") else ""))

    def finish(self, tid: str, result: dict, task: dict) -> None:
        result.setdefault("id", tid)
        result.setdefault("worker", {"host": host_tag(), "pid": os.getpid()})
        result.setdefault("chrome", self.chrome)
        result.setdefault("env", task.get("env"))
        result.setdefault("kind", task.get("kind", "ask"))
        result.setdefault("artifacts", [])
        result.setdefault("timings", {"queued_at": task.get("created_at"), "finished_at": time.time()})
        self.finish_result(tid, result, [], extra=[Bridge.pending_path(tid), f"{RUNNING}/{tid}.json", f"{CANCEL}/{tid}.json"])

    def finish_result(self, tid: str, result: dict, arts: list[dict], extra: Iterable[str] = ()) -> None:
        bookkeeping = [Bridge.pending_path(tid), f"{RUNNING}/{tid}.json", f"{CANCEL}/{tid}.json", *extra]
        self.g.drop(*bookkeeping)  # a result means the request, the claim and the cancel are spent
        paths = [Bridge.result_path(tid)] + [f"{DONE}/{tid}/artifacts/{a['name']}" for a in arts] + sorted(set(bookkeeping))
        self.g.write(Bridge.result_path(tid), dump(result))
        if self.g.commit(paths, f"bridge: {result.get('status', 'done')} {tid}"):
            try:
                self.g.push()
            except BridgeError as e:
                log(f"the result is committed but not pushed: {e}")

    # -- liveness -------------------------------------------------------------
    def heartbeat(self, force: bool = False) -> None:
        step = float(self.cfg.heartbeat or 0)
        if step <= 0 or (not force and time.time() - self.last_hb < step):
            return
        self.last_hb = time.time()
        alive, detail = endpoint_alive(self.cfg.cdp_url)
        self.g.write(HEARTBEAT, dump({
            "epoch": self.last_hb, "at": time.strftime("%Y-%m-%dT%H:%M:%S"), "host": host_tag(),
            "pid": os.getpid(), "env": self.env, "interval": step, "idle": round(self.idle, 1),
            "done_total": self.total, "cdp": resolve(self.cfg.cdp_url or None), "cdp_alive": alive,
            "cdp_detail": str(detail)[:200], "python": sys.version.split()[0],
        }))
        if self.g.commit([HEARTBEAT], f"bridge: heartbeat {host_tag()}"):
            try:
                self.g.push()
            except BridgeError:
                self.last_hb = 0.0  # lose the beat rather than the file


# ------------------------------------------------------------------------------ housekeeping
def prune(g: Git, keep: int, apply: bool) -> dict:
    """Old results are the reason this repo would stop being cloneable. Keep the newest ``keep``."""
    g.ensure_open()
    ref = g.refresh() or "HEAD"
    names = g.run("ls-tree", "-r", "--name-only", ref, "--", DONE).stdout.split()
    ids = sorted({d for d in (done_id(n) for n in names) if ID_RE.match(d)}, reverse=True)
    stale = ids[keep:] if keep > 0 else ids
    if not stale:
        return {"ok": True, "removed": 0, "kept": ids[:keep], "committed": False}
    if not apply:
        return {"ok": True, "dry_run": True, "count": len(stale), "would_remove": stale[:40], "kept": ids[:keep]}
    touched: list[str] = []
    for tid in stale:
        g.drop(f"{DONE}/{tid}", f"{CANCEL}/{tid}.json")
        touched += [f"{DONE}/{tid}", f"{CANCEL}/{tid}.json"]
    if (g.repo / CANCEL).is_dir():
        for path in sorted((g.repo / CANCEL).glob("*.json")):
            g.drop(f"{CANCEL}/{path.name}")
            touched.append(f"{CANCEL}/{path.name}")
    changed = g.commit(touched, f"bridge: prune {len(stale)} done task(s)")
    if changed:
        g.push()
    if (g.scratch / "work").is_dir():
        shutil.rmtree(g.scratch / "work", ignore_errors=True)
    return {"ok": True, "removed": len(stale), "kept": ids[:keep], "committed": changed}


# ------------------------------------------------------------------------------ self-check
def self_check() -> int:
    """Prove the queue with no network, no browser, no GitHub: a temp bare remote, two clones, a
    stub for the runner. Every invariant below is one a real run would have paid for."""
    checks: list[tuple[str, bool, str]] = []

    def check(name: str, ok: bool, detail: Any = "") -> None:
        checks.append((name, bool(ok), str(detail)))

    try:
        t = validate_task({"kind": "ask", "env": "local", "ask": {"platform": "gemini", "prompt": "بورتريه"}})
        check("schema: a normal ask validates", t["kind"] == "ask" and ID_RE.match(t["id"]) is not None, t["id"])
        check("schema: non-ascii prompts survive", t["ask"]["prompt"] == "بورتريه")
        for payload, why in (
            ({"ask": {"platform": "gemini", "prompt": "x", "out": "/etc"}}, "schema: rejects an smuggled --out"),
            ({"ask": {"platform": "gemini", "prompt": "x", "adapters": "/tmp"}}, "schema: rejects --adapters"),
            ({"ask": {"platform": "gemini", "prompt": "x"}, "cmd": "rm -rf"}, "schema: rejects unknown top keys"),
            ({"kind": "shell", "ask": {"platform": "g", "prompt": "p"}}, "schema: rejects an invented kind"),
            ({"env": "production", "ask": {"platform": "g", "prompt": "p"}}, "schema: rejects an unknown env"),
            ({"ask": {"platform": "gemini", "prompt": "   "}}, "schema: rejects a blank prompt"),
            ({"ask": {"platform": "gemini"}}, "schema: rejects a promptless ask"),
            ({"id": "1-x/../../y", "kind": "ping"}, "schema: rejects path traversal in the id"),
            ({"ask": {"platform": "gemini", "prompt": "x", "timeout": "soon"}}, "schema: rejects a non-numeric timeout"),
        ):
            try:
                validate_task(payload)
                check(why, False, "accepted; it should not have been")
            except BridgeError as e:
                check(why, True, e)
        argv = runner_argv({"platform": "gemini", "prompt": "-rf /", "mode": "image", "timeout": 60.0, "raw": True}, Path("/tmp/o"), "py3")
        check("argv: = form keeps a leading dash as data", "--prompt=-rf /" in argv, " ".join(argv))
        check("argv: numbers and booleans land", "--timeout=60" in argv and "--raw" in argv)
        check("argv: the worker owns --out", "--out=/tmp/o" in argv and "--cdp-url" not in " ".join(argv))
        check("slug: unicode collapses, ascii survives", slugify("مرحبا بالعالم") == "task" and slugify("Hero Shot 35mm!") == "hero-shot-35mm")
        check("envelope: one JSON doc, stray line tolerated", parse_envelope("noise\n" + json.dumps({"ok": True, "exit_code": 0}) + "\n") == {"ok": True, "exit_code": 0})
    except Exception as e:
        check("schema: no exception", False, f"{type(e).__name__}: {e}")

    tmp: Optional[Path] = None
    try:
        import tempfile

        tmp = Path(tempfile.mkdtemp(prefix="vito-bridge-"))
        bare = tmp / "remote.git"
        subprocess.run(["git", "init", "-q", "--bare", str(bare)], check=True)
        seed = tmp / "seed"
        subprocess.run(["git", "clone", "-q", str(bare), str(seed)], check=True)
        for wt in (seed,):
            subprocess.run(["git", "config", "user.email", "t@example.invalid"], cwd=str(wt), check=True)
            subprocess.run(["git", "config", "user.name", "t"], cwd=str(wt), check=True)
        (seed / "readme.md").write_text("bridge fixture\n")
        subprocess.run(["git", "add", "-A"], cwd=str(seed), check=True)
        subprocess.run(["git", "commit", "-q", "-m", "seed"], cwd=str(seed), check=True)
        br = subprocess.run(["git", "rev-parse", "--abbrev-ref", "HEAD"], cwd=str(seed), capture_output=True, text=True).stdout.strip()
        subprocess.run(["git", "push", "-q", "-u", "origin", f"HEAD:{br}"], cwd=str(seed), check=True)
        worktrees = {}
        for role in ("client", "worker"):
            wt = tmp / role
            subprocess.run(["git", "clone", "-q", str(bare), str(wt)], check=True)
            subprocess.run(["git", "config", "user.email", "t@example.invalid"], cwd=str(wt), check=True)
            subprocess.run(["git", "config", "user.name", "t"], cwd=str(wt), check=True)
            (wt / "notes.txt").write_text("uncommitted local work that the bridge must not touch\n")
            worktrees[role] = wt
        stub = tmp / "stub.py"
        stub.write_text(
            "import json, pathlib, sys\n"
            "out = pathlib.Path([a for a in sys.argv if a.startswith('--out=')][0].split('=', 1)[1])\n"
            "(out / 'img.png').write_bytes(b'\\x89PNG\\r\\n\\x1a\\nBYTES')\n"
            "(out / 'answer.md').write_text('# settled\\n')\n"
            "print(json.dumps({'ok': True, 'platform': 'gemini', 'exit_code': 0, 'seconds': 0.1,\n"
            "  'artifacts': [{'path': str(out / 'img.png'), 'kind': 'image', 'how': 'download'}]}))\n"
        )
        from http.server import BaseHTTPRequestHandler, HTTPServer

        class StubDevTools(BaseHTTPRequestHandler):
            def do_GET(self) -> None:  # noqa: N802
                body = json.dumps({"Browser": "StubChrome/1.0",
                                   "webSocketDebuggerUrl": "ws://127.0.0.1/devtools/browser/stub"}).encode()
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

            def log_message(self, *a: Any) -> None:
                pass

        import threading

        srv = HTTPServer(("127.0.0.1", 0), StubDevTools)
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        gc = Git(repo=worktrees["client"], branch=br)
        gw = Git(repo=worktrees["worker"], branch=br)
        base_cfg = dict(env="local", once=True, interval=0.05, dry_run=False, max_tasks=0, allow="",
                        cdp_url=f"http://127.0.0.1:{srv.server_address[1]}", launch_chrome=False, headless=True,
                        profile=str(tmp / "profile"), heartbeat=0.05, python=sys.executable,
                        runner_cmd=f"{sys.executable} {stub}", idle_exit=0.0, max_artifact_mb=0,
                        check_endpoint=True)
        w = Worker(gw, argparse.Namespace(**base_cfg))
        b = Bridge(gc, tmp / "delivered", poll=0.05, verbose=False)

        task = validate_task({"env": "local", "ask": {"platform": "gemini", "prompt": "مرحبا"}})
        b.submit(task)
        check("queue: submit reaches the remote", (b.state(task["id"], gc.fetch() or "HEAD")) == "pending", task["id"])
        check("queue: the client's own dirty file stays uncommitted",
              "notes.txt" not in gc.run("show", "--stat", "--name-only", "--format=", "HEAD").stdout)
        check("worker: takes a matching task", w.tick() is True)
        res = gw.read_json(Bridge.result_path(task["id"])) or {}
        check("worker: publishes a result", res.get("status") == "ok", json.dumps(res)[:200])
        check("worker: pending and running are cleared",
              not (gw.repo / Bridge.pending_path(task["id"])).exists() and not (gw.repo / f"{RUNNING}/{task['id']}").exists())
        check("result: indexes both artifacts", sorted(a["name"] for a in res.get("artifacts", [])) == ["answer.md", "img.png"], str([a["name"] for a in res.get("artifacts", [])]))
        check("result: every artifact is hashed", all(len(a.get("sha256", "")) == 64 for a in res.get("artifacts", [])))
        check("endpoint: the worker attached to the live stub instead of launching a browser",
              res.get("chrome", {}).get("launched") is False and "StubChrome" in str(res.get("chrome", {}).get("detail")), json.dumps(res.get("chrome"))[:200])
        check("result: inherits the runner's kind/how",
              [a for a in res.get("artifacts", []) if a["name"] == "img.png"][0].get("how") == "download")
        ref = gc.fetch()
        env = b.ingest(res, task["id"], ref, 0.2)
        delivered = sorted(p.name for p in (tmp / "delivered" / task["id"]).iterdir())
        check("client: verifies and extracts the bytes", delivered == ["answer.md", "img.png"] and env["ok"], str(delivered))
        check("client: png bytes survive the transfer exactly",
              (tmp / "delivered" / task["id"] / "img.png").read_bytes() == b"\x89PNG\r\n\x1a\nBYTES")
        check("client: envelope carries exit code and ref", env["exit_code"] == 0 and env["bridge"]["ref"].endswith(task["id"]))
        check("client: --out dir of the worker never reaches git",
              WORKDIR not in " ".join(gw.run("status", "--porcelain").stdout.split()))
        check("client: state is done", b.state(task["id"], ref) == "done")
        human_state = Git(repo=worktrees["worker"], branch=br).run("status", "--porcelain").stdout.splitlines()
        check("the operator's checkout is untouched: their file is still just theirs, nothing staged",
              "?? notes.txt" in human_state and not any("tasks/" in l for l in human_state)
              and not any(l[:1] in "ARDM" for l in human_state), " | ".join(human_state)[:160])
        check("and the queue never materialised in their tree", not (worktrees["worker"] / PENDING).exists())
        w.heartbeat(force=True)
        hb = gc.read_json(HEARTBEAT, gc.fetch()) or {}
        check("heartbeat: visible to the client, with env and liveness", hb.get("env") == "local" and "epoch" in hb, json.dumps(hb)[:150])

        second = validate_task({"env": "local", "ask": {"platform": "gemini", "prompt": "second"}})
        b.submit(second)
        b.cancel(second["id"])
        w.tick()
        r2 = gw.read_json(Bridge.result_path(second["id"])) or {}
        check("cancel: recorded as cancelled and never run", r2.get("status") == "cancelled", json.dumps(r2)[:150])
        check("cancel: the pending file is gone", not (gw.repo / Bridge.pending_path(second["id"])).exists())

        hosted = validate_task({"env": "hosted", "ask": {"platform": "chatgpt", "prompt": "third"}})
        b.submit(hosted)
        w.tick()
        still = (b.state(hosted["id"], gc.fetch() or "HEAD") == "pending")
        check("env: a local worker leaves a hosted task alone", still)
        w2 = Worker(gw, argparse.Namespace(**{**base_cfg, "env": "hosted", "max_tasks": 1}))
        check("env: a hosted worker takes it", w2.tick() is True)
        bad = validate_task({"env": "any", "ask": {"platform": "nosuch", "prompt": "x"}})
        b.submit(bad)
        Worker(gw, argparse.Namespace(**{**base_cfg, "env": "any", "once": True})).tick()
        r3 = gw.read_json(Bridge.result_path(bad["id"])) or {}
        check("platform: an unknown adapter is refused with a message", r3.get("status") == "rejected" and "nosuch" in str(r3.get("error")), json.dumps(r3)[:180])
        b2_path = tmp / "junk.json"
        b2_path.write_text("{not json")
        (gc.repo / PENDING).mkdir(parents=True, exist_ok=True)
        shutil.copy(b2_path, gc.repo / f"{PENDING}/{task['id']}-junk.json")  # invalid id on purpose
        gc.commit([f"{PENDING}/{task['id']}-junk.json"], "bridge: junk")
        gc.push()
        Worker(gw, argparse.Namespace(**{**base_cfg, "once": True, "max_tasks": 0})).tick()
        r4 = gw.read_json(Bridge.result_path(f"{task['id']}-junk")) or {}
        check("junk: an unparseable queue file is answered, not swallowed",
              r4.get("status") == "rejected" and "malformed" in str(r4.get("error")), json.dumps(r4)[:220])
        check("junk: the file that could not be parsed is cleared so it cannot loop",
              not (gw.repo / f"{PENDING}/{task['id']}-junk.json").exists())
        (gc.repo / PENDING).mkdir(parents=True, exist_ok=True)
        (gc.repo / f"{PENDING}/README.md").write_text("not a task\n")
        gc.commit([f"{PENDING}/README.md"], "bridge: stray file in the queue dir")
        gc.push()
        Worker(gw, argparse.Namespace(**{**base_cfg, "once": True})).tick()
        check("junk: a name that cannot be an id is left for a human, unharmed",
              (gw.repo / f"{PENDING}/README.md").exists() and not gw.read_json(Bridge.result_path("README")))
        def done_ids(git: Git) -> list[str]:
            names = git.run("ls-tree", "-r", "--name-only", git.ref or "HEAD", "--", DONE).stdout.split()
            return sorted({d for d in (done_id(n) for n in names) if ID_RE.match(d)}, reverse=True)

        check("housekeeping: .gitkeep is not a task and never becomes one",
              ".gitkeep" not in b.status().get("tasks", {}) and not (gw.repo / PENDING / "x.json").exists())

        p = prune(gw, 1, False)
        check("prune: dry run counts before touching anything", p.get("dry_run") and p.get("count", 0) >= 1 and len(done_ids(gw)) > 1, json.dumps(p)[:160])
        keep = done_ids(gw)
        pr = prune(gw, 1, True)
        gc.fetch()
        after = done_ids(gc)
        check("prune: applies and pushes", pr.get("removed", 0) >= 1 and len(after) < len(keep), f"{len(keep)}→{len(after)}")
        check("prune: keeps the newest result only", after == keep[:1], f"{after} vs {keep[:1]}")
        check("schema: a task file never names a command",
              all(k in ASK_KEYS for k in validate_task({"ask": {"platform": "g", "prompt": "p"}})["ask"]))
        wargs = vars(build_parser().parse_args(["worker", "--once"]))
        code = [ln for ln in Path(__file__).read_text(encoding="utf-8").splitlines() if "``" not in ln]
        reads = {m for ln in code for m in re.findall(r"self\.cfg\.([a-z_][a-z_0-9]*)", ln)}
        check("cli: every flag the worker reads exists (and vice versa)",
              not reads - set(wargs), f"missing: {', '.join(sorted(reads - set(wargs))) or 'none'}")
        check("cli: no flag the worker reads is undocumented or hidden",
              all(wargs.get(k) is not None or k.startswith("no_") for k in reads), "")
        ping = validate_task({"env": "local", "kind": "ping", "note": "are you there"})
        ping["kind"] = "ping"
        b.submit(ping)
        Worker(gw, argparse.Namespace(**{**base_cfg, "once": True})).tick()
        pr_res = gw.read_json(Bridge.result_path(ping["id"])) or {}
        check("ping: liveness question answered from the browser side",
              pr_res.get("status") == "ok" and (pr_res.get("ping") or {}).get("browser") == "StubChrome/1.0", json.dumps(pr_res)[:200])
        srv.shutdown()
    except Exception as e:
        import traceback

        check("git dance: full round trip offline", False, f"{type(e).__name__}: {e}\n{traceback.format_exc()[-900:]}")
    finally:
        if tmp is not None and tmp.is_dir():
            shutil.rmtree(tmp, ignore_errors=True)

    failed = [c[0] for c in checks if not c[1]]
    print(dump({"ok": not failed, "checks": len(checks), "failed": failed,
                "detail": {c[0]: (c[2] or "ok") for c in checks}}).rstrip())
    return 0 if not failed else 1


# ------------------------------------------------------------------------------ cli
def build_parser() -> argparse.ArgumentParser:
    """Built apart from ``main`` so a self-check can hold the parser and the code up against each
    other: every ``self.cfg.x`` the worker reads has to be a flag, and this caught two that were
    not — one lost in a patch, one that never existed."""
    ap = argparse.ArgumentParser(prog="python3 tools/gh_bridge.py",
                                 description="Queue platform work through git: no ports, no tunnels, no shared browser.",
                                 epilog="The layout and the rules are in this file's docstring; tools/README.md has the run books.")
    ap.add_argument("--repo", default="", help="repository to work in (default: the one holding this file)")
    ap.add_argument("--branch", default="", help="branch to push to (default: the current one)")
    ap.add_argument("--remote", default="origin")
    ap.add_argument("--indent", type=int, default=2, help="0 for one line")
    sub = ap.add_subparsers(dest="cmd", required=True)

    def common(p: argparse.ArgumentParser) -> None:
        p.add_argument("--out", default=str(REPO / "assets" / "bridge"), help="where results land locally (gitignored)")
        p.add_argument("--cdp-url", default="", help="CDP endpoint (default $CDP_ENDPOINT or http://127.0.0.1:9222)")

    q = sub.add_parser("ask", help="queue a task — or run it in-process if a browser is reachable from here")
    q.add_argument("--platform", default="gemini", help="adapter name or alias (see -m tools.runner --list)")
    q.add_argument("--prompt", default="")
    q.add_argument("--prompt-file", default="", help="file whose first blank-line-separated block is the prompt")
    q.add_argument("--mode", default="", help="adapter-specific, e.g. chatgpt --mode research")
    q.add_argument("--env", default="local", choices=("local", "hosted"), help="which kind of worker may take this")
    q.add_argument("--note", default="", help="a label for the commit and the log")
    q.add_argument("--ping", action="store_true", help="no work: ask a worker whether it can see a browser")
    q.add_argument("--timeout", type=float, default=900.0, help="how long to wait for a worker")
    q.add_argument("--poll", type=float, default=3.0, help="seconds between fetches (grows to 15)")
    q.add_argument("--answer-timeout", type=float, default=0.0, help="the runner's own settle budget")
    q.add_argument("--raw", action="store_true", help="keep the answer HTML too")
    q.add_argument("--local", dest="local", action="store_true", default=None, help="never use the queue")
    q.add_argument("--bridge", dest="local", action="store_false", help="always use the queue, even if a browser is local")
    q.add_argument("--no-wait", action="store_true", help="queue it and return")
    common(q)

    wt = sub.add_parser("wait", help="wait for a task already queued")
    wt.add_argument("id")
    wt.add_argument("--timeout", type=float, default=1800.0)
    wt.add_argument("--poll", type=float, default=3.0)
    common(wt)

    st = sub.add_parser("status", help="where each task stands, plus the last heartbeat")
    st.add_argument("id", nargs="?", default="")
    common(st)

    cx = sub.add_parser("cancel", help="ask workers to skip a task")
    cx.add_argument("id")
    common(cx)

    pr = sub.add_parser("prune", help="drop old payloads from tasks/done (the branch will thank you)")
    pr.add_argument("--keep", type=int, default=20, help="0 drops everything")
    pr.add_argument("--apply", action="store_true", help="commit and push the deletions (default: dry run)")
    common(pr)

    wk = sub.add_parser("worker", help="claim and run tasks on the machine that owns the browser")
    wk.add_argument("--env", default="local", choices=("local", "hosted", "any"), help="which tasks this machine serves")
    wk.add_argument("--once", action="store_true", help="drain what is pending, then exit (CI mode)")
    wk.add_argument("--interval", type=float, default=3.0, help="seconds between fetches")
    wk.add_argument("--idle-exit", type=float, default=0.0, help="exit after this many idle seconds")
    wk.add_argument("--max-tasks", type=int, default=0, help="stop after N tasks (0: no limit)")
    wk.add_argument("--allow", default="", help="comma list of platforms to run (default: everything installed)")
    wk.add_argument("--heartbeat", type=float, default=60.0, help="seconds between liveness commits (0: never)")
    wk.add_argument("--launch-chrome", dest="launch_chrome", action="store_true", default=True,
                    help="start a dedicated automation Chrome if the endpoint is dead")
    wk.add_argument("--no-launch-chrome", dest="launch_chrome", action="store_false")
    wk.add_argument("--headless", dest="headless", action="store_true", default=True, help="only when we launch it")
    wk.add_argument("--visible", dest="headless", action="store_false", help="sign in once in this profile, then switch back")
    wk.add_argument("--profile", default=os.environ.get("CHROME_PROFILE", str(Path.home() / ".chrome-cdp")),
                    help="persistent profile dir (Chrome 136+ ignores the debug port on the default profile)")
    wk.add_argument("--launch-wait", type=float, default=25.0, help="seconds to wait for the endpoint after launching")
    wk.add_argument("--python", default=sys.executable, help="interpreter used to run tools.runner")
    wk.add_argument("--runner-cmd", default="",
                    help="replace the runner command (CI and tests). The machine that runs the worker "
                         "chooses this; a task can never set it")
    wk.add_argument("--check-endpoint", dest="check_endpoint", action="store_true", default=True,
                    help="refuse to start work when nothing answers the CDP endpoint")
    wk.add_argument("--no-check-endpoint", dest="check_endpoint", action="store_false",
                    help="for a worker whose browser appears later (CI, a runner that launches it itself)")
    wk.add_argument("--max-artifact-mb", type=int, default=0, help="override the per-file size cap")
    wk.add_argument("--dry-run", action="store_true", help="show what would run; touches nothing")
    wk.add_argument("--cdp-url", default="", help="CDP endpoint (default $CDP_ENDPOINT or http://127.0.0.1:9222)")

    sc = sub.add_parser("self-check", help="offline: schema, argv, and a full queue round trip in a temp repo")
    sc.add_argument("--offline", action="store_true", help="accepted and ignored; this check is always offline")

    return ap


def main(argv: Optional[list[str]] = None) -> int:
    ap = build_parser()
    args = ap.parse_args(argv)
    indent = None if args.indent == 0 else args.indent
    try:
        g = Git(repo=Path(args.repo) if args.repo else None, branch=args.branch, remote=args.remote)
        if args.cmd == "self-check":
            return self_check()
        if args.cmd == "ask":
            prompt = args.prompt
            if args.prompt_file:
                blocks = [b.strip() for b in Path(args.prompt_file).read_text(encoding="utf-8").split("\n\n") if b.strip()]
                if not blocks:
                    raise BridgeError(f"{args.prompt_file} holds no text")
                prompt = prompt or blocks[0]
            if args.ping:
                task = validate_task({"env": args.env, "kind": "ping", "note": args.note or "liveness check"})
                b = Bridge(g, Path(args.out), cdp_url=args.cdp_url, poll=args.poll)
                env = b.ask(task, wait=not args.no_wait, timeout=min(args.timeout, 180.0))
                print(json.dumps(env, ensure_ascii=False, indent=indent))
                return int(env.get("exit_code", 0))
            if not prompt:
                raise BridgeError("--prompt or --prompt-file is required")
            ask: dict[str, Any] = {"platform": args.platform, "prompt": prompt}
            if args.mode:
                ask["mode"] = args.mode
            if args.raw:
                ask["raw"] = True
            if args.answer_timeout:
                ask["timeout"] = args.answer_timeout
            task = validate_task({"env": args.env, "note": args.note, "ask": ask})
            b = Bridge(g, Path(args.out), cdp_url=args.cdp_url, poll=args.poll)
            env = b.ask(task, wait=not args.no_wait, timeout=args.timeout, local=args.local)
            print(json.dumps(env, ensure_ascii=False, indent=indent))
            return EXIT["ok"] if env.get("queued") else int(env.get("exit_code", 0))
        if args.cmd == "wait":
            b = Bridge(g, Path(args.out), cdp_url=args.cdp_url, poll=args.poll)
            env = b.wait(args.id, args.timeout)
            print(json.dumps(env, ensure_ascii=False, indent=indent))
            return int(env.get("exit_code", 0))
        if args.cmd == "status":
            print(json.dumps(Bridge(g, Path(args.out)).status(args.id), ensure_ascii=False, indent=indent))
            return EXIT["ok"]
        if args.cmd == "cancel":
            Bridge(g, Path(args.out)).cancel(args.id)
            return EXIT["ok"]
        if args.cmd == "prune":
            print(json.dumps(prune(g, args.keep, args.apply), ensure_ascii=False, indent=indent))
            return EXIT["ok"]
        if args.cmd == "worker":
            if args.dry_run:
                args.launch_chrome = False
            return Worker(g, args).run_forever()
    except BridgeError as e:
        print(json.dumps({"ok": False, "error": str(e)}, ensure_ascii=False))
        log(str(e))
        return EXIT["bridge"]
    ap.error("unreachable")
    return EXIT["usage"]


if __name__ == "__main__":
    try:
        sys.exit(main())
    except BridgeError as e:
        print(json.dumps({"ok": False, "error": str(e)}, ensure_ascii=False))
        log(str(e))
        sys.exit(EXIT["bridge"])
    except KeyboardInterrupt:
        sys.exit(130)
