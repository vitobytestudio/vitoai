#!/usr/bin/env python3
"""Latin glyph guard for the NEXUS film.

Same failure mode as the Arabic one: this box has zero system fonts, so any
character absent from the bundled faces kills the Chromium tab with the useless
"Target closed" message. Known absences: arrows (U+2192), most emoji, box
drawing, and every symbol above U+2200 except what the Latin subsets carry.
"""
import glob
import re
import sys
from fontTools.ttLib import TTFont

FONTS = "public/fonts"


def cov(pattern):
    s = set()
    for p in glob.glob(f"{FONTS}/{pattern}"):
        f = TTFont(p)
        for t in f["cmap"].tables:
            s |= set(t.cmap.keys())
    return s


ALL = (
    cov("*latin*.woff2")
    | cov("*mono*.woff2")
    | cov("*sora*")
    | cov("*tajawal*")
    | cov("*cairo-arabic*")
    | cov("*plex*")
    | {0x20, 0xA0}
)

WS = {0x20, 0xA0, 0x09, 0x0A, 0x0D}


def strings(path):
    raw = open(path, encoding="utf-8").read()
    src = re.sub(r"/\*.*?\*/", "", raw, flags=re.S)
    src = re.sub(r"//[^\n]*", "", src)
    out = [(m.group(1), src[: m.start()].count("\n") + 1) for m in re.finditer(r'"([^"\n]*)"', src)]
    for m in re.finditer(r">\s*([^<>{}]+?)\s*<", src):
        if any(ord(c) > 0x7F for c in m.group(1)):
            out.append((m.group(1), src[: m.start()].count("\n") + 1))
    return out


bad = 0
for path in sorted(glob.glob("src/nexus/*.tsx")) + sorted(glob.glob("src/cloudflare/*.tsx")):
    for text, line in strings(path):
        miss = sorted({c for c in text if ord(c) not in ALL and ord(c) not in WS})
        if miss:
            bad += 1
            chars = " ".join("'" + c + "' U+" + format(ord(c), "04X") for c in miss)
            print(f"BROKEN {path}:{line}  {chars}  | {text[:60]}")

print("\nOK - every glyph resolves" if bad == 0 else f"\n{bad} string(s) would crash the tab")
sys.exit(1 if bad else 0)
