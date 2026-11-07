# `tasks/` — the queue, in the open

This directory is not documentation and not configuration. It is the wire between whoever asks for
work and whichever machine owns a browser, and it works precisely because git already moves it:
`git push` hands a task over, `git fetch` brings a result back. Nothing listens on any port on
either side.

```
pending/<id>.json      a request, written by the client                     → see gh_bridge.py ask
running/<id>.json      a claim, written by the worker that took it          → two workers, one task
cancel/<id>.json       "don't start it", honoured before work begins        → see gh_bridge.py cancel
done/<id>/result.json  status, timings, worker identity, artifact index     → see gh_bridge.py wait
done/<id>/artifacts/*  the images, markdown and sidecars that came back
HEARTBEAT.json         who is listening, and whether their browser is up
```

`<id>` is `<epoch-ms>-<ascii-slug>-<6 hex>` so a lexical sort is a chronological one, and one file
per task (rather than one shared log) is what lets two people push at the same second without a
merge conflict. Every rule about what may be inside a task — which keys exist, which platforms are
allowed, what a worker refuses — lives in `tools/gh_bridge.py`, and its `self-check` runs the whole
round trip against a temporary repository, offline.

Three habits, because this is a real repository and not a spool:

* **Everything here is history.** A prompt pushed to `tasks/pending` is pushed to the world that
  can read the branch. Never queue a credential, and expect a `git log -p tasks/` to be readable by
  your future employer.
* **Prune the payloads.** `python3 tools/gh_bridge.py prune --keep 10 --apply` — the images that
  land in `done/<id>/artifacts/` are exactly the sort of bytes that make a repository unpleasant to
  clone, and each one has already been delivered to `assets/bridge/` on the requesting side.
* **You may hand-write a task.** It is a JSON file in a directory; a worker that can validate it
  will run it, and one that cannot will push back a `rejected` result saying why. That is the
  intended interface, not a workaround.
