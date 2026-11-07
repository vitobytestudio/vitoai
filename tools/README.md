# `tools/` — driving the operator's live browser over remote CDP

One rule holds the design together: **this machine has no browser and no login.** The accounts are
on the operator's machine, whose DevTools port is either reachable directly or not reachable at
all — in which case the work travels through git (see *the bridge* below). Nothing launches a
browser, nothing stores cookies, and nothing is ever closed except the tab we opened for the task.

```
tools/
  runner.py                 the only entry point: --platform/--prompt/--jobs → one JSON document
  engine/
    cdp_client.py           connect_over_cdp, the tab lease (open/close), the host allow-list guard
    drive.py                find-by-candidates, the stability rule, and the full-fidelity harvest
  adapters/
    base.py                 the contract: check_session · submit · wait_for_answer · extract
    gemini.py               images from the Gemini web app (+ the text beside them)
    chatgpt.py              answers and research as markdown, with links and citations
  gh_bridge.py              the queue that travels through git: client, worker, self-check
  ask                       one-line agent entry point → gh_bridge ask (adds --platform/--prompt sugar)
  gemini_image.py           old flag set, forwarded to the runner; kept so muscle memory works
  drop.mjs / drive.mjs …    the studio's own preview/upload tools (unrelated to this)
```

## The runner

```bash
python3 -m tools.runner --self-check --offline    # is the stack wired? no browser needed
python3 -m tools.runner --probe                   # is the endpoint up, and who is on it?
python3 -m tools.runner --list                    # installed adapters and their contract
python3 -m tools.runner --platform gemini  --prompt "blocky toy detective, backlit hallway" --out assets
python3 -m tools.runner --platform chatgpt --prompt-file brief.txt --mode research
python3 -m tools.runner --jobs queue.jsonl --sleep 6 --stop-on-error
```

stdout is exactly one JSON document (`ok`, `platform`, `seconds`, `bytes`, `artifacts[]`,
`connection{}`, `error`, `exit_code`); everything human goes to stderr, so a loop can read the
machine output without stripping chatter. Results land in `assets/` (git-ignored: they are inputs
to a film, not the film).

**New platform, no edits:** drop `tools/adapters/perplexity.py` with a class that subclasses
`BaseAdapter`, sets `name`/`entry`/`hosts` and implements the four hooks. Discovery picks it up;
`--self-check` fails if a hook is missing. `--adapters DIR` points at adapters outside the repo.

Exit codes are shared by every adapter, so a shell loop or CI step can branch on them without
parsing prose: **0** ok · **2** not signed in · **3** no settled answer · **4** nothing to take ·
**5** environment (no endpoint, no playwright) · **6** bad invocation · **7** the bridge itself.

## The bridge: when the browser is on another machine

An agent in a sandbox has no inbound port and a filtered egress; an operator's laptop has no
public address either. Both can push to the same remote, so the queue is a few directories in the
repository — `git push` to hand work over, `git fetch` to collect it. No tunnel, no server, no
open port, and the transport is the one credential that already exists.

```
tasks/pending/<id>.json      a request            (client writes, worker deletes)
tasks/running/<id>.json      a claim              (worker writes, worker deletes)
tasks/cancel/<id>.json       "don't start it"     (client writes, worker deletes)
tasks/done/<id>/result.json  outcome + index      (worker writes)
tasks/done/<id>/artifacts/*  the files            (worker writes)
tasks/HEARTBEAT.json         who is listening     (worker rewrites while idle)
```

**Agent side** — one call, and it decides for itself whether a browser is reachable here:

```bash
tools/ask "a poster: last floor, 1930s algiers, 35mm, one line of type"
tools/ask chatgpt --mode research "primary sources on the 1932 algiers oil concessions"
python3 tools/gh_bridge.py ask --platform gemini --prompt-file brief.txt --env local --no-wait
python3 tools/gh_bridge.py wait 1793980000000-brief-3f2a1c      # resume a queued task
python3 tools/gh_bridge.py status                                # queue + last heartbeat
python3 tools/gh_bridge.py cancel <id>                           # before a worker starts it
python3 tools/gh_bridge.py prune --keep 10 --apply               # payloads are git history too
```

`ask` writes into `assets/bridge/<task>/` and re-extracts each artifact through `git show`,
verifying its sha256 on the way — bytes survive the round trip exactly. `--bridge` forces the
queue even with a local browser; `--local` forbids it. Waiting is a `git fetch` loop that backs
off 3 s → 15 s, and if nothing takes the job the message says why: no worker has ever existed on
this branch, the last heartbeat is N minutes old, or a live worker with the wrong `--env` is
ignoring it.

