"""One way to ask anything in the operator's browser: ``python3 -m tools.runner``.

    python3 -m tools.runner --platform gemini  --prompt "blocky toy detective, backlit hallway" --out assets
    python3 -m tools.runner --platform chatgpt --prompt-file brief.txt --mode research
    python3 -m tools.runner --jobs  queue.jsonl --sleep 6 --out assets --stop-on-error
    python3 -m tools.runner --list          # what is installed, and whether it is wired right
    python3 -m tools.runner --probe         # is the tunnel up? (no page is opened)
    python3 -m tools.runner --self-check    # offline: contract, discovery, harvest, no-launch rule

Everything a task needs that is *not* site-specific is decided here and nowhere else: the CDP
endpoint (``--cdp-url`` > ``$CDP_ENDPOINT`` > 127.0.0.1:9222), one tab per job, that tab closed on
success and on failure, jobs run strictly one after another, and the result printed as a single
JSON document on stdout so it can be piped into ``jq`` — while the human chatter goes to stderr.

Exit codes, per job and for the batch: 0 ok · 2 not signed in · 3 no settled answer in time ·
4 nothing to take · 5 environment (no tunnel, no playwright) · 6 bad invocation.
"""
from __future__ import annotations

import argparse
import json
import sys
import time
import traceback
from pathlib import Path

if __package__ in (None, ""):  # allow plain `python3 tools/runner.py …`
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    __package__ = "tools"

from tools import adapters  # noqa: E402
from tools.adapters.base import Config, NoResult, NotSettled, SessionExpired, contract  # noqa: E402
from tools.engine import drive, log  # noqa: E402
from tools.engine.cdp_client import CDP, CDPError, Offsite, Unavailable, probe, resolve  # noqa: E402

CODES = {"ok": 0, "session": 2, "timeout": 3, "noresult": 4, "env": 5, "usage": 6}


# ------------------------------------------------------------------------------ jobs
def _jobs_from_args(args) -> list[dict]:
    jobs: list[dict] = []
    if args.jobs:
        path = Path(args.jobs).expanduser()
        if not path.exists():
            raise SystemExit(f"[ERROR] no job file at {path}")
        for ln, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError as e:
                raise SystemExit(f"[ERROR] {path}:{ln} is not one JSON object per line: {e}")
            if isinstance(obj, str):
                obj = {"prompt": obj}
            obj.setdefault("platform", args.platform)
            jobs.append(obj)
    else:
        prompts = list(args.prompt or [])
        if args.prompt_file:
            prompts += [p for p in Path(args.prompt_file).read_text(encoding="utf-8").split("\n\n") if p.strip()]
        if not prompts:
            raise SystemExit("[ERROR] nothing to do: give --prompt, --prompt-file or --jobs")
        jobs = [{"platform": args.platform, "prompt": p.strip()} for p in prompts]
    return jobs


def _config_for(job: dict, args) -> Config:
    cfg = Config.from_args(args)
    cfg.out = Path(job.get("out") or cfg.out).expanduser()
    cfg.timeout = float(job.get("timeout") or cfg.timeout)
    cfg.mode = job.get("mode") or cfg.mode
    cfg.raw = bool(job.get("raw", cfg.raw))
    return cfg


def run_job(cdp: CDP, job: dict, args) -> dict:
    name = (job.get("platform") or "").strip()
    t0 = time.time()
    out = {"ok": False, "platform": name, "prompt": (job.get("prompt") or "")[:160], "seconds": 0.0,
           "bytes": 0, "artifacts": [], "error": None, "exit_code": CODES["usage"]}
    if not name:
        out["error"] = "job has no platform"
        return out
    try:
        cls = adapters.resolve(name, extra=args.adapters)
    except KeyError:
        known = ", ".join(sorted(adapters.load(args.adapters)[0]))
        out["error"] = f"no adapter named '{name}'. Installed: {known or '(none)'}"
        return out

    info = contract(cls)
    if info["missing_hooks"]:
        out["error"] = f"{cls.__name__} does not implement {', '.join(info['missing_hooks'])}"
        return out

    log(f"{name}: opening a tab on {info['entry']}")
    tab = None
    try:
        tab = cdp.tab(info["entry"], hosts=tuple(info["hosts"]))
        adapter = cls(tab, _config_for(job, args))
        res = adapter.run(job.get("prompt") or "")
        out.update({"ok": True, "artifacts": res["artifacts"], "bytes": res["bytes"],
                    "error": None, "exit_code": 0, "host": res.get("host")})
    except (SessionExpired, NotSettled, NoResult, Offsite, CDPError) as e:
        kind = {SessionExpired: "session", NotSettled: "timeout", NoResult: "noresult"}.get(type(e), "env")
        out["error"] = f"{type(e).__name__}: {e}"
        out["exit_code"] = CODES[kind]
    except KeyboardInterrupt:
        out["error"] = "KeyboardInterrupt: stopped by the operator"
        out["exit_code"] = CODES["env"]
        raise
    except Exception as e:  # a crash is still a result the caller deserves to read
        out["error"] = f"{type(e).__name__}: {e}"
        out["exit_code"] = CODES["env"]
        if args.debug:
            out["traceback"] = traceback.format_exc(limit=6)
        log("".join(traceback.format_exc(limit=3).splitlines(keepends=True)[-3:]))
    finally:
        if tab is not None:
            tab.close()  # ours, and only ours — success, timeout or crash
        out["seconds"] = round(time.time() - t0, 2)
    return out


