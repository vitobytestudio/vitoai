# VITO BYTE STUDIO — product thesis
### Turning the render pipeline into a subscription SaaS

---

## 1. The verdict up front

The **idea is right**. The **structure as proposed has two fatal flaws**:

| Proposal | Verdict | Why |
|---|---|---|
| Free tier, unlimited, no cost | **No** | Render is cheap but not free. Unlimited + no identity check = one abuser runs 4,000 renders and you pay for all of them. |
| Tiers sold on "good / professional / premium montage" | **No** | Adjectives are unenforceable and unverifiable. A buyer cannot see the difference before paying, and you cannot defend the line when they complain. |
| Credit system | **Yes** | Correct instinct. Credits must be *compute-denominated*, not "number of videos". |
| Free trial of 2 videos ≤ 10 s | **Yes** | Exactly right. Watermarked, 720p, no commercial licence, one per verified identity. |

**Sell capability, not adjectives.** Duration, resolution, frame rate, scene library, voiceover, brand lock, rights, queue priority, API. Every one of those is a hard gate in code. "Premium montage" is a promise; "120 s at 4K/60 with brand-locked palette and one human review pass" is a product.

---

## 2. Model family — one engine, four models

The engine is already named in the film: **NEXUS**. Keep it. The four models are versions of it, and each plan unlocks exactly one.

```
NEXUS LITE    → free trial
NEXUS CORE    → plan KILO
NEXUS PRO     → plan MEGA
NEXUS PRIME   → plan TERA
```

Why this works: the customer learns one word (Nexus), the ladder reads itself (Lite → Core → Pro → Prime), and the studio name stays the brand — Vito Byte Studio ships Nexus, it is not *called* Nexus.

### What each model actually is

| Model | Scene library | Camera | Type system | Output |
|---|---|---|---|---|
| **LITE** | 6 layouts, flat only | fixed | 1 font pair | 720×1280, 30 fps, ≤10 s, watermark |
| **CORE** | 24 layouts, flat + parallax | slow push | 2 font pairs | 1080×1920, 30 fps, ≤30 s |
| **PRO** | 48 layouts, flat + one 3D beat | full move | 3 font pairs + brand palette lock | 1080×1920, 60 fps, ≤60 s, voiceover |
| **PRIME** | 90 layouts, full cinematic | authored per brief | unlimited + custom typeface | 2160×3840, 60 fps, ≤120 s, human review |

The honest differentiator is the **scene library size and the number of layouts per second of film**. That is real, it is defensible, and it is the thing that makes PRIME output actually look like an agency made it.

---

## 3. Credits — denominated in compute, not in videos

**1 credit = 1 second of NEXUS CORE output at 1080×1920 / 30 fps.**

Multipliers stack:

| Modifier | × |
|---|---|
| 60 fps | 1.6 |
| 4K (2160×3840) | 2.5 |
| Voiceover (TTS + mix) | 1.3 |
| 3D scene, per scene | 1.5 |
| Extra revision pass | 1.0 |

So a 30 s film at 60 fps in CORE = `30 × 1.6 = 48 credits`.

### Plans

| Plan | Model | Price / mo | Credits | ≈ 30 s films | COGS est. | Margin |
|---|---|---|---|---|---|---|
| **Free** | LITE | $0 | 20 one-time | 2 × ≤10 s | $0.04 | — |
| **KILO** | CORE | $19 | 300 | 6 | ~$0.30 | 98 % |
| **MEGA** | PRO | $49 | 900 | 18 | ~$1.30 | 97 % |
| **TERA** | PRIME | $149 | 3,000 | 62 | ~$5.00 | 97 % |

Annual: 2 months free. Credits roll over **one** month maximum — never indefinitely, that is how you end up carrying an unbounded liability.

### Why the economics actually hold

A 32 s 1080p60 film renders in ~4 min on 2 vCPU in this repo. At spot CPU pricing that is cents, not dollars. The cost driver is **not** the render — it is (a) storage of outputs, (b) failed renders you still pay for, (c) support time, (d) abuse.

