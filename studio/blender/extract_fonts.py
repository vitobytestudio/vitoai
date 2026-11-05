"""Unpack the film's fonts out of src/fontData.ts into /tmp/fonts/*.ttf.

The fonts live in the repo only as woff2 base64 (that is what the browser needs), and
bpy wants real font files. fontTools round-trips one weight per file.
"""
from __future__ import annotations

import base64
import io
import os
import re
import sys

from fontTools.ttLib import TTFont

SRC = os.path.join(os.path.dirname(__file__), "..", "..", "src", "fontData.ts")
OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp/fonts"

os.makedirs(OUT, exist_ok=True)
src = open(SRC, encoding="utf-8").read()
items = re.findall(r'\{ family: "([^"]+)", weight: (\d+), range: "[^"]*", b64: "([^"]+)" \}', src)
seen = set()
for fam, w, b64 in items:
    if (fam, w) in seen:
        continue
    seen.add((fam, w))
    f = TTFont(io.BytesIO(base64.b64decode(b64)))
    f.flavor = None
    out = os.path.join(OUT, "%s-%s.ttf" % (fam.replace(" ", "_"), w))
    f.save(out)
    print("OK", out, "|", f["name"].getDebugName(4))
