# `tools/` — driving the operator's live browser over remote CDP

One rule holds the design together: **this machine has no browser and no login.** The accounts are
on the operator's machine, whose DevTools port is forwarded here (usually `127.0.0.1:9222`,
`$CDP_ENDPOINT` or `--cdp-url`). So nothing launches, nothing stores cookies, and nothing is ever
closed except the tab we opened for the task.

```
tools/
  runner.py                 the only entry point: --platform/--prompt/--jobs → one JSON document
  engine/
    cdp_client.py           connect_over_cdp, the tab lease (open/close), the host allow-list guard
    drive.py                find-by-candidates, the stability rule, the answer-validity rules,
                            and the full-fidelity harvest
  adapters/
    base.py                 the contract: check_session · submit · wait_for_answer · extract
    gemini.py               images from the Gemini web app (+ the text beside them)
    chatgpt.py              answers and research as markdown, with links and citations
  drop.mjs / drive.mjs …    the studio's own preview/upload tools (unrelated to this)
```

```bash
python3 -m tools.runner --self-check --offline    # is the stack wired? no browser needed
python3 -m tools.runner --probe                   # is the endpoint up, and who is on it?
python3 -m tools.runner --list                    # installed adapters and their contract
python3 -m tools.runner --platform gemini  --prompt "blocky toy detective, backlit hallway" --out assets
python3 -m tools.runner --platform chatgpt --prompt-file brief.txt --mode research
python3 -m tools.runner --jobs queue.jsonl --sleep 6 --stop-on-error
```

**New platform, no edits:** drop `tools/adapters/perplexity.py` with a class that subclasses
`BaseAdapter`, sets `name`/`entry`/`hosts` and implements the four hooks. Discovery picks it up;
`--self-check` fails if a hook is missing. `--adapters DIR` points at adapters outside the repo.

Results land in `assets/` (git-ignored: they are inputs to a film, not the film). Exit codes are
shared by every adapter — 0 ok · 2 not signed in · 3 no settled answer · 4 nothing to take ·
5 environment · 6 bad invocation — so a shell loop or CI step can branch on them without parsing
prose.

## What counts as an answer

A settled node is not automatically a result, and the difference is expensive: a logged-out page
echoes the prompt back, apologises in prose, or says the feature is unavailable here — and all of
that is stable, non-empty and arrives as one new turn. Three rules in `drive.py` close that hole,
and the adapters apply them before anything is written:

* `is_echo` — fold both sides; if the answer says nothing the prompt did not, it is a mirror.
  Wall wording is stripped first, because a login screen wrapped around an echo is still an echo.
* `WANTS_IMAGE` (Gemini sets it) — a job that asked for a picture and settled with none in it
  fails. The expectation decides, never the phrasing, so a courteous refusal cannot be filed as a
  deliverable.
* `says_wall` — when the prose is about accounts or a regional lockout, it leaves as
  `SessionExpired` (exit 2: a person can fix that) rather than `NoResult` (exit 4: nothing to fix).

A picture in the answer ends the enquiry: a short caption beside an image is normal.

```bash
python3 -m tools.runner --self-check --offline    # 34 checks, none of them need a browser
```
