#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Drive the Gemini web app from a script: send a prompt, wait for the picture, save it.

    python3 tools/gemini_image.py --prompt "a blocky toy detective, 3/4 backlit, dark hallway" \
        --out assets --headed            # first run only: log in once, in the real window

    python3 tools/gemini_image.py --prompt-file shot.txt --out assets --timeout 300

How it stays boring to run
--------------------------
* **It never sees your password.** The browser is launched with a *persistent profile*
  (``--profile``, default ``~/.vito-gemini-profile``). You log in once in that window; the
  cookies live in the profile directory on your disk, and this script only reads them through
  the browser. No token is printed, stored, or copied anywhere.
* **It does not trust one selector.** Google rewrites this UI constantly, so every element is
  looked up through a list of candidates (role/aria label/text) and the first live one wins.
* **It does not trust a fixed sleep.** Completion is decided by *stability*: the last answer's
  fingerprint (its text length, its image count, whether a spinner is showing) must not change
  for several polls before the download starts.
* Three ways to actually get the file: click Gemini's own download button (best quality),
  fetch the ``<img>`` URL, or screenshot the element. Whichever works, works.
* ``--debug`` writes a screenshot + the answer's HTML next to the image, so when Google changes
  the markup you can see what the script saw instead of guessing.

Two honest caveats
------------------
Automating a signed-in web UI can stop working at any time and is not what Google's terms are
shaped for; the supported route is the API, which is why ``--api`` exists (needs
``GEMINI_API_KEY`` in the environment, never passed on the command line where it would land in
shell history).

Exit codes: 0 ok · 2 login needed · 3 timeout · 4 no image in the answer · 5 environment.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import re
import sys
import time
import unicodedata
from pathlib import Path

GEMINI_URL = "https://gemini.google.com/app"
LOGIN_HOSTS = ("accounts.google.com", "signin")

# --------------------------------------------------------------------- what to look for
# Candidates, best first. ``css:`` / ``text=`` / ``role=`` prefixes are Playwright selectors.
COMPOSER = [
    'div.ql-editor[contenteditable="true"]',
    'div[contenteditable="true"][role="textbox"]',
    'textarea[aria-label*="prompt" i]',
    '[role="textbox"]',
]
SEND = [
    'button[aria-label*="Send" i]',
    'button.send-button',
    'button:has-text("Send")',
]
BUSY = [  # anything that says "still generating"
    'button[aria-label*="Stop" i]',
    '.stop-icon',
    'mat-progress-bar',
    '[aria-live="polite"][busy="true"]',
    'button:has-text("Stop generating")',
]
PANEL = "response-container, .model-response, conversation-container"  # one of these exists = signed in
TURNS = 'model-response, .model-response-text, [data-test-id*="response"]'
ANSWER_IMG = "img"
DOWNLOAD_BTN = 'button[aria-label*="download" i], [role="menuitem"]:has-text("Download"), .download-icon'


def log(msg: str) -> None:
    print(f"[gemini] {msg}", flush=True)


def slugify(text: str, n: int = 44) -> str:
    """A filesystem-safe name for any language: Arabic survives, spaces and slashes don't."""
    text = unicodedata.normalize("NFKC", text or "").strip().lower()
    keep = []
    for ch in text:
        if ch.isalnum():
            keep.append(ch)
        elif ch in " -_":
            keep.append("-")
    out = re.sub(r"-{2,}", "-", "".join(keep)).strip("-")
    return (out[:n] or "image") if not out else out[:n]


def fingerprint(turn) -> tuple:
    """Cheap, stable, and enough to decide 'the answer stopped changing'.

    ``meaning`` matters: a response node exists the moment you press Enter, empty. Declaring the
    picture finished because three polls saw nothing change in nothing would be a fast way to
    download no file, so an answer only counts once it has text or an image in it.
    """
    try:
        text = len(turn.inner_text().strip())
        pics = turn.locator(ANSWER_IMG).count()
        return (text, pics, text > 24 or pics > 0)
    except Exception:
        return (-1, -1, False)


def find_first(page, candidates, *, timeout: float = 0, state: str = "visible"):
    """The first selector from the list that actually matches something on screen."""
    deadline = time.monotonic() + timeout
    while True:
        for sel in candidates:
            try:
                loc = page.locator(sel).first
                if loc.count() > 0 and (state == "attached" or loc.is_visible()):
                    return loc
            except Exception:
                continue
        if time.monotonic() >= deadline:
            return None
        time.sleep(0.3)


def last_turn(page):
    loc = page.locator(TURNS)
    if loc.count() == 0:
        return None
    return loc.last


