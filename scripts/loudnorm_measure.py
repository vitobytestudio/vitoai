#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""يقرأ json قياس loudnorm ويعيد كسباً خطياً واحداً بالديسيبل — لا فلترَ غامضاً.

السرُّ الذي أوقعني مرة: تمريرُ measured_* إلى loudnorm مع linear=1 لا يُخرج بالضبط
ما يقوله القياس (خرج −12.8 بدل −14 لأنّ offset المطبَّق يُضاف ولا يُطرح كما ظننت).
الحساب الصريح أوضحُ للمراجِع: gain = الهدف − المقاس، ثم نخفضه أكثر إن كانت الذروة
ستتجاوز سقفنا. الناتج سطرٌ واحد: gain=-3.44
"""
import json, re, sys

TARGET_I, TARGET_TP = -14.0, -1.5
t = open(sys.argv[1], encoding="utf-8", errors="ignore").read()
m = re.search(r"\{[^{}]*input_i[^{}]*\}", t, re.S)
if not m:
    sys.exit(1)
j = json.loads(m.group(0))
mi, mtp = float(j["input_i"]), float(j["input_tp"])
g = TARGET_I - mi
if mtp + g > TARGET_TP:                       # لا ذروة تتجاوز السقف مهما أغرى المستوى
    g = TARGET_TP - mtp
print(f"gain={g:.2f}")
