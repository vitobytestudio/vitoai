# RIVIO · فيلمُ الإطلاق 4:30 — «YOU'RE EARLY»
### وصفٌ إنتاجيٌّ كامل: 9 مشاهدَ تُولِّدُها أنت بالذكاءِ الاصطناعي + 28 مشهدَ رسومٍ أصنعُه أنا + تعليقٌ إنجليزيٌّ وأرقامُ الماستر

---

## 0. كيف يُقرأُ هذا الملفّ

- **أنت:** تُنتِجُ المشاهدَ في القسمِ §3 (Tier 1 كافيةٌ لفيلمٍ مكتمل)، ترفعُها إلى `vitoai-drop` بأسماءِ `A01.mp4`…`A09.mp4`.
- **أنا:** أُصمِّمُ وأعرضُ كلَّ شيءٍ آخر (§4)، أُؤلِّفُ الموسيقى (§5)، أُنتِجُ التعليقَ الإنجليزيَّ وأضبطُه على الفصول، وأُخرِجُ الماسترَ بأرقامَ مُثبَتة (§6–§8).
- لا نصَّ محروقاً في مشاهدِك، لا موسيقى، لا مُرشِّحاتِ «سينمائيّة». هي materialٌ خامٌ فقط.

**المِحوَرُ الذي بُنِيَ عليه كلُّ شيء (قراري، لا اقتراحي):** شبكةٌ اجتماعيّةٌ سوداءُ فاخرةٌ تشبهُ إنستغرام، لكنَّ الفرقَ ليس «تصميماً أجمل» — الفرقُ أنَّ **وكلاءَ ذكاءٍ اصطناعيٍّ يعملونَ لصالحِ المستخدمِ لا لصالحِ الانتباهِ المُعلَن**. الجملةُ الأمّ:

> **AN ALGORITHM SHOWS YOU WHAT KEEPS YOU SCROLLING. RIVIO SHOWS YOU WHAT YOU ASKED FOR.**

من هذا تشتقُّ كلُّ الفصولِ الخمسة، وكلُّ قرارٍ لونيّ، وكلُّ لحظةِ صمتٍ في الصوت.

---

## 1. الهُويّةُ البصريّةُ — الرموزُ التي ستُبنى عليها كلُّ إطار

```
INK        #05060A   السطحُ الأساس (أسودُ مائلٌ للأزرق، ليس أسودَ مُطبقاً: الأسودُ المُطبقُ يبدو رخيصاً على OLED)
SURFACE    #0B0E16   بطاقاتُ التطبيق
SURFACE_HI #121826   حالاتُ الـhover/النشِط
HAIRLINE   rgba(150,168,255,0.14)   خطوطُ الفصل — 1px فقط، لا 2px
BLUE       #4C8DFF   لونُ الفِعل (زر، مفتاحُ تمييز، خطٌّ تحت كلمة)
VIOLET     #8B5CF6   لونُ الذكاء (الوكلاء، التحليلُ، ما «يُفهَم» لا ما «يُضغط»)
WHITE      #F4F6FF   النصُّ الأساسي
STEEL      #93A8CF   النصُّ الثانويّ
```