**Operator side** — the worker, on the machine that owns the browser:

```bash
pip install playwright                    # no `playwright install`: nothing is launched by us
python3 tools/gh_bridge.py worker --visible    # once, to sign in to the dedicated profile
python3 tools/gh_bridge.py worker             # afterwards: headless, silent, in the background
```

The worker fetches every `--interval` seconds, claims by pushing a `running/` file (two workers,
one task, the loser moves on), runs the runner against `127.0.0.1:9222`, copies the outputs into
`tasks/done/<id>/`, pushes, and never closes a tab that was not its own. If nothing answers the
port it starts Chrome itself with `--user-data-dir=$HOME/.chrome-cdp --remote-debugging-port=9222`
— a *dedicated persistent profile*, because Chrome 136+ ignores the debug port on the default
profile, and attaching to an already-running Chrome (144+) asks for consent on every connection.
`--no-launch-chrome` uses a browser you started yourself; `--allow gemini` restricts what this
machine will run; `--env hosted` serves the cloud queue instead of yours.

**GitHub as a trigger** — `.github/workflows/agent_bridge.yml` runs the same worker on GitHub's
machines for tasks marked `--env hosted` (a fresh, logged-out browser per run: no account to
betray, nothing to steal). `.github/workflows/agent_bridge_local.yml` is the same for a machine
registered as a self-hosted runner labelled `vito-bridge`; until such a runner exists that job
stays queued, which is why it is opt-in and in its own file. Bridge commits carry `[skip ci]`, so
the queue cannot wake the workflows by itself.

### The three things worth remembering

1. **A queue file is data, never a command.** A task may name a platform and a fixed set of runner
   flags; unknown keys, `--out`, `--cdp-url`, `--adapters`, and `--keep-tab` are refused during
   validation, and nothing is ever passed through a shell. `self-check` proves it.
2. **A prompt is git history.** Anything queued is pushed, permanent, and visible to everyone with
   read access to the repository. No credentials in prompts, no surprises in `prune`.
3. **The debug port stays local.** Chrome's CDP endpoint has no authentication: whoever can reach
   `:9222` owns every tab in that browser. Bind it to localhost, do not forward it to a public
   host, and do not add `--remote-allow-origins=*` to make some client happy — that flag is the
   last guard, not a nuisance.

### Where the truth lives

A transaction never runs in the checkout that asked for it: each side writes into a detached
worktree under `.vito-bridge/ws`, aligns it with `git fetch`, and pushes back. Your working tree
stays yours — no staged files, no `reset --hard`, no commit that sweeps in the half-written thing
you were editing. And because the queue and the CI share one branch, the *request* commit is the
only one GitHub is allowed to see: claims, results, heartbeats and prunes all carry `[skip ci]`,
which is what keeps a run from waking the next run forever.

Every failure therefore arrives as a commit, not as a log. Actions writes its log body to
`results-receiver.actions.githubusercontent.com`, which a sandbox with a short egress allowlist
cannot read — so a worker publishes its own death instead: any fatal error lands in
`tasks/HEARTBEAT.json` with the message, the traceback tail, and the exact invocation that produced
it (`env`, `interval`, `allow`, endpoint, headless). Which means the whole system is debuggable from
the one thing both sides can always touch:

```bash
python3 tools/gh_bridge.py status              # every task's state + the last heartbeat, fatal included
python3 tools/gh_bridge.py wait <id> --timeout 600
python3 tools/gh_bridge.py self-check          # offline: schema, argv, and a full round trip in a temp repo
```

### Prove it on the real remote (no browser needed)

Four commands, and they exercise the same three primitives the live loop uses — queue, claim,
deliver — against whatever `origin` is:

```bash
python3 tools/gh_bridge.py ask --bridge --ping --env local --no-wait   # 1. a task appears on the branch
git clone -b "$(git rev-parse --abbrev-ref HEAD)" "$PWD" /tmp/wk       # 2. a second machine, in miniature
cd /tmp/wk && python3 tools/gh_bridge.py worker --once --env local     # 3. claim, run, push back
cd - && python3 tools/gh_bridge.py wait <id>                           # 4. bytes back, sha256 verified
```

Expect step 4 to report `exit_code 5` and the sentence *"nothing answering at 127.0.0.1:9222"*:
that is the honest answer of a worker with no browser, and it is the thing worth seeing arrive.

```bash
python3 tools/gh_bridge.py prune --keep 10 --apply   # the payloads are history too
```
