#!/usr/bin/env python3
"""fontlint — لا يُسمحُ بأن يخرجَ حرفٌ على الشاشة بلا خطٍّ يملكه.

الحقيقةُ التي كادت تُفقدُ الشريطَ كلَّه: في هذا الصندوقِ لا خطَّ نظامٍ إطلاقاً، فأيُّ
رمزٍ خارجَ كلّ unicode-range مُعلَنٍ في src/fontData.ts لا يسقطُ إلى بديلٍ صامتٍ بل
يُعلّقُ صفحةَ Chromium إلى الأبد (علامةُ ذلك: `Request to extract frame ... closed`)،
أو يُرسَمُ مربّعاً فارغاً في بطاقاتِ المواصفات (σ). القراءةُ وحدها لا تكفي، لذا هذا
البابُ يفتحُ الخطوطَ نفسَها (woff2 مُضمَّنٌ base64 في المستودع، نفكُّه بـfontTools)
ويقرأُ cmap الحقيقيَّ لكلَّ وجه، ثم يمشي على كلِّ نصٍّ سيُرسَمُ ويقولُ: هذا الحرفُ
يملكُه هذا الوجه، أو لا يملكُه أحد.

  "$AIVENV/bin/python" scripts/fontlint.py            # src/phone/*.tsx + captions/spec
  "$AIVENV/bin/python" scripts/fontlint.py --json      # للآلة
خروجٌ غيرُ صفري عند حرفٍ لا يملكُه أحد؛ تحذيرٌ عند حرفٍ يملكُه وجهٌ متأخّرٌ في السلسلة.
"""
from __future__ import annotations

import argparse
import base64
import io
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

# رموزُ CSS/الصمتِ لا تُرسَمُ كحروفٍ في المتصفّح، فلا تُحاسب
EXEMPT = set("\u0020\u00a0\u200b\u200e\u200f\u000a\u0009")


def load_faces() -> list[dict]:
    """يفكّ كلَّ وجهٍ من fontData.ts ويردّ {family, weight, tag, cps:set, declared:str}."""
    from fontTools.ttLib import TTFont

    src = open(os.path.join(ROOT, "src/fontData.ts"), encoding="utf-8").read()
    faces = []
    for m in re.finditer(r'family:\s*"([^"]+)",\s*weight:\s*(\d+),\s*range:\s*"([^"]+)",\s*b64:\s*"([^"]+)"', src):
        fam, wt, rng, b64 = m.group(1), int(m.group(2)), m.group(3), m.group(4)
        raw = base64.b64decode(b64)
        tag = "ar" if "U+0600-06FF" in rng else "lat"
        f = TTFont(io.BytesIO(raw))
        cps: set[int] = set()
        for t in f["cmap"].tables:
            cps |= set(t.cmap.keys())
        faces.append({"family": fam, "weight": wt, "tag": tag, "cps": cps, "declared": rng,
                      "glyphs": len(f.getGlyphOrder())})
    return faces


def declared_set(rng: str) -> set[int]:
    out: set[int] = set()
    for part in rng.split(","):
        part = part.strip()
        m = re.match(r"U\+([0-9A-Fa-f]{4,6})(?:-([0-9A-Fa-f]{4,6}))?$", part)
        if not m:
            continue
        a = int(m.group(1), 16)
        b = int(m.group(2), 16) if m.group(2) else a
        out |= set(range(a, b + 1))
    return out


def stacks_from(comp_path: str, families: set[str] | None = None) -> dict[str, list[str]]:
    """يقرأُ const AR / ARUI (سلاسلُ fontFamily) من ملفّ المكوّن، ويستبقي ما يملكُ وجهاً معروفاً."""
    s = open(comp_path, encoding="utf-8").read()
    out: dict[str, list[str]] = {}
    fams = set(families or ())
    for m in re.finditer(r"const\s+(\w+)\s*(?::[^=]*)?=\s*(\[[^\]]*\]|'[^']*'|\"[^\"]*\")", s):
        raw = m.group(2)
        if raw.startswith(("[",)):
            names = re.findall(r'"([^"]+)"|' + "'([^']+)'", raw)
            names = [a or b for a, b in names]
        else:
            names = [x.strip().strip('"').strip("'") for x in raw[1:-1].split(",")]
        keep = [n for n in names if n and n not in ("sans-serif", "monospace", "serif")]
        known = fams
        if keep and len(keep) <= 6 and any(n in known for n in keep):
            out[m.group(1)] = keep
    return out