**القواعدُ التي تُقابَسُ لا تُناقَش:**
1. **البنفسجيُّ ≤ 12%** من مساحةِ الحبرِ في أيِّ إطار، والأزرقُ ≤ 22%. أُخرِجُ لك ورقةَ قياسٍ تُثبِتُ ذلك لكلِّ لقطةٍ رئيسيّة (نفسُ آليّةِ `framing-proof.jpg` عندنا).
2. **لا تدرُّجَ « blob » ولا زجاجَ مُغلَّف.** التدرُّجُ الوحيدُ المسموحُ أسودُ → أسودُ-أزرقُ 6%، ولا يُستعمَلُ إلّا على مساحةٍ > 40% من الإطار.
3. **لا أبيضَ نقيّاً `#FFFFFF` ولا أسودَ نقيّاً على نفسِ الشاشة.**
4. **الأرقامُ دائماً `JetBrains Mono`، والخطابُ دائماً `Space Grotesk`** — لا يُسمَحُ لثلاثةِ خطوطٍ أن تتنافس؛ الخطُّ الثالثُ للبياناتِ فقط.
5. **العربيّةُ (التمريرةُ الثانية):** `Cairo` 900 للعناوين، 700 للنصّ، `Tajawal` 800 للـ«شعار». وكلُّ حرفٍ يمرُّ عبرَ `scripts/fontlint.py` — إن لم يملِكْهُ وجهٌ مضمَّنٌ توقَّفَ البناء.
6. تحرُّكُ الواجهةِ كلِّها **بقانونِ تخميدٍ واحد**: `cubic-bezier(0.16, 1, 0.3, 1)`، مددٌ 180–260ms، ولا «bounce» ولا «elastic» في أيِّ مكان.

---

## 2. البنيةُ الزمنيّة — 4:30 · 8100 إطاراً @30fps · 1080×1920

| # | الفصل | الوقت | ما يُرى | مَن يصنعُه |
|---|---|---|---|---|
| I | **THE NOISE** | 0:00–0:26 | جهنمُ التمريرِ: إبهامٌ، إشعاراتٌ متراكمةٌ، موجةُ دوبامينٍ تنقطِع، وجوهُ لا تُرى عيونُها | **أنت:** A01 A02 A03 |
| — | *النقطةُ الصفر* | 0:26–0:32 | الشاشةُ تسقطُ إلى `INK`. صمتٌ تامّ 1.4s. ثمَّ نقطةُ ضوءٍ زرقاءُ واحدة | أنا |
| II | **THE SURFACE** | 0:32–1:16 | وُلودُ الواجهةِ من العتمة: الشبكةُ → البطاقةُ → الحبرُ → الأزرق. كلُّ عنصرٍ يُوضَعُ بسببٍ، لا بزخرفة | أنا (11 مشهداً) |
| III | **THE AGENTS** | 1:16–2:28 | أربعةُ وكلاءَ يعملون: Curator / Draft / Finder / Guard. واجهةٌ حيّةٌ تُجرِّبُ، تكتبَ، تُخفِّض، تحمي | أنا (9) + **أنت:** A04 A05 (خلفيّتان) |
| IV | **THE CRAFT** | 2:28–3:24 | الطبقةُ الهندسيّةُ: رموزُ اللون، سلَّمُ الطباعة، قانونُ الحركة، قياساتُ الأداء، والخصوصيّةُ كأرقامٍ لا كشعار | أنا (6) |
| V | **YOU'RE EARLY** | 3:24–4:30 | خريطةُ الطريقِ تَمتلئُ حيّة (`SHIPPED / IN LAB / NEXT`)، رقمُ البناء 0.9.4، رموزُ الدعوات، العتمةُ والشعار | أنا (2) + **أنت:** A06 A07 A08 |

**Tierُ الأول (وحدَه يكفي لفيلمٍ مكتمل):** A01–A05. **الثاني:** A06–A07. **الثالث (جماليٌّ بحت):** A08–A09.

---

## 3. مشاهدُك — أوامرُ التوليدِ جاهزةٌ للنَّسخ

**المُواصفاتُ الحاسمة لكلِّ ملفّ:** `1080×1920` عموديّ · **8–10s** · 24 أو 30fps · H.264 · **≤ 90MB** · **بلا نصٍّ/شعار/علامةٍ مائيّة/صوت** · لا واجهةَ تطبيقٍ مزيفة (الواجهةُ من عندي، أيُّ واجهةٍ في مشهَدِك ستُفسِدُ التطابق) · لا وجوهَ مشاهير ولا أطفال · يُفضَّلُ سطحٌ داكنٌ يَسهَلُ عليَّ سحبُ `#05060A` منه.
**التسميةُ والرفع:** `A01.mp4` … `A09.mp4` في `vitoai-drop` (بلا مجلدات، بلا أسماءَ عربيّة).