def run_batch(args) -> int:
    jobs = _jobs_from_args(args)
    endpoint = resolve(args.cdp_url)
    if args.offline:
        raise SystemExit("[ERROR] --offline cannot run tasks; it only feeds --self-check")
    log(f"connecting to {endpoint}")
    results: list[dict] = []
    t0 = time.time()
    code = 0
    try:
        with CDP.open(endpoint, timeout=args.connect_timeout, keep_tab=args.keep_tab) as cdp:
            for i, job in enumerate(jobs, 1):
                if i > 1 and args.sleep:
                    log(f"cooling down {args.sleep:.0f}s")
                    time.sleep(args.sleep)
                log(f"job {i}/{len(jobs)}")
                r = run_job(cdp, job, args)
                results.append(r)
                code = code or r["exit_code"]
                if r["exit_code"] and args.stop_on_error:
                    log("stopping the queue (--stop-on-error)")
                    break
            conn = cdp.status()
    except (Unavailable, CDPError) as e:
        print(json.dumps({"ok": False, "error": str(e), "exit_code": CODES["env"], "endpoint": endpoint},
                         ensure_ascii=False))
        log(str(e))
        return CODES["env"]
    payload = (results[0] if len(results) == 1 else {"ok": all(r["ok"] for r in results), "results": results})
    payload["seconds_total"] = round(time.time() - t0, 2)
    payload.setdefault("platform", payload.get("platform"))
    if len(results) == 1:
        payload["connection"] = conn
    else:
        payload["connection"] = conn
    payload["exit_code"] = 0 if all(r["ok"] for r in results) else (code or CODES["env"])
    print(json.dumps(payload, ensure_ascii=False, indent=args.indent))
    return payload["exit_code"]


# ------------------------------------------------------------------------ self-check
def _no_browser_launch_ok() -> tuple[bool, list]:
    """This tool must be *incapable* of starting a browser — that is the whole remote-CDP idea.

    Checked against the source, because a comment in the docs is not a guarantee: Playwright's
    launch/persistent-profile entry points simply may not appear in the engine or the adapters.
    """
    roots = [Path(__file__).resolve().parent / "engine", Path(__file__).resolve().parent / "adapters"]
    forbidden = ("launch_persistent_context", ".launch(", "launch_server", "storage_state", "add_cookies")
    hits = []
    for root in roots:
        for f in sorted(root.glob("**/*.py")):
            body = f.read_text(encoding="utf-8", errors="replace")
            for ln, line in enumerate(body.splitlines(), 1):
                code_part = line.split("#", 1)[0]
                for bad in forbidden:
                    if bad in code_part:
                        hits.append(f"{f.name}:{ln}: {bad}")
    return (not hits), hits


