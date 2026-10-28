#!/usr/bin/env python3
"""
STAGE 2 — caption exporter.

Whisper (openai-whisper with word_timestamps=True) emits:
    {"segments": [{"words": [{"word": "...", "start": 1.23, "end": 1.51}]}]}

This sandbox has no network access to the model weights, so the authored,
frame-accurate timeline in src/data/captions.ts is the canonical source. It is
parsed here into the exact Whisper schema (seconds, word-level) so downstream
burn-in / re-timing tools can consume it unchanged.
"""
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "src", "data", "captions.ts")
OUT = os.path.join(ROOT, "src", "data", "subtitles.json")
FPS = 60

text = open(SRC, encoding="utf-8").read()

# each word entry looks like: { text: "…", from: 8, to: 30, emph: true }
WORD_RE = re.compile(r'\{\s*text:\s*"((?:[^"\\]|\\.)*)",\s*from:\s*(\d+),\s*to:\s*(\d+)(?:,\s*emph:\s*true)?\s*\}')

words = []
for m in WORD_RE.finditer(text):
    w, f, t = m.group(1), int(m.group(2)), int(m.group(3))
    words.append(
        {
            "word": w,
            "start": round(f / FPS, 4),
            "end": round(t / FPS, 4),
            "frame_start": f,
            "frame_end": t,
        }
    )

words.sort(key=lambda w: (w["frame_start"], w["frame_end"]))
payload = {
    "generator": "vitoai/export_captions.py",
    "fps": FPS,
    "model": "authored-alignment (whisper-schema compatible)",
    "language": "ar",
    "word_count": len(words),
    "segments": [{"id": i, "start": w["start"], "end": w["end"], "words": [w]} for i, w in enumerate(words)],
}
with open(OUT, "w", encoding="utf-8") as fh:
    json.dump(payload, fh, ensure_ascii=False, indent=2)
print(f"  {len(words)} words → {os.path.relpath(OUT, ROOT)}")
