#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Drive the Gemini web app from a script: send a prompt, wait for the picture, save it.

    # once, in a real window, to mint a reusable session
    python3 tools/save_session.py                        # → ./storage_state.json

    # every run after that: headless, no window, no interaction
    python3 tools/gemini_image.py --prompt-file shot.txt --out assets \
        --storage-state storage_state.json

    # or with whatever the browser extension exported
    python3 tools/gemini_image.py --prompt "…" --cookies gemini_cookies.json --out assets

How it stays boring to run
--------------------------
* **It never sees your password.** A session is a *file you made yourself* — the cookies are
  injected into an ephemeral context (``--storage-state`` / ``--cookies``) and their values are
  never printed. No file? Then it falls back to a persistent profile (``--profile``) that you
  sign into once, in a window, on your own machine.
* **A dead session says so and leaves.** If the injected cookies are refused, expired, or bounced
  to the login page, the script prints one line — ``[ERROR] Session expired, please update
  cookies.json`` — closes the browser and exits 2. It never sits there waiting for a human in a
  run that was asked to be headless.
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

Exit codes: 0 ok · 2 session expired / login needed · 3 timeout · 4 no image in the answer · 5 environment.
A session file is a credential: keep it out of git (see .gitignore) and out of chat.
"""
from __future__ import annotations

import argparse
import base64

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


# ------------------------------------------------------------------- session machinery
SESSION_ERR = "[ERROR] Session expired, please update cookies.json"
# DevTools, Playwright and the cookie extensions all spell this differently, and Playwright
# throws on a value it does not know — so anything is allowed in, and only these come out.
SAME_SITE = {"strict": "Strict", "lax": "Lax", "none": "None", "norestriction": "None",
             "unrestricted": "None", "unspecified": "Lax"}
CONSENT = [
    'button:has-text("Accept all")',
    'button:has-text("التالي")',
    'button[aria-label*="accept" i]',
    'form[action*="consent"] button[type="submit"]',
]


def _cookie(d: dict):
    """One cookie, cleaned enough that Playwright will take it.

    add_cookies is picky in ways an export is not: it wants path *and* domain (or a url), an
    expiry that isn't a string of "-1", and a sameSite enum it recognises. Rather than let a
    single odd row throw a traceback on the night you need the render, each unusable piece is
    repaired here and each unusable *cookie* is dropped.
    """
    name, value = str(d.get("name") or ""), d.get("value")
    if not name or value is None:
        return None
    out = {"name": name, "value": str(value)}
    if d.get("domain"):
        out["domain"] = str(d["domain"])
        out["path"] = str(d.get("path") or "/")
    elif d.get("url"):
        out["url"] = str(d["url"])
    else:
        return None
    try:
        exp = float(d.get("expires", -1))
        if exp > 0:
            out["expires"] = exp
    except (TypeError, ValueError):
        pass
    if d.get("httpOnly"):
        out["httpOnly"] = True
    if d.get("secure"):
        out["secure"] = True
    ss = SAME_SITE.get(re.sub(r"[^a-z]", "", str(d.get("sameSite") or "").lower()))
    if ss:
        if ss == "None":
            out["secure"] = True  # SameSite=None without Secure is refused outright
        out["sameSite"] = ss
    return out


def load_state(path: Path) -> dict:
    """Read whatever the browser exported and return a Playwright storage_state.

    Three shapes are in the wild and all three are accepted: Playwright's own
    ``{"cookies": [...], "origins": [...]}`` (what tools/save_session.py writes), a bare JSON list
    of cookie objects, and the Netscape ``cookies.txt`` that "Get cookies.txt"-style extensions
    produce — including the ``#HttpOnly_`` rows that look like comments and are not.
    """
    text = path.read_text(encoding="utf-8", errors="replace")
    cookies, origins = [], []
    if text.lstrip()[:1] in ("{", "["):
        data = json.loads(text)
        if isinstance(data, dict):
            cookies, origins = data.get("cookies") or [], data.get("origins") or []
        else:
            cookies = data
    else:
        for line in text.splitlines():
            line = line.strip()
            if not line or (line.startswith("#") and not line.startswith("#HttpOnly_")):
                continue
            http_only = line.startswith("#HttpOnly_")
            if http_only:
                line = line[len("#HttpOnly_"):]
            f = line.split("\t")
            if len(f) < 7:
                continue
            domain, flag, cpath, secure, expires, name, value = f[:7]
            cookies.append({
                "domain": domain, "name": name, "value": value, "path": cpath or "/",
                "expires": expires, "secure": secure.strip().upper() == "TRUE",
                "httpOnly": http_only or flag.strip().upper() == "TRUE",
            })
    jar = [c for c in (_cookie(d) for d in cookies if isinstance(d, dict)) if c]
    return {"cookies": jar, "origins": origins}


def localstorage_script(origins: list) -> str:
    """Replay localStorage for the origin a page actually loads, so Google's own flags are set."""
    pairs = [
        {"origin": o.get("origin"), "items": o.get("localStorage") or o.get("itemData") or []}
        for o in origins if isinstance(o, dict) and o.get("origin")
    ]
    if not pairs:
        return ""
    return "(() => { try { const D = %s; const e = D.find(x => x.origin === location.origin);" \
           " if (!e) return; for (const it of (e.items || [])) { try { localStorage.setItem(it.name, it.value); } catch (_) {} } }" \
           " catch (_) {} })();" % json.dumps(pairs)