def self_check(args) -> int:
    """Everything that can be proven without touching the operator's browser. Exit 0 = ready."""
    report = {"ok": True, "checks": [], "adapters": [], "problems": []}

    def check(name, ok, detail=""):
        report["checks"].append({"name": name, "ok": bool(ok), "detail": detail})
        report["ok"] = report["ok"] and bool(ok)
        log(f"{'ok  ' if ok else 'FAIL'} {name}" + (f" — {detail}" if detail else ""))

    found, problems = adapters.load(args.adapters)
    check("adapters discovered", len(found) >= 2, ", ".join(sorted({c.name for c in found.values()})))
    check("no discovery problems", not problems, "; ".join(problems[:3]))
    for cls in sorted(set(found.values()), key=lambda c: c.name):
        c = contract(cls)
        report["adapters"].append(c)
        check(f"{c['platform']}: implements all four hooks", not c["missing_hooks"], "; ".join(c["missing_hooks"]))
        check(f"{c['platform']}: declares an entry page and a host allow-list", bool(c["entry"]) and bool(c["hosts"]),
              f"{c['entry']} / {c['hosts']}")
        try:
            adapters.resolve(c["platform"], found)
            ok, detail = True, ""
        except Exception as e:  # noqa: BLE001
            ok, detail = False, str(e)
        check(f"{c['platform']}: resolvable by name", ok, detail)

    ok, hits = _no_browser_launch_ok()
    check("engine never launches a browser (source check)", ok, "; ".join(hits[:3]))

    # the waiting rule, against a fake page: an answer that stops changing is taken, one that
    # never starts is not
    class FakeTurn:
        def __init__(self, text, imgs):
            self._t, self._i = text, imgs

        def inner_text(self):
            return self._t

        def locator(self, sel):
            outer = self

            class L:
                def count(self):
                    return outer._i

                @property
                def first(self):
                    return self

                def is_visible(self):
                    return False

            return L()

    check("fingerprint: empty answer is not 'done'", drive.fingerprint(FakeTurn("   ", 0))[2] is False)
    check("fingerprint: text counts", drive.fingerprint(FakeTurn("a result " * 6, 0))[2] is True)
    check("fingerprint: a picture alone counts", drive.fingerprint(FakeTurn("", 1))[2] is True)
    check("slugify keeps Arabic", "ممر-مظلم" in drive.slugify("ممر مظلم"))
    check("slugify survives junk", drive.slugify("  ///  ***  ") == "task")

    check("echo: a prompt coming back is not an answer",
          drive.is_echo("one line of type on black: bridge", "one line of type on black: bridge"))
    check("echo: blank counts too", drive.is_echo("   ", "anything at all"))
    check("echo: a real reply survives the check",
          not drive.is_echo("Here you go. Twelve frames, no text, as asked — see the notes below.", "one line"))
    check("echo: a caption beside a picture is not judged",
          not drive.is_echo("A rainy night, one lit window, 35mm.", "make me a poster of a rainy night with one lit window"))
    check("echo: punctuation and casing do not hide a mirror",
          drive.is_echo("ONE LINE OF TYPE ON BLACK: BRIDGE!", "one line of type on black: bridge"))
    check("echo: a wall wrapped around our prompt is still an echo",
          drive.is_echo("Sign in to continue to Gemini\n\none line of type on black", "one line of type on black"))
    check("wall: sign-in wording is recognised", drive.says_wall("Sign in to continue to Gemini") and drive.says_wall("تسجيل الدخول للمتابعة"))
    check("wall: an answer is not a wall", not drive.says_wall("Here is the poster, and a note about the crop."))

    class _FakePage:
        url = "https://example.invalid/app/1"

    class _FakeTab:
        page = _FakePage()
        host = "example.invalid"

    class _EchoAdapter(adapters.BaseAdapter):
        name, entry, hosts = "_echocheck", "https://example.invalid", ("example.invalid",)

        def check_session(self) -> None:
            return None

        def submit(self, prompt: str) -> None:
            return None

        def wait_for_answer(self):
            return FakeTurn(self._prompt, 0)

        def extract(self, answer, stem: str) -> list:
            return []

    cfg = adapters.Config(out="/tmp/tools-selfcheck")
    for body, want, why in (
        ("one line of type on black", NoResult, "an echo with no wall wording is an unanswered job"),
        ("Sign in to continue\n\none line of type on black", adapters.SessionExpired, "a wall is a login problem"),
    ):
        a = _EchoAdapter(_FakeTab(), cfg)
        a._prompt = "one line of type on black"
        a.wait_for_answer = lambda body=body, a=a: FakeTurn(body, 0)
        try:
            a.run("one line of type on black")
            check(f"echo gate: {why}", False, "the run was accepted; it should have been refused")
        except want as e:
            check(f"echo gate: {why}", True, str(e)[:96])
        except Exception as e:  # noqa: BLE001
            check(f"echo gate: {why}", False, f"{type(e).__name__}: {e}")

    class _PictureAdapter(_EchoAdapter):
        name = "_piccheck"

        def wait_for_answer(self):
            return FakeTurn(self._prompt, 1)

        def extract(self, answer, stem: str) -> list:
            return [{"path": "/tmp/tools-selfcheck/x.png", "bytes": 4, "kind": "image", "how": "screenshot"}]

    pa = _PictureAdapter(_FakeTab(), cfg)
    pa._prompt = "one line of type on black"
    Path("/tmp/tools-selfcheck").mkdir(parents=True, exist_ok=True)
    Path("/tmp/tools-selfcheck/x.png").write_bytes(b"PNG1")
    try:
        out = pa.run("one line of type on black")
        check("echo gate: a picture in the answer outranks a short caption", bool(out["artifacts"]), f"{out['bytes']} bytes")
    except Exception as e:  # noqa: BLE001
        check("echo gate: a picture in the answer outranks a short caption", False, f"{type(e).__name__}: {e}")

    tmp = Path("/tmp/tools-selfcheck")
    for f in tmp.glob("*"):
        try:
            f.unlink()
        except OSError:
            pass
    arts = drive.harvest_text(FakeTurn("Answer body.\n\nWith two lines.", 0), tmp, "selfcheck", {"platform": "test"})
    check("text harvest writes a file", bool(arts) and Path(arts[0]["path"]).exists(), arts[0]["path"] if arts else "")
    check("harvest reports bytes", bool(arts) and arts[0]["bytes"] > 0, arts[0]["bytes"] if arts else 0)

    try:
        info = probe(args.cdp_url, timeout=2.0)
        check("CDP tunnel is reachable", True, f"{info.get('Browser')} @ {resolve(args.cdp_url)}")
    except Exception as e:  # noqa: BLE001
        check("CDP tunnel is reachable", bool(args.offline), f"{type(e).__name__}: offline, which is fine for --self-check")

    print(json.dumps(report, ensure_ascii=False, indent=args.indent))
    return 0 if report["ok"] else CODES["env"]