So the limits that matter are **not** credit limits. They are:

1. **Concurrency cap** — free: 1 job at a time; KILO: 2; MEGA: 4; TERA: 8. This is the real DoS defence.
2. **Free-tier identity gate** — verified email + device fingerprint + one trial per payment instrument. Otherwise the trial is farmed on day one.
3. **Output retention** — 7 days on free, 30 days on KILO/MEGA, 1 year on TERA. Storage is the silent killer.

**"Free forever, unlimited" is the one part of the plan to delete.** A 14-day paid-trial with 2 watermarked films does the same job and costs you nothing.

---

## 4. The payment rail — solve this before writing any code

**Stripe does not onboard Algerian sellers.** Any plan built on Stripe Pay/Payment Links/Managed Payments dies at signup.

Use a **merchant of record** that accepts Algeria:

| Provider | Fee | Notes |
|---|---|---|
| **Paddle** | 5 % + $0.50 | Longest track record, subscriptions + B2B invoicing, handles VAT everywhere |
| **Polar** | 4 % + $0.40 | Developer-first, clean API, GitHub-based identity |
| **Dodo Payments** | 4 % + $0.40 | Built for emerging markets, 30+ local methods |

Recommended: **Paddle** for the first year (billing edge cases, dunning, tax), revisit at scale.

Practical consequences to design for now, not later:
- Price in **USD** and show a local estimate (DZD) in the UI. Never charge in DZD — you cannot settle it.
- Card penetration in Algeria is thin. The paying customer is more likely Gulf/EU/NA. **Write the marketing in English and French, not Arabic** — Arabic for the local portfolio, English for the buyers.
- Payouts arrive in a foreign bank account. Plan the entity question early (Algeria-based auto-entrepreneur vs. foreign entity) — this is an accountant decision, not an engineering one.

---

## 5. What actually sells

Nobody pays $149/month to "make a video". They pay for one of four things:

1. **Time to publish.** The pitch is `brief → finished film in 6 minutes`, not `beautiful motion graphics`.
2. **It must not look AI-made.** This is the whole game. PRIME's human review pass exists purely to sell this.
3. **Rights.** Commercial licence, font licence, music licence, indemnity. Enterprise buyers will not touch a tool whose output they cannot legally run as a paid ad.
4. **Consistency.** Brand-locked palette, typeface and logo — so video #50 looks like video #1. This is the single strongest retention feature and it is cheap to build.

### Positioning line
> **Your engineering, filmed.**
> Brief in. Finished vertical film out. No editor, no revision loop, no agency retainer.

---

## 6. Build order (first 30 days)

1. **Auth + credits ledger** — append-only, every render is a debit row. Never a mutable balance field.
2. **Render queue** — one worker per slot, concurrency caps from the table above, hard kill at duration cap.
3. **Paddle checkout + webhook** — subscription created → credits granted on `subscription.activated`, revoked on cancel.
4. **Free trial gate** — email verification + fingerprint.
5. **The four NEXUS models as real scene-library configs** — not flags on one template.
6. **Watermark on LITE** — burned in, not an overlay you can strip.

Ship 1→4 before touching 5. A billing system with credits and no product is a business; a beautiful product with no billing is a demo.

---

## 7. Honest risk list

- **Commodity risk.** Runway, Pika, Krea are adjacent and funded. Your edge is not the model — it is *vertical, typographic, data-driven brand films* which those tools do badly. Stay in that lane and win it.
- **Quality expectation gap.** "Premium, world-class, like global agencies" sets a bar that a template engine struggles to clear every single time. Ship CORE honestly and let PRIME under-promise.
- **Payment friction** is the largest single point of failure for a DZ-based SaaS. Solve it in week one.
- **Support load** scales faster than revenue in video products. Every failed render is a ticket. Make failures impossible before making output beautiful.

---

*Written 2026-10-29. Figures for COGS are estimates from this repo's render timings, not invoices.*