> **ملاحظةُ سِلْعٍ:** اطلبْ كلَّ لقطةٍ مرَّتين واخترْ الأفضلَ قبلَ الرفع. مشهدٌ واحدٌ مُكرَّرٌ بثلاثِ نسخٍ أرخصُ من تمريرةِ إعادةِ عرضٍ كاملة.

```
A01  10s  VERTICAL 9:16. Macro shot: a thumb scrolling a phone screen in total
     darkness, screen glow only, motion-blurred strips of light passing. Black
     background, cold blue highlights. 85mm macro, f/1.4, focus rack from thumb
     to the glass. Grainy, handheld, uncomfortable pace. No text, no UI.

A02  8s   VERTICAL 9:16. Endless notifications stacking over a dark room:
     translucent squares piling up like glass tiles on black glass, edges glowing
     faint blue-violet, some tiles cracking as they land. Slow push-in. Sound off.
     No icons, no letters, no brand marks.

A03  9s   VERTICAL 9:16. Abstract dopamine loop: thin white particles chase a
     blue spark around a black void, orbiting faster and faster until the spark
     cuts out and everything falls. Single light source, deep blacks, no bloom
     halos. Camera locked off, physics only.

A04  9s   VERTICAL 9:16. A quiet person at a window at 6am, back to camera,
     city lights below, phone face-down on the sill. Stillness as luxury. 40mm,
     f/2, minimal movement, cool neutral grade with one blue rim light. No text.

A05  8s   HORIZONTAL 16:9 (used inside a phone-shaped mask, so keep the subject
     centered). Slow orbit around a dark obsidian monolith lit by thin blue and
     violet strips; nothing else in frame. Premium product-photography feel,
     absolute black background, no reflections of a room. No text.

A06  9s   VERTICAL 9:16. Extreme close-up of black woven fabric moving like a
     wave, one blue thread catching light. Studio macro, shallow focus, silent
     elegance. Serves as a texture transition between acts.

A07  10s  VERTICAL 9:16. A dark street at night seen from above, rain; each
     puddle reflects a violet light that never appears. Locked overhead camera,
     only water moves. Cinematic but cold, not moody-postcard.

A08  8s   VERTICAL 9:16. Ink-in-water: black ink blooming in dark blue water,
     backlit, extremely slow. No purple blob cliché — the color must stay inside
     the blacks, only the edge glimmers blue.

A09  9s   VERTICAL 9:16. Timelapse-like: a black wall of tiny screens, all
     off, then one by one they light faint blue and settle into a calm grid,
     then go dark again except one. Locked camera, precise rhythm.
```

**ما يُرجِعُ المشهدَ فوراً (قِسْ قبلَ الرفع):** نصٌّ أو شعار؛ وجهٌ يبتسمُ للكاميرا؛ تدرُّجُ بنفسجيٌّ «futuristic» يملأُ الإطار؛ 5 ثوانٍ فقط؛ حركةُ كاميرا عَصبيّةٌ ستُصطدمُ بحركةِ واجهتي؛ ملفٌّ 110MB (سقفُ تنزيلِ Drive 100MB).

---

## 4. مشاهدُ الرسومِ التي أصنعُها — 28 مشهداً، كلها Remotion متِّجهيّ

**II. THE SURFACE (11):** شبكةُ الأعمدةِ تُرسَمُ بخطٍّ 1px · مربَّعُ `INK` يتنفَّس · بطاقةُ `SURFACE` تُبنَى ضلعاً ضلعاً · قانونُ الحبرِ يظهرُ (نصٌّ أبيضُ واحدٌ على مساحةٍ سوداءَ 78%) · `HAIRLINE` يَنزِلُ ليفصِلَ الطبقات · زرٌّ أزرقُ يضغطُه إصبعٌ من عندك (A01 معكوسٌ + مُبطَّأ) · تباينُ `BLUE/VIOLET` كنِسبةٍ تُكتَبُ رقميّاً · قائمةُ التغذيةِ تُبنَى سطرًا سطرًا · تبديلُ الوضعِ الداكنِ لا كـ«ثيمٍ» بل كـ«قرارٍ بصري» · شبهُ شاشةِ الملفِّ الشخصي · لقطةُ «اللا-إعلان»: إطارٌ أسودُ نظيفٌ مع سطرٍ واحد: `NO ADS. NO AUCTION FOR YOUR ATTENTION.`