# ------------------------------------------------------------------------------ main
def main(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="python3 -m tools.runner", description="Drive a platform in the operator's live browser over remote CDP.")
    ap.add_argument("--platform", help="an adapter name or alias (see --list)")
    ap.add_argument("--prompt", action="append", help="the ask; repeat the flag to queue several, run serially")
    ap.add_argument("--prompt-file", help="a file whose blank-line-separated blocks are the prompts")
    ap.add_argument("--jobs", help="JSONL: one object per line {platform, prompt, mode, out, timeout}")
    ap.add_argument("--out", default="assets", help="where results land (default ./assets)")
    ap.add_argument("--mode", default="", help="adapter-specific, e.g. chatgpt --mode research")
    ap.add_argument("--cdp-url", default=None, help="CDP endpoint; default $CDP_ENDPOINT or http://127.0.0.1:9222")
    ap.add_argument("--connect-timeout", type=float, default=25.0, help="seconds for the handshake + navigation")
    ap.add_argument("--timeout", type=float, default=240.0, help="seconds for one answer to settle")
    ap.add_argument("--login-wait", type=float, default=12.0, help="seconds to wait for a composer before calling it signed out")
    ap.add_argument("--sleep", type=float, default=0.0, help="pause between queued jobs")
    ap.add_argument("--stop-on-error", action="store_true", help="abandon the rest of the queue on the first failure")
    ap.add_argument("--adapters", action="append", default=[], help="extra adapter file or directory to discover")
    ap.add_argument("--keep-tab", action="store_true", help="leave our tab open afterwards (debugging; nothing else is touched)")
    ap.add_argument("--raw", action="store_true", help="also keep the answer's HTML beside the markdown")
    ap.add_argument("--no-download-btn", action="store_true", help="never click the page's download; use URL/screenshot only")
    ap.add_argument("--min-px", type=int, default=180, help="smaller than this is an icon, not an output")
    ap.add_argument("--list", action="store_true", help="print the installed adapters and their contract, then exit")
    ap.add_argument("--probe", action="store_true", help="ask the endpoint who it is, without opening a page")
    ap.add_argument("--self-check", action="store_true", help="offline: contract, discovery, harvest, and the no-launch rule")
    ap.add_argument("--offline", action="store_true", help="with --self-check only: expect no tunnel")
    ap.add_argument("--debug", action="store_true", help="include a traceback in the JSON")
    ap.add_argument("--indent", type=int, default=2, help="JSON indent (0 for one line)")
    args = ap.parse_args(argv)
    if args.indent == 0:
        args.indent = None

    if args.self_check:
        return self_check(args)
    if args.probe:
        try:
            info = probe(args.cdp_url)
        except CDPError as e:
            print(json.dumps({"ok": False, "error": str(e)}, ensure_ascii=False))
            log(str(e))
            return CODES["env"]
        print(json.dumps({"ok": True, "endpoint": resolve(args.cdp_url), **info}, ensure_ascii=False, indent=args.indent))
        return 0
    if args.list:
        cats = adapters.catalogue(args.adapters)
        for c in cats:
            log(f"{c['platform']:12s} {c['title'] or c['entry']}")
        print(json.dumps({"ok": True, "adapters": cats, "endpoint": resolve(args.cdp_url)}, ensure_ascii=False, indent=args.indent))
        return 0
    if not (args.platform or args.jobs):
        ap.error("--platform is required (or --jobs, or --list/--probe/--self-check)")
    if not args.prompt and not args.prompt_file and not args.jobs:
        ap.error("give --prompt, --prompt-file or --jobs")
    try:
        return run_batch(args)
    except SystemExit as e:
        log(str(e.code))
        return CODES["usage"]


if __name__ == "__main__":
    sys.exit(main())
