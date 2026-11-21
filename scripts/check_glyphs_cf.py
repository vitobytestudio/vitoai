#!/usr/bin/env python3
"""
Glyph guard.

This sandbox has ZERO system fonts. A character that no @font-face in the
element's `font-family` stack covers makes Chromium fall back to a font that
does not exist, and the renderer tab dies with the useless message
"Target closed" — no stack, no hint. This tool finds those characters offline.

The coverage facts it encodes:
  Cairo ARABIC subset (400/700/800/900) -> Arabic block only. NO Latin
      punctuation, NO em dash, NO middle dot, NO '%'.
  Cairo LATIN subset (800/900 only)     -> ASCII + U+2000-206F (em dash, ·, %).
      It DOES NOT EXIST at 400/700.
  => Arabic copy is only safe at weight 900 when it contains any Latin or
     punctuation character. At weight 700 it must be Arabic-block-only.
"""
import glob
import re
import sys

from fontTools.ttLib import TTFont

FONTS = "public/fonts"
ARABIC_BLOCK = range(0x0600, 0x0700)
SAFE_ARABIC_PUNCT = {0x060C, 0x061B, 0x061F, 0x066A, 0x066B, 0x066C, 0x0640}


def cmap(path):
    f = TTFont(path)
    s = set()
    for t in f["cmap"].tables:
        s |= set(t.cmap.keys())
    return s


AR = {w: cmap(f"{FONTS}/cairo-arabic-{w}-normal.woff2") for w in (400, 700, 800, 900)}
LAT = {w: cmap(f"{FONTS}/cairo-latin-{w}-normal.woff2") for w in (800, 900)}
TAJ = cmap(f"{FONTS}/tajawal-arabic-800-normal.woff2")
EN = cmap(f"{FONTS}/space-grotesk-latin-700-normal.woff2") | cmap(f"{FONTS}/sora-latin-600-normal.woff2")
MONO = cmap(f"{FONTS}/jetbrains-mono-latin-500-normal.woff2")


def arabic_stack(weight):
    """Cairo + Tajawal + sans-serif fallback (sans-serif has nothing here)."""
    w = weight if weight in AR else (900 if weight >= 800 else 700 if weight >= 500 else 400)
    s = set(AR[w]) | TAJ
    if w in LAT:
        s |= LAT[w]
    return s, w


def strings_in(path):
    """Quoted strings AND JSX text nodes — the crash that started this came from
    a JSX text node, which a quotes-only scan cannot see."""
    raw = open(path, encoding="utf-8").read()
    src = re.sub(r"/\*.*?\*/", "", raw, flags=re.S)
    src = re.sub(r"//[^\n]*", "", src)
    out = [(m.group(1), src[: m.start()].count("\n") + 1) for m in re.finditer(r'"([^"\n]*)"', src)]
    for m in re.finditer(r">\s*([^<>{}]+?)\s*<", src):
        txt = m.group(1)
        if any(ord(c) > 0x7F for c in txt):
            out.append((txt, src[: m.start()].count("\n") + 1))
    return out


def main():
    files = sys.argv[1:] or glob.glob("src/cloudflare/*.tsx")
    broken = 0
    needs900 = []
    for path in files:
        for text, line in strings_in(path):
            if not text.strip():
                continue
            arabic = any(ord(c) in ARABIC_BLOCK for c in text)
            if not arabic:
                miss = sorted({c for c in text if ord(c) not in (EN | MONO)})
                if miss:
                    broken += 1
                    chs = " ".join("'" + c + "' U+" + format(ord(c), "04X") for c in miss)
                    print(f"BROKEN  {path}:{line}  latin  {chs}  | {text[:60]}")
                continue
            ok700 = all(ord(c) in arabic_stack(700)[0] for c in text)
            ok900 = all(ord(c) in arabic_stack(900)[0] for c in text)
            if not ok900:
                broken += 1
                miss = sorted({c for c in text if ord(c) not in arabic_stack(900)[0]})
                chs = " ".join("'" + c + "' U+" + format(ord(c), "04X") for c in miss)
                print(f"BROKEN  {path}:{line}  {chs}  | {text[:60]}")
            elif not ok700:
                bad700 = sorted({c for c in text if ord(c) not in arabic_stack(700)[0]})
                needs900.append((path, line, " ".join(f"'{c}' U+{ord(c):04X}" for c in bad700), text[:60]))
    for p, l, ch, t in needs900:
        print(f"NEEDS-900 {p}:{l}  {ch}  | {t}")
    print(f"\n{'OK — nothing can crash' if broken == 0 else f'{broken} string(s) would crash the tab'}"
          f"{f' · {len(needs900)} must be painted at weight 900' if needs900 else ''}")
    return 1 if broken else 0


sys.exit(main())
