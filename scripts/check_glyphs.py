#!/usr/bin/env python3
"""
GLYPH COVERAGE GATE  —  build-stage validation (STEP 2 of build_video.sh)
=========================================================================
This render machine has NO system fonts (fc-list = 0). If any character in the
composition is missing from every embedded face, Chromium asks fontconfig for a
fallback, hits a stub, and the renderer process dies ("Target closed").

This script is the guard: it extracts every non-ASCII character used in src/,
checks it against the real cmap tables of the embedded woff2 files, and exits
non-zero if anything is uncovered.

usage: python3 scripts/check_glyphs.py
"""
import glob
import os
import re
import sys

from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT_DIR = os.path.join(ROOT, "public", "fonts")
SRC_DIR = os.path.join(ROOT, "src")

# family -> set of codepoints
COVERAGE: dict[str, set[int]] = {}
FAMILY_OF_FILE = {
    "cairo-": "Cairo",
    "tajawal-": "Tajawal",
    "ibm-plex-sans-arabic-": "IBM Plex Sans Arabic",
    "space-grotesk-": "Space Grotesk",
    "sora-": "Sora",
    "jetbrains-mono-": "JetBrains Mono",
}

for path in glob.glob(os.path.join(FONT_DIR, "*.woff2")):
    name = os.path.basename(path)
    family = next((v for k, v in FAMILY_OF_FILE.items() if name.startswith(k)), None)
    if not family:
        continue
    font = TTFont(path)
    COVERAGE.setdefault(family, set()).update(font.getBestCmap().keys())

ARABIC_FAMILIES = {
    fam for fam, cps in COVERAGE.items() if any(0x600 <= cp <= 0x6FF for cp in cps)
}

ALL = set().union(*COVERAGE.values()) if COVERAGE else set()

# Strings that are code-only (comments / ids) are ignored by scanning only
# string literals and JSX text, which is what actually gets painted.
LITERAL_RE = re.compile(r'"((?:[^"\\]|\\.)*)"|\'((?:[^\'\\]|\\.)*)\'|`((?:[^`\\]|\\.)*)`|>([^<>{}]+)<')
COMMENT_RE = re.compile(r"^\s*(//|\*|/\*)", re.MULTILINE)


def iter_chars():
    for dirpath, _, files in os.walk(SRC_DIR):
        for fn in files:
            if not fn.endswith((".ts", ".tsx")):
                continue
            path = os.path.join(dirpath, fn)
            raw = open(path, encoding="utf-8").read()
            # strip comments so documentation doesn't fail the gate
            raw = re.sub(r"/\*.*?\*/", "", raw, flags=re.S)
            raw = re.sub(r"//.*$", "", raw, flags=re.M)
            for m in LITERAL_RE.finditer(raw):
                text = next(g for g in m.groups() if g is not None)
                for ch in text:
                    if ord(ch) < 128:
                        continue
                    yield ch, os.path.relpath(path, ROOT)


def main() -> int:
    missing: dict[str, list[str]] = {}
    per_char_where: dict[int, set[str]] = {}
    for ch, where in iter_chars():
        cp = ord(ch)
        per_char_where.setdefault(cp, set()).add(where)
        if cp not in ALL:
            missing.setdefault(ch, []).append(where)

    print(f"embedded families : {', '.join(sorted(COVERAGE))}")
    print(f"arabic-capable    : {', '.join(sorted(ARABIC_FAMILIES))}")
    print(f"distinct chars    : {len(per_char_where)}")

    if missing:
        print("\nUNCOVERED GLYPHS (would crash the renderer):")
        for ch, where in sorted(missing.items()):
            print(f"  U+{ord(ch):04X} {ch!r:6s} in {sorted(set(where))[:3]}")
        return 1

    # every face must own the space character — a missing U+0020 renders as a
    # .notdef box between words (this exact bug shipped once and was caught here)
    for fam, cps in COVERAGE.items():
        if 0x20 not in cps:
            print(f"\nSPACE MISSING from {fam} — inter-word gaps will draw .notdef boxes")
            return 1

    # chars that may only ever be painted by an arabic-capable family
    hard = [
        (cp, ch)
        for cp, ch in ((cp, chr(cp)) for cp in per_char_where)
        if 0x600 <= cp <= 0x6FF and not any(cp in COVERAGE[f] for f in ARABIC_FAMILIES)
    ]
    if hard:
        print("\nARABIC GLYPHS NOT IN ANY ARABIC FACE:")
        for cp, ch in hard:
            print(f"  U+{cp:04X} {ch!r}")
        return 1

    print("all glyphs covered ✓")
    return 0


if __name__ == "__main__":
    sys.exit(main())