def wait_for_composer(page, timeout: float):
    """Clear the consent wall if there is one, then return the composer — or None.

    "Is the session alive?" is answered by the page, not by the URL: everything Google shows
    before login (account chooser, consent interstitial, the cookie-less shell) has no composer,
    so 'no composer within N seconds' is the test. That also catches the case where the cookies
    were accepted, the app drew itself, and the account is still signed out underneath.
    """
    if "consent.google.com" in page.url:
        agree = find_first(page, CONSENT, timeout=5)
        if agree is not None:
            log("consent wall — accepting once for this context")
            try:
                agree.click()
                page.wait_for_load_state("domcontentloaded", timeout=20_000)
            except Exception:
                pass
    return find_first(page, COMPOSER, timeout=timeout)


# ------------------------------------------------------------------------------ browser
def run_browser(args) -> int:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        log("playwright isn't installed here:  pip install playwright && playwright install chromium")
        return 5

    out_dir = Path(args.out).expanduser()
    out_dir.mkdir(parents=True, exist_ok=True)

    # ---- the session: a file you made, or the persistent profile this script owns
    state = None
    state_file = args.storage_state or args.cookies
    if state_file:
        state_path = Path(state_file).expanduser()
        if not state_path.exists():
            log(f"no session file at {state_path}")
            print(SESSION_ERR, flush=True)
            log(f"make one:  python3 tools/save_session.py --out {state_file}")
            return 2
        try:
            state = load_state(state_path)
        except Exception as e:
            log(f"could not read {state_path.name}: {type(e).__name__}: {e}")
            print(SESSION_ERR, flush=True)
            return 2
        if not state["cookies"]:
            log(f"{state_path.name} parsed, but held no usable cookie")
            print(SESSION_ERR, flush=True)
            return 2
        log(f"injected {len(state['cookies'])} cookies + {len(state['origins'])} origins "
            f"from {state_path.name} (values never shown)")
    else:
        profile = Path(args.profile).expanduser()
        profile.mkdir(parents=True, exist_ok=True)

    exe = os.environ.get("PLAYWRIGHT_CHROMIUM") or None  # e.g. a sandboxed build with no browser download
    launch_args = ["--disable-blink-features=AutomationControlled", "--no-first-run"]
    ctx_kwargs = {
        "viewport": {"width": 1380, "height": 940},  # a wide answer means a big <img> to grab
        "accept_downloads": True,
    }
    with sync_playwright() as p:
        browser = None
        if state is not None:
            # No profile, no window: an ephemeral context wearing your cookies.
            browser = p.chromium.launch(headless=not args.headed, executable_path=exe, args=launch_args)
            try:
                ctx = browser.new_context(storage_state=state, **ctx_kwargs)
            except TypeError:
                ctx = browser.new_context(**ctx_kwargs)  # Playwright without storage_state here
                ctx.add_cookies(state["cookies"])
            js = localstorage_script(state["origins"])
            if js:
                ctx.add_init_script(js)
        else:
            ctx = p.chromium.launch_persistent_context(
                user_data_dir=str(profile),
                headless=not args.headed,
                executable_path=exe,
                args=launch_args,
                **ctx_kwargs,
            )
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        try:
            page.goto(GEMINI_URL, wait_until="domcontentloaded", timeout=60_000)
        except Exception as e:
            log(f"navigation failed: {e}")
            ctx.close()
            return 5

        composer = wait_for_composer(page, args.login_wait)
        if composer is None:
            if state is not None:
                # the one thing a headless run must do: say what happened, then leave
                print(SESSION_ERR, flush=True)
                log(f"the session in {Path(state_file).name} was not accepted (expired, revoked, or stale).")
                log(f"  refresh it:  python3 tools/save_session.py --out {state_file}")
                ctx.close()
                return 2
            log("not signed in yet — no window is needed until this first time:")
            log(f"log in once in the browser this script opens (profile dir: {profile});")
            log("the session stays in that directory. Your password is never typed into this script.")
            if args.headed:
                composer = wait_for_composer(page, 420)
            if composer is None:
                ctx.close()
                return 2

        prompt = args.prompt.strip()
        if args.selftest:
            log("selftest: selectors and session only, nothing sent")
            log(f"composer: {composer is not None} · answers on screen: {page.locator(TURNS).count()} "
                f"· session: {'injected file' if state else 'profile'}")
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
            if any(h in page.url for h in LOGIN_HOSTS):
                # the session held long enough to send, then gave out mid-generation
                print(SESSION_ERR, flush=True)
                log("the login page took over while the answer was generating.")
                ctx.close()
                return 2
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
    ap.add_argument("--profile", default="~/.vito-gemini-profile", help="persistent browser profile, used only when no session file is given")
    ap.add_argument("--storage-state", help="Playwright storage_state.json (from tools/save_session.py): headless, no window, no interaction")
    ap.add_argument("--cookies", help="cookies to inject instead: Playwright JSON, a bare cookie list, or a Netscape cookies.txt")
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
