"""The machinery under the adapters: one CDP connection, one set of waiting/saving rules.

Everything in this package is written for a single constraint — the browser belongs to the
operator. We attach to it, we do not own it: no launch, no profile, no cookies, and no tab is
ever closed except the one we opened.
"""
import sys
import time


def log(msg: str) -> None:
    """Human chatter goes to stderr, so stdout stays a clean JSON document."""
    print(f"[tools {time.strftime('%H:%M:%S')}] {msg}", file=sys.stderr, flush=True)
