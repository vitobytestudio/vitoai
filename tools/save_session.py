#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Mint the session file that lets `gemini_image.py` run headless — log in once, on purpose.

    python3 tools/save_session.py                              # → ./storage_state.json
    python3 tools/save_session.py --out secrets/gemini.json --every 180
    python3 tools/save_session.py --cookies-out gemini_cookies.json
    python3 tools/save_session.py --headless                   # re-save from an existing profile

A real Chromium window opens on a profile this tool owns (``~/.vito-gemini-profile``). You sign
in to Google the way you always do — 2FA, passkey, whatever it asks for, in a browser that is
yours — and the moment the app draws its composer, the state is written to disk. That is the
only moment this tool needs you.

``--every`` is the part that makes a saved session dependable: the window stays open and the
file is rewritten on that interval, so the rotating tokens stay current while you work and a
render run hours later still finds a live session instead of a login page. Refreshed files are
written to a temp path and renamed, so a kill in the middle can never leave you with a
half-written session.

The selectors and the "is it signed in?" test are imported from ``gemini_image`` — one definition
of what "ready" means, in one file.

The file you get out of this **is** your login. Keep it out of git, out of chat, out of logs.
Exit codes: 0 saved · 2 never signed in · 5 environment.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import gemini_image as g  # noqa: E402  (same folder by design: one set of selectors)


def write_state(ctx, dest: Path, cookies_only: bool) -> int:
    """Persist the session atomically, and return the size — never its contents."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_name(dest.name + ".tmp")
    try:
        if cookies_only:
            tmp.write_text(json.dumps({"cookies": ctx.cookies()}, ensure_ascii=False, indent=1), encoding="utf-8")
        else:
            ctx.storage_state(path=str(tmp))
        os.replace(tmp, dest)
    finally:
        try:
            if tmp.exists():
                tmp.unlink()
        except OSError:
            pass
    return dest.stat().st_size


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Save a logged-in Gemini session to a file for headless runs.")
    ap.add_argument("--out", default="storage_state.json", help="where the storage state goes (default ./storage_state.json)")
    ap.add_argument("--cookies-out", help="also write a cookies-only file (what --cookies reads), e.g. gemini_cookies.json")
    ap.add_argument("--profile", default="~/.vito-gemini-profile", help="persistent profile to read the login from")
    ap.add_argument("--url", default=g.GEMINI_URL, help="page that proves the session works")
    ap.add_argument("--timeout", type=float, default=600, help="seconds to leave the window open for you to sign in")
    ap.add_argument("--every", type=float, default=0, help="keep the window open and rewrite the file every N seconds")
    ap.add_argument("--headless", action="store_true", help="no window: re-save from a profile that is already signed in")
    args = ap.parse_args(argv)

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        g.log("playwright isn't installed here:  pip install playwright && playwright install chromium")
        return 5

    profile = Path(args.profile).expanduser()
    profile.mkdir(parents=True, exist_ok=True)
    out = Path(args.out).expanduser()
    exe = os.environ.get("PLAYWRIGHT_CHROMIUM") or None
    saved_at = 0.0

    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(
            user_data_dir=str(profile),
            headless=args.headless,
            executable_path=exe,
            viewport={"width": 1280, "height": 860},
            args=["--disable-blink-features=AutomationControlled", "--no-first-run"],
        )
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        page.goto(args.url, wait_until="domcontentloaded", timeout=60_000)
        if not args.headless:
            g.log("a window is open: sign in there. This script will not see what you type.")
        composer = g.find_first(page, g.COMPOSER, timeout=args.timeout if not args.headless else 20)
        if composer is None:
            g.log("no composer appeared, so there is nothing worth saving.")
            if args.headless:
                g.log(f"the profile {profile} is not signed in — run this without --headless once.")
            else:
                g.log(f"[ERROR] not signed in within {args.timeout:.0f}s")
            ctx.close()
            return 2

        try:
            size = write_state(ctx, out, cookies_only=False)
            saved_at = time.time()
            g.log(f"wrote {out} · {size} bytes · {len(ctx.cookies())} cookies (values not shown)")
            if args.cookies_out:
                cpath = Path(args.cookies_out).expanduser()
                csize = write_state(ctx, cpath, cookies_only=True)
                g.log(f"wrote {cpath} · {csize} bytes")
            if args.every <= 0:
                g.log("saved. Close the window when you like — nothing else is needed.")
                return 0

            g.log(f"watching: the file is rewritten every {args.every:.0f}s until you close the window.")
            while not page.is_closed():
                page.wait_for_timeout(args.every * 1000)
                if page.is_closed():
                    break
                size = write_state(ctx, out, cookies_only=False)
                saved_at = time.time()
                g.log(f"refreshed {out.name} · {size} bytes")
            return 0
        except KeyboardInterrupt:
            g.log("interrupted — writing the last state before closing.")
            try:
                write_state(ctx, out, cookies_only=False)
            except Exception:
                pass
            return 0
        finally:
            if saved_at and args.every <= 0:
                g.log(f"session file is {(time.time() - saved_at) / 60:.1f} min old")
            try:
                ctx.close()
            except Exception:
                pass


if __name__ == "__main__":
    sys.exit(main())