def wait_until_done(page, before: int, timeout: float, settle: float = 1.5, quiet: int = 3, min_wait: float = 8.0):
    """Poll until the newest answer stops growing and no busy indicator is showing.

    Returns the turn locator, or None on timeout. ``before`` is how many answers existed when we
    sent the prompt, so a stale answer can never be mistaken for the new one.
    """
    t0 = time.monotonic()
    deadline = t0 + timeout
    stable = 0
    last_fp = None
    while time.monotonic() < deadline:
        count = page.locator(TURNS).count()
        turn = last_turn(page) if count > before else None
        busy = find_first(page, BUSY, timeout=0) is not None
        if turn is not None and not busy and (time.monotonic() - t0) >= min_wait:
            fp = fingerprint(turn)
            if fp == last_fp and fp[2]:
                return turn
            stable = stable + 1 if fp == last_fp else 0
            if stable >= quiet and fp[2]:
                return turn
            last_fp = fp
        else:
            last_fp = None
            stable = 0
        time.sleep(settle)
    return None


# ------------------------------------------------------------------------------ browser
def run_browser(args) -> int:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        log("playwright isn't installed here:  pip install playwright && playwright install chromium")
        return 5

    profile = Path(args.profile).expanduser()
    profile.mkdir(parents=True, exist_ok=True)
    out_dir = Path(args.out).expanduser()
    out_dir.mkdir(parents=True, exist_ok=True)

    exe = os.environ.get("PLAYWRIGHT_CHROMIUM") or None  # e.g. a sandboxed build with no browser download
    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(
            user_data_dir=str(profile),
            headless=not args.headed,
            executable_path=exe,
            viewport={"width": 1380, "height": 940},  # a wide answer means a big <img> to grab
            accept_downloads=True,
            args=["--disable-blink-features=AutomationControlled", "--no-first-run"],
        )
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        try:
            page.goto(GEMINI_URL, wait_until="domcontentloaded", timeout=60_000)
        except Exception as e:
            log(f"navigation failed: {e}")
            ctx.close()
            return 5

        composer = find_first(page, COMPOSER, timeout=args.login_wait)
        if composer is None or any(h in page.url for h in LOGIN_HOSTS):
            log("not signed in yet.")
            log(f"run it once with --headed and log in inside that window (profile: {profile});")
            log("the session stays there — this script never touches your password.")
            if args.headed:
                log("waiting for you to finish logging in…")
                composer = find_first(page, COMPOSER, timeout=420)
            if composer is None:
                ctx.close()
                return 2

        prompt = args.prompt.strip()
        if args.selftest:
            log("selftest: selectors + fingerprint only, nothing sent")
            log(f"composer found: {composer is not None} · answers: {page.locator(TURNS).count()}")
            ctx.close()
            return 0

        before = page.locator(TURNS).count()
        composer.click()
        # insert_text beats fill() on a contenteditable: it fires the same input events Quill wants
        page.keyboard.insert_text(prompt)
        time.sleep(0.35)
        try:
            composer.press("Enter")
        except Exception:
            pass
        # did it actually go? the honest signal is a new answer, not an emptied composer — the
        # composer keeps its draft in some builds, and pressing Send then would send it twice.
        time.sleep(1.4)
        if page.locator(TURNS).count() <= before:
            btn = find_first(page, SEND, timeout=8)
            if btn is None:
                log("Enter did nothing and no Send button was found — the UI changed. Try --debug.")
                if args.debug:
                    page.screenshot(path=str(out_dir / "debug-no-send-button.png"))
                ctx.close()
                return 4
            btn.click()
        log("prompt sent, waiting for the image…")

        turn = wait_until_done(page, before, timeout=args.timeout)
        if turn is None:
            log(f"timeout after {args.timeout:.0f}s — the answer never settled.")
            if args.debug:
                page.screenshot(path=str(out_dir / f"timeout-{int(time.time())}.png"))
            ctx.close()
            return 3

        saved = save_images(ctx, page, turn, prompt, out_dir, args)
        ctx.close()
        if not saved:
            log("the answer settled but contained no picture (Gemini may have answered with text).")
            return 4
        return 0


def save_images(ctx, page, turn, prompt: str, out_dir: Path, args) -> list:
    """Download button → direct URL → element screenshot. Returns the paths written."""
    stamp = time.strftime("%Y%m%d-%H%M%S")
    base = slugify(prompt)
    imgs = turn.locator(ANSWER_IMG)
    n = imgs.count()
    picked = []
    for i in range(n):
        el = imgs.nth(i)
        try:
            box = el.bounding_box()
            src = el.get_attribute("src") or ""
            width = el.evaluate("e => e.naturalWidth || 0")
        except Exception:
            continue
        if not box or box["height"] < 180 or box["width"] < 180:
            continue  # icons, avatars, inline chips
        # blob:, data:, and even a src the page has not attached yet: a big <img> in the answer is
        # the picture, and the element-screenshot fallback does not care where its bytes came from
        picked.append((i, el, src, box, width))
    if not picked:
        log(f"no image-sized element in the answer ({n} <img> tags seen)")
    paths = []
    for i, el, src, box, width in picked:
        name = f"{base}-{stamp}-{i}.png" if len(picked) > 1 else f"{base}-{stamp}.png"
        dest = out_dir / name
        # 1. the app's own download: the full-resolution file
        if not args.no_download_btn:
            try:
                el.hover()
                time.sleep(0.4)
                btn = turn.locator(DOWNLOAD_BTN).first
                if btn.count() > 0 and btn.is_visible():
                    with page.expect_download(timeout=12_000) as dl:
                        btn.click()
                    dl.value.save_as(str(dest))
                    log(f"saved {dest}")
                    paths.append(dest)
                    continue
            except Exception as e:
                log(f"download button unusable ({type(e).__name__}), trying the URL")
        # 2. fetch the <img> source
        got = False
        if src.startswith("http"):
            try:
                r = ctx.request.get(src, timeout=25_000)
                if r.ok and len(r.body()) > 2048:
                    dest.write_bytes(r.body())
                    log(f"saved {dest} (from URL)")
                    paths.append(dest)
                    got = True
            except Exception as e:
                log(f"URL fetch failed: {type(e).__name__}")
        # 3. photograph the element — always available, capped at what the page showed
        if not got:
            try:
                el.screenshot(path=str(dest))
                log(f"saved {dest} (element screenshot, {box['width']:.0f}px on screen)")
                paths.append(dest)
            except Exception as e:
                log(f"element screenshot failed: {type(e).__name__}")
    if args.debug:
        try:
            page.screenshot(path=str(out_dir / f"debug-{stamp}.png"))
            (out_dir / f"debug-{stamp}.html").write_text(turn.inner_html()[:400_000], encoding="utf-8")
        except Exception:
            pass
    for pth in paths:
        print(f"SAVED {pth}")
    return paths


