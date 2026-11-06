#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Deprecated shim: this became ``python3 -m tools.runner --platform gemini``.

The old version launched its own Chromium and wanted a profile or a cookie file. That model is
gone — the studio now drives the browser that is already open, over remote CDP, in a tab of its
own — so there is no login to mint and no session file to keep fresh. The arguments below still
work; the ones about cookies are refused with a pointer instead of silently doing something else.

    python3 tools/gemini_image.py --prompt "blocky toy detective, backlit hallway" --out assets
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

DROPPED = ("--cookies", "--storage-state", "--profile", "--api", "--api-model", "--selftest")


def main(argv=None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)
    kept, dropped = ["--platform", "gemini"], []
    i = 0
    while i < len(argv):
        a = argv[i]
        if any(a == d or a.startswith(d + "=") for d in DROPPED):
            dropped.append(a)
            i += 1
            if i < len(argv) and not argv[i].startswith("-"):
                i += 1  # also drop its value
            continue
        kept.append(a)
        i += 1
    if dropped:
        print("[gemini_image] ignored " + ", ".join(dropped) + " — the session plumbing is gone; "
              "the live browser over CDP is already signed in. Use: python3 -m tools.runner --platform gemini …",
              file=sys.stderr)
    from tools.runner import main as runner_main  # noqa: E402

    return runner_main(kept)


if __name__ == "__main__":
    sys.exit(main())