**III. THE AGENTS (9):** بطاقةُ Curator (60 مصدرًا → 9 بطاقات، مع العدّادِ يعمل) · Draft (سطرٌ يُكتَبُ من ملاحظةٍ صوتيّة، 3 نغماتٍ مُقترَحة) · Finder («أرِنِي ما قاله فلانُ عن كذا يومَ الثلاثاء» → إجابةٌ مع مَصدَرِها) · Guard (درعٌ: ما يُرى/لا يُرى، قائمةُ أذوناتٍ حقيقيّةٌ للكاميرا والمِكرُوالِذيوس) · شريطُ «الفاعلُ الآن» أسفلَ الشاشةِ كما تفعلُ المتصفِّحاتُ الحديثة · الوكلاءُ يتحادَثونَ مع بعضِهم في نافذةٍ واحدة (مخطَّطُ عُقَدٍ حيّ) · «طلبٌ واحدٌ ↔ نتيجةٌ واحدة» (رسومُ تدفُّقٍ، لا وعودٌ تسويقيّة) · لقطةُ *IN LAB* على ميزةٍ لم تَصدُر (لا أكذِبُ على الجمهور: الوسمُ يظهرُ فعلاً) · شاشةُ بناءِ الوكيلِ الخاص (نسخٌ نصّيٌّ مُتحرِّكٌ لسطرِ تعليمات).

**IV. THE CRAFT (6):** لوحةُ الرموزِ اللونيّةِ بحوافَّها الستّة عشرِ عشرية · سلَّمُ الطباعةِ 12/16/24/44/84 · منحنىُ التخميدِ يُرسَمُ ويُطلَبُ منهُ أن يُحرِّكَ بطاقةً واحدة · زمنُ الاستجابةِ يُقاسُ حيّاً (أنا أعرضُ من الكود، فلا ادّعاء) · جدولُ الحِمية/الخصوصيّةِ كأرقام · «ما لا نفعلُه»: قائمةُ أفعالٍ مشطوبةٍ واحدًا واحدًا بصوت.

**V. YOU'RE EARLY (2 + طباعة):** خريطةُ الطريقِ تَمتلِئ: 14 بطاقةً `SHIPPED`، 5 `IN LAB`، 8 `NEXT` · لوحةُ النهاية: الشعارُ على `INK`، رقمُ البناء `v0.9.4 · 8100 frames measured`، وجملةُ الدعوات.

---

## 5. الصوت — قراري، وكلُّه محليٌّ لا يُنزَّل

- **الحركاتُ الخمس:** I ضجيجٌ مُختنِقٌ (طبقاتُ إشعاراتٍ مُصنَّعةٌ رقميًّا، إيقاعٌ 132 BPM مُتوتِّر) → II **سقوطٌ إلى صمتٍ شبه تامّ** (نغمةُ باصٍّ واحدة، 5s) → III إيقاعٌ 92 BPM هادئٌ مع نقراتٍ على كلِّ تغيُّرِ واجهة → IV أدنى: بيانو/بادٌّ + ساعةٌ رقميّةٌ خفيضة → V بناءٌ إلى ذروةٍ واحدةٍ ثم انحسارٌ كامل.
- **foley للواجهة:** كلُّ نقرةٍ/تبويبٍ/فتحِ بطاقةٍ في كلِّ مشاهدِ الرسومِ لهُ صوتٌ (2–6ms attack، لا ذيل). هذا تفصيلُ «الشركاتِ العالميّة» الذي يُسقِطُهُ الجميع.
- **الموسيقى مؤلَّفةٌ في الكود** (`scripts/score_corp.py` موسَّعاً لخمسِ حركاتٍ على Am–F–C–G / Eb–Bb–Cm–Ab للفاصل): لا عيِّنات، لا رخصة، **Stems** منفصلة.
- **الماستر:** تعليقٌ + فراشٌ بمبدأ sidechain، الهدفُ **I = −14 LUFS** والذروةُ الحقيقيّةُ **≤ −1.0 dBTP** تُغلَقُ بحلقةِ قياسٍ على الملفِّ المُرمَّزِ (درسُ `tp_limit.sh`)، و`yuv420p(tv, bt709)` موسومٌ لا مفروض.