def scanned_texts(files: list[str]) -> list[tuple[str, int, str]]:
    """كلُّ نصٍّ سيُرسَم: سلاسلُ TS النصيّة + قيمُ captions.json/spec.json."""
    out: list[tuple[str, int, str]] = []
    for p in files:
        rel = os.path.relpath(p, ROOT)
        if p.endswith(".json"):
            j = json.load(open(p, encoding="utf-8"))
            for i, it in enumerate(j if isinstance(j, list) else j.get("lines", [])):
                txt = it.get("text") or it.get("t") or (it.get("w") and " ".join(w[0] for w in it["w"])) or ""
                if isinstance(txt, str) and txt:
                    out.append((rel, i, txt))
            for k, v in (j.items() if isinstance(j, dict) else []):
                if k in ("source", "note", "verified_on", "ratio", "lut", "sigma_pair"):
                    continue
                if isinstance(v, str) and v and not k.endswith("_path"):
                    out.append((rel, -1, f"{k} {v}"))
            continue
        s = open(p, encoding="utf-8").read()
        s = re.sub(r"/\*.*?\*/", lambda m: "\n" * m.group(0).count("\n"), s, flags=re.S)
        for i, line in enumerate(s.split("\n"), 1):
            code = re.sub(r"//.*$", "", line)
            for mm in re.finditer(r'"([^"\\\n]{1,200})"|\'([^\'\\\n]{1,200})\'|>([^<>{}\n]{1,200})<', code):
                t = mm.group(1) or mm.group(2) or mm.group(3) or ""
                t = t.strip()
                # نصوصُ JSX العربيّةُ هي المقصودة؛ نستثني أسماءَ الوسومِ والمسافاتِ البرمجيّة
                if not t or t.startswith(("http", "./", "../", "#", "@")):
                    continue
                if re.search(r"[(){};=<>|&!`$]", t) or re.fullmatch(r"[\w\s./-]*", t):
                    continue        # CSS ورموزُ البرمجةِ لا تُرسَمُ حروفاً
                if re.fullmatch(r"-?\d+(\.\d+)?(%|px|ms|s|fr|deg)?", t):
                    continue
                out.append((rel, i, t))
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", default="src/phone")
    ap.add_argument("--comp", default="src/phone/PhoneCorp.tsx")
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args()
    d = os.path.join(ROOT, a.dir)
    files = sorted(os.path.join(d, f) for f in os.listdir(d) if f.endswith((".tsx", ".json")))
    faces = load_faces()
    union: set[int] = set()
    for f in faces:
        union |= f["cps"]
        dec = declared_set(f["declared"])
        if not f["cps"] <= (dec | EXEMPT):
            print(f"  ! {f['family']} {f['weight']}: {len(f['cps'] - dec)} رمزاً مرسوماً خارجَ النطاقِ المُعلَن", file=sys.stderr)
    st = stacks_from(os.path.join(ROOT, a.comp), {f["family"] for f in faces})
    for k in list(st):                      # الوجهُ يُذكرُ باسمه لا بوزنه: بلا تكرار
        seen, ded = set(), []
        for n in st[k]:
            if n not in seen:
                seen.add(n); ded.append(n)
        st[k] = ded
    stack_faces = {k: [f for n in v for f in faces if f["family"] == n] for k, v in st.items()}
    union_stack: set[int] = set()
    for lst in stack_faces.values():
        for f in lst:
            union_stack |= f["cps"]
    bad: list[dict] = []
    late: list[dict] = []
    n_txt = 0
    for rel, ln, txt in scanned_texts(files):
        n_txt += 1
        cps = {ord(c) for c in txt} - EXEMPT
        miss = sorted(c for c in cps if c not in union)
        if miss:
            bad.append({"file": rel, "line": ln, "text": txt[:70],
                        "codepoints": ["U+%04X" % c for c in miss[:8]]})
            continue
        # هل يملكُه وجهٌ في سلسلةِ هذا المكوّنِ فعلاً؟
        served_by_any_stack = cps <= (union_stack | EXEMPT)
        if not served_by_any_stack:
            first = min((i for lst in stack_faces.values() for i, f in enumerate(lst) if cps <= f["cps"]), default=-1)
            late.append({"file": rel, "line": ln, "text": txt[:60], "rank": first})
    report = {"faces": [{"family": f["family"], "weight": f["weight"], "tag": f["tag"],
                         "glyphs": f["glyphs"], "codepoints": len(f["cps"])} for f in faces],
              "stacks": {k: [f["family"] + "-" + f["tag"] for f in v] for k, v in stack_faces.items()},
              "strings_scanned": n_txt, "fatal": bad, "late_served": late}
    if a.json:
        print(json.dumps(report, ensure_ascii=False, indent=1))
    else:
        print("وُجوهٌ مقروءةٌ من cmap الحقيقي (%d وجهاً، %d رمزاً مغطّى):" % (len(faces), len(union)))
        for f in report["faces"]:
            print("   %-24s %-3s %-4s glyphs %4d · unicode %4d" % (f["family"], f["weight"], f["tag"], f["glyphs"], f["codepoints"]))
        print("سلاسلُ الخطوط: " + " · ".join("%s=[%s]" % (k, ", ".join(v)) for k, v in report["stacks"].items()))
        print("نصوصٌ مفحوصة: %d" % n_txt)
        for b in bad:
            print("  ✗ %s:%s  %s  → %s لا يملكُه أيُّ وجه" % (b["file"], b["line"], b["text"], ", ".join(b["codepoints"])))
        for w in late:
            print("  ! %s:%s  %s  → لا يغطّيه سوى الوجهِ رقم %s في السلسلة" % (w["file"], w["line"], w["text"], w["rank"]))
        if not bad and not late:
            print("  ✔ كلُّ رمزٍ على الشاشة يملكُه وجهٌ مضمَّنٌ في المستودع")
    return 1 if bad else 0


if __name__ == "__main__":
    raise SystemExit(main())
