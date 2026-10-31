#!/usr/bin/env python3
"""
check_mix.py — is this film over-relying on 3D?

The rule (DESIGN.md): 3D is for ideas that are genuinely spatial — a network, a
globe, a swarm, an object you turn. Everything else is better served by
typography, grids, data and cuts. If more than a third of the beats are 3D, the
film stops feeling designed and starts feeling like a tech demo.

This counts beats whose JSX calls a spatial primitive, and prints the mix.
Heuristic, but honest: it reads the actual composition, not a spec.
"""
import re
import sys

SPATIAL = ("Warp", "Swarm", "PanelWall", "MarkCloud", "Extrude", "NexusNet", "Globe", "Net3D")
# Warp is the travel layer — it is scenery, not a 3D subject. Counted separately.
SCENERY = {"Warp"}


def analyse(path):
    lines = open(path, encoding="utf-8").read().splitlines()
    beats = []  # (letter, start_line)
    # only TOP-LEVEL beat blocks: `      {inB ? (` on its own line.
    # An earlier version matched nested ternaries and produced 18 "beats".
    for i, ln in enumerate(lines):
        m = re.match(r"^ {6}\{in([A-Z]) \? \($", ln)
        if m:
            beats.append((m.group(1), i))
    if not beats:
        return None
    beats.append(("*", len(lines)))

    result = []
    for k in range(len(beats) - 1):
        letter, start = beats[k]
        end = beats[k + 1][1]
        body = "\n".join(lines[start:end])
        used = sorted({p for p in SPATIAL if re.search(rf"<{p}\b", body)})
        subject = [p for p in used if p not in SCENERY]
        result.append((letter, used, subject))
    return result


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else "src/nexus3d/Reel.tsx"
    res = analyse(path)
    if not res:
        print("no beats found"); return 1
    total = len(res)
    spatial = [b for b in res if b[2]]
    print(f"\n{path}")
    print(f"{'beat':6} {'primitives'}")
    for letter, used, _ in res:
        tag = "  <- 3D subject" if _ else ""
        print(f"  {letter:<4} {', '.join(used) if used else 'flat'}{tag}")
    ratio = len(spatial) / total
    print(f"\n3D SUBJECT BEATS: {len(spatial)}/{total}  ({ratio*100:.0f}%)")
    if ratio > 0.34:
        print("VERDICT: too much 3D — a third is the ceiling. Replace the weakest")
        print("         beats with type, data and cuts (see DESIGN.md).")
        return 2
    print("VERDICT: healthy mix")
    return 0


sys.exit(main())