---

## 6. النصُّ الإنجليزيُّ الكامل (≈480 كلمة · بدون تعليقٍ صوتيٍّ في مشاهدِك — التعليقُ كلُّه من عندي)

```
[0:00 I]                (صمتٌ 1.2s ثم ضجيجٌ متصاعد)
You've built a muscle. Thumb up. Thumb up. Thumb up. A reflex, trained by
people who bill for it. And somewhere in the last four hundred scrolls, you
forgot what you came here to feel.

[0:26 —]                (السقوط إلى الأسود — صمتٌ تامّ 1.4s)

[0:32 II]
This is what happens when a social network stops auctioning your attention —
and starts spending it on you.
Rivio. Black first. Because a dark surface isn't a theme; it's a decision:
what deserves light, and what's just noise.
Every line, one pixel. Every motion, one curve — two hundred and thirty
milliseconds, because anything slower feels laggy and anything faster feels
cheap. Blue means you acted. Violet means it understood.

[1:16 III]
And the part nobody else is shipping: agents.
Curator — sixty sources, nine cards. It reads so you don't have to.
Draft — you speak a sentence, it writes yours, three tones, none of them
corporate.
Finder — ask a question from Tuesday, get an answer with the source attached.
Guard — a list of what you allow, not a paragraph you'll never read.
They work for you. That's the whole difference. An algorithm shows you what
keeps you scrolling. Rivio shows you what you asked for.

[2:28 IV]
We built this in the open, so the claims come with numbers. Type scale,
contrast ratios, response times, permissions. What we don't do is on the
screen, not buried in a policy page: no ads in the feed, no selling your
graph, no dark patterns, no streak-shaming at 2am.
And what isn't finished, we mark. IN LAB. Because a premium product admits
where it is.

[3:24 V]
Twenty-seven things shipped. Five in the lab. Eight arriving next.
This is build zero-point-nine-point-four. It is not finished — it's yours
early.
No auction. No noise. Just the people and the information you chose.

[4:12 out]              (الشعار + رقم البناء)
Rivio. You're early.

[4:22 —]                (صوتٌ واحدٌ منخفض، ثم صمت)
```

**قواعدُ التعليقِ التي سأُنفِّذُها:** لا نبرةَ «إعلانٍ عربيٍّ مُدفوع»؛ إيقاعٌ 130–140 كلمة/دقيقة مع وقفاتٍ محسوبة؛ الجملةُ الأولى تدخلُ بعدَ 1.2s من الصمتِ لأنَّ الصمتَ نفسَه حِيلةُ الفخامةِ الأولى؛ وجملةُ `You're early` تُترَكُ لها 2.4s بلا موسيقى.

---

## 7. ما يَجرِي لحظةَ وصولِ ملفّاتِك