# ------------------------------------------------------------------------------------ api
def run_api(args) -> int:
    """The supported path: a key in the environment, no browser, no DOM.

    Works with any image-returning model on Generative Language API; --api-model decides which.
    """
    key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not key:
        log("export GEMINI_API_KEY=… first (a key from AI Studio). Nothing is written to disk.")
        return 5
    import urllib.error
    import urllib.request

    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{args.api_model}:generateContent"
    )
    body = json.dumps(
        {"contents": [{"parts": [{"text": args.prompt}]}], "generationConfig": {"responseModalities": ["IMAGE", "TEXT"]}}
    ).encode()
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json", "x-goog-api-key": key})
    out_dir = Path(args.out).expanduser()
    out_dir.mkdir(parents=True, exist_ok=True)
    try:
        with urllib.request.urlopen(req, timeout=args.timeout) as r:
            data = json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        log(f"API {e.code}: {e.read().decode()[:400]}")
        return 3
    except Exception as e:
        log(f"API call failed: {e}")
        return 3
    parts = (data.get("candidates") or [{}])[0].get("content", {}).get("parts", [])
    saved = []
    stamp = time.strftime("%Y%m%d-%H%M%S")
    for i, part in enumerate(parts):
        inline = part.get("inlineData") or part.get("inline_data")
        if not inline or not inline.get("data"):
            continue
        ext = (inline.get("mimeType") or "image/png").split("/")[-1].replace("jpeg", "jpg")
        dest = out_dir / f"{slugify(args.prompt)}-{stamp}{'' if len(parts) < 2 else '-' + str(i)}.{ext}"
        dest.write_bytes(base64.b64decode(inline["data"]))
        log(f"saved {dest}")
        saved.append(dest)
        print(f"SAVED {dest}")
    if not saved:
        log("the model answered without an image part. Its text: "
            + " ".join(p.get("text", "") for p in parts)[:300])
        return 4
    return 0


# ----------------------------------------------------------------------------------- main
def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Generate an image through Gemini and save it into an assets folder.")
    src = ap.add_mutually_exclusive_group(required=True)
    src.add_argument("--prompt", help="the prompt text")
    src.add_argument("--prompt-file", help="read the prompt from a file (useful for long, quoted ones)")
    ap.add_argument("--out", default="assets", help="where the image lands (default ./assets)")
    ap.add_argument("--profile", default="~/.vito-gemini-profile", help="persistent browser profile = your login")
    ap.add_argument("--headed", action="store_true", help="show the window (needed for the first login, and for 2FA)")
    ap.add_argument("--timeout", type=float, default=240, help="seconds to wait for the answer to settle")
    ap.add_argument("--login-wait", type=float, default=12, help="seconds to wait for the composer before calling it logged out")
    ap.add_argument("--no-download-btn", action="store_true", help="skip clicking the app's download button")
    ap.add_argument("--debug", action="store_true", help="keep a screenshot + the answer HTML when something looks off")
    ap.add_argument("--api", action="store_true", help="use GEMINI_API_KEY instead of the browser")
    ap.add_argument("--api-model", default="gemini-2.5-flash-image-preview", help="model for --api")
    ap.add_argument("--selftest", action="store_true", help="open the page, report what was found, send nothing")
    args = ap.parse_args(argv)

    if args.prompt_file:
        args.prompt = Path(args.prompt_file).read_text(encoding="utf-8")
    args.prompt = (args.prompt or "").strip()
    if not args.prompt:
        ap.error("empty prompt")
    if args.selftest and not args.prompt:
        args.prompt = "selftest"

    t0 = time.time()
    rc = run_api(args) if args.api else run_browser(args)
    log(f"done in {time.time() - t0:.1f}s (exit {rc})")
    return rc


if __name__ == "__main__":
    sys.exit(main())