1. فحصُ المواصفاتِ آليّاً (الدقّةُ، fps، المدة، الحجمُ، وتَجنُّبُ النصِّ المحروقِ بمقارنةِ حوافِّ اللقطة) + تقريرُ رفضٍ إن وُجِدَ خرق.
2. `prune.py` على مشاهدِك (أرضيةُ ضجيجٍ مئويّةٌ — مشاهدُ AI فيها صمتٌ مولَّدٌ يجبُ أن يُذَاب) → قوائمُ القطعِ على النَّفَس.
3. بناءُ 28 مشهدَ رسومٍ على `timeline.json` المقيسِ، بمحرِّكِ Remotion نفسِه + `fontlint` باباً قبلَ العرض.
4. موسيقى خمسُ حركاتٍ + foley على كلِّ تغيُّرِ واجهة، ثم ماسترٌ بحلقةِ ذروةٍ على الملفِّ المُرمَّز.
5. **نسخةُ تحكُّمٍ** (720p، منخفضةُ الجودة) تُشاهِدُها في المتصفِّح خلالَ الجلسةِ نفسِها — تُصَحِّحُ بالاسم، وأُعيدُ التوليدَ من المولِّدِ لا بالتحرير.
6. التمريرةُ النهائيّةُ والتسليم.

**الحِسابُ المقيسُ على هذه الآلة:** عرضُ 8100 إطار ≈ **22 دقيقة** · تتابعُ صورِ مشاهدِك ≈ دقيقةٌ ونصف · `edge.py` إن مرَّرتُهُ على لقطاتِك ≈ **23 دقيقة** · الماسترُ والعريضُ ≈ 12 دقيقة. **≈ 1h 05m حوسبةٌ للتمريرةِ الكاملة**، موزَّعةً على مراحلَ يُستأنَفُ كلٌّ منها من ملفٍّ مستقلّ (مرَّ 18 مرّةً ومُسحَ الصندوق؛ لذا لا أُشغِّلُ تمريرةً طويلةً قبلَ تثبيتِ المُدخَلاتِ في git/Drive).

---

## 8. التسليمُ النهائيّ

```
rivio-launch-1080x1920.mp4        4:30 · −14 LUFS · TP ≤ −1.0 dBTP · bt709 موسوم
rivio-launch-1920x1080.mp4        للنسخِ العرضيّ (الموقع/يوتيوب) بنفسِ الماسترِ الصوتيّ
rivio-launch-1080x1350.mp4        للتغذياتِ الإعلانيّة
rivio-teaser-0030.mp4             30s قصّةٌ واحدةٌ للفخامةِ فقط (بدونِ قسمِ الحِرفة)
rivio-store-0015.mp4              معاينةُ المتجرِ (الواجهةُ وحدها، إيقاعٌ أسرع)
rivio-cover.jpg · rivio-sheet.jpg (60 لقطة) · rivio-color-proof.jpg (نسبُ الحبر 12%/22% مُقاسة)
rivio.ar.srt / rivio.en.srt / rivio.ass
edit.json · PLAN.md               خطّةُ القطعِ كقرارٍ قابلٍ للمراجعة
stem_{voice,score,foley}.wav      فصولُ الصوت
```

---

## 9. يحتاجُ النقاشُ منكَ أمرَينِ فقط

1. **الجمهورُ والأداة:** هل يُعرَضُ الفيلمُ في المتجرِ/التغذيةِ للمستخدمِ الأولِ (قرارِيَ: 4:30 للهبطَةِ + 30s للمتجرِ، وكلُّه من تمريرةٍ واحدة) أم في اجتماعِ مستثمرين (عندها يُصبِحُ الفصلُ IV أطولَ ويُضافُ سطرُ السوق)؟
2. **الوكلاءُ — حقيقةٌ أم وسمٌ؟** سأكتبُ «IN LAB» على أيِّ ميزةٍ لم تَصدُر، وأعرضُ الشاشاتِ كما هي. أرسِلْ قائمةً بـ«صدر / في المختبر / قادم» — أو دعْني أبنيها على فرضٍ صريحٍ وأنت تُصحِّحُها في نسخةِ التحكُّم. لا أُسوِّقُ ميزةً غيرَ موجودةٍ لجمهورٍ سيُجرِّبُها بعدَ أسبوع.
