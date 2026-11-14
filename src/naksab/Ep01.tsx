/**
 * NAKSAB — Ep.01 · "طلب واحد"
 *
 * The rule the whole series obeys: the film is the platform, miniature.
 * So this is not a film *about* a marketplace. It is the marketplace, run
 * once, end to end, on a camera that never cuts.
 *
 * One vertical take, four rooms of the same product:
 *
 *   A  0.0  the request      typed in plain Arabic
 *   B  3.4  the offers       five professionals, best match first
 *   C 11.0  the project room milestones, deliverable, mutual confirmation
 *   D 17.3  the line         identity, CTA, address
 *
 * Drawn only in the product's own system: #05060A, #7C6CFF, #00D4FF,
 * IBM Plex Sans Arabic for the voice, Space Grotesk for structure, JetBrains
 * Mono for the machine's labels.
 *
 * TRAP (see PITFALLS.md): Latin digits set in the Arabic stack hang headless
 * Chromium at layout. Every numeral therefore goes through <Num>, which pins
 * Space Grotesk + LTR + bidi isolation.
 *
 * Truthfulness: NAKSAB holds no escrow and takes no payments. The film shows
 * budgets, milestones, deliverables and two-sided confirmation — never a held
 * amount, never a checkout.
 */
import React from "react";
import { AbsoluteFill, Audio, Easing, spring, useCurrentFrame, useVideoConfig } from "remotion";

export const FPS = 30;
export const DURATION = 720; // 24 s

const PAD = 56;

const BG = "#05060A";
const PURPLE = "#7C6CFF";
const CYAN = "#00D4FF";
const INK = "#EAEDF7";

const AR = '"IBM Plex Sans Arabic", "Space Grotesk", "Cairo", sans-serif';
const DISP = '"Space Grotesk", "Sora", sans-serif';
const MONO = '"JetBrains Mono", monospace';

const ink = (v: number) => `rgba(234,237,247,${v})`;
const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
};
const PU = rgb(PURPLE);
const CY = rgb(CYAN);

/* ------------------------------------------------------------- mechanics */

const cl = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const EASE = Easing.bezier(0.16, 1, 0.3, 1);
const EASEIO = Easing.bezier(0.7, 0, 0.3, 1);
const EASEOUT = Easing.bezier(0.22, 1, 0.36, 1);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const p = (f: number, a: number, b: number, fn: (t: number) => number = EASE) => cl(fn(cl((f - a) / Math.max(1, b - a))));

const track = (f: number, keys: [number, number][], fn: (t: number) => number = EASEIO) => {
  if (f <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [f0, v0] = keys[i];
    const [f1, v1] = keys[i + 1];
    if (f <= f1) return lerp(v0, v1, fn(cl((f - f0) / Math.max(1, f1 - f0))));
  }
  return keys[keys.length - 1][1];
};

/** a check mark, drawn — U+2713 has no glyph in any embedded face and stalls
 *  Chromium's fallback in this font-less sandbox. */
const Tick: React.FC<{ size?: number; color?: string; width?: number }> = ({ size = 14, color = "#05060A", width = 2 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" style={{ display: "block" }}>
    <path d="M3 8.6 L6.4 12 L13 4.6" fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** every numeral in the film. Space Grotesk, LTR, isolated from the Arabic run. */
const Num: React.FC<{ children: React.ReactNode; weight?: number; family?: string; style?: React.CSSProperties }> = ({
  children,
  weight = 700,
  family = DISP,
  style,
}) => (
  <span
    style={{
      fontFamily: family,
      fontWeight: weight,
      direction: "ltr",
      unicodeBidi: "isolate",
      display: "inline-block",
      fontVariantNumeric: "tabular-nums",
      ...style,
    }}
  >
    {children}
  </span>
);

/* ------------------------------------------------------------------ stage */

const H_A = 1560;
const H_B = 1560;
const H_C = 1520;
const Y_B = H_A;
const Y_C = H_A + H_B;

const scrollAt = (f: number) =>
  track(f, [
    [0, 0],
    [102, 0],
    [134, Y_B - 124],
    [292, Y_B - 210],
    [326, Y_B - 244],
    [368, Y_C - 124],
    [520, Y_C - 300],
    [552, Y_C - 336],
  ]);

/* ----------------------------------------------------------------- chrome */

const Fade: React.FC<{ f: number; at: number; dur?: number; y?: number; children: React.ReactNode; style?: React.CSSProperties }> = ({
  f,
  at,
  dur = 16,
  y = 22,
  children,
  style,
}) => {
  const o = p(f, at, at + dur, EASEOUT);
  return <div style={{ opacity: o, transform: `translateY(${(1 - o) * y}px)`, ...style }}>{children}</div>;
};

const Eyebrow: React.FC<{ children: React.ReactNode; color?: string }> = ({ children, color = CYAN }) => (
  <div
    style={{
      fontFamily: MONO,
      fontSize: 19,
      letterSpacing: "0.26em",
      textTransform: "uppercase",
      color: `rgba(${rgb(color)},0.78)`,
      direction: "ltr",
      display: "flex",
      alignItems: "center",
      gap: 12,
    }}
  >
    <span style={{ width: 26, height: 2, background: `rgba(${rgb(color)},0.9)`, display: "block" }} />
    {children}
  </div>
);

const Chip: React.FC<{ children: React.ReactNode; tone?: string; style?: React.CSSProperties }> = ({ children, tone = PURPLE, style }) => (
  <div
    style={{
      fontFamily: AR,
      fontSize: 22,
      fontWeight: 600,
      color: ink(0.86),
      background: `rgba(${rgb(tone)},0.13)`,
      border: `1px solid rgba(${rgb(tone)},0.34)`,
      display: "inline-block",
      borderRadius: 14,
      padding: "9px 20px",
      direction: "rtl",
      ...style,
    }}
  >
    {children}
  </div>
);

const Panel: React.FC<{ children: React.ReactNode; style?: React.CSSProperties; glow?: number; radius?: number }> = ({
  children,
  style,
  glow = 0,
  radius = 26,
}) => (
  <div
    style={{
      position: "relative",
      borderRadius: radius,
      background: "linear-gradient(162deg, rgba(255,255,255,0.062), rgba(255,255,255,0.018) 46%, rgba(255,255,255,0.03))",
      border: "1px solid rgba(255,255,255,0.085)",
      boxShadow: glow > 0 ? `0 0 ${48 * glow}px rgba(${PU},${0.26 * glow}), inset 0 1px 0 rgba(255,255,255,0.06)` : "inset 0 1px 0 rgba(255,255,255,0.05)",
      ...style,
    }}
  >
    {children}
  </div>
);

/* --------------------------------------------------------------- app bar */

const AppBar: React.FC<{ f: number }> = ({ f }) => {
  const live = 0.55 + 0.45 * Math.sin(f * 0.09);
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        height: 176,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: `0 ${PAD + 6}px`,
        background: "linear-gradient(180deg, #05060A 0%, #05060A 72%, rgba(5,6,10,0.72) 86%, rgba(5,6,10,0) 100%)",
        zIndex: 30,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 9,
            background: `linear-gradient(140deg, ${PURPLE}, ${CYAN})`,
            boxShadow: `0 0 22px rgba(${PU},0.5)`,
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 8,
              borderRadius: 3,
              border: `2px solid ${BG}`,
              borderRightColor: "transparent",
              borderBottomColor: "transparent",
            }}
          />
        </div>
        <div style={{ fontFamily: DISP, fontSize: 27, fontWeight: 700, letterSpacing: "0.22em", color: INK, direction: "ltr" }}>NAKSAB</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 7, height: 7, borderRadius: 7, background: CYAN, opacity: live, boxShadow: `0 0 12px rgba(${CY},0.9)` }} />
        <div style={{ fontFamily: AR, fontSize: 19, fontWeight: 600, color: ink(0.62), direction: "rtl" }}>مجاني خلال الإطلاق</div>
      </div>
    </div>
  );
};

/* -------------------------------------------------------- A · the request */

const LINE1 = "أريد متجراً إلكترونياً صغيراً";
const LINE2 = "لمشروعي، مع صفحة دفع.";

const Caret: React.FC<{ on: number }> = ({ on }) => (
  <span
    style={{
      display: "inline-block",
      width: 3,
      height: 34,
      marginRight: 7,
      background: CYAN,
      opacity: on,
      boxShadow: `0 0 14px rgba(${CY},0.8)`,
      verticalAlign: "-3px",
    }}
  />
);

const Composer: React.FC<{ f: number }> = ({ f }) => {
  const t1 = 12;
  const t2 = 76;
  const c1 = Math.floor(cl((f - t1) / 1.75) * LINE1.length);
  const c2 = Math.floor(cl((f - t2) / 1.55) * LINE2.length);
  const typing = f >= t1 && f < t2 + LINE2.length * 1.55 + 4;
  const caret = typing ? 1 : Math.floor(f / 9) % 2 === 0 ? 0.85 : 0;
  const press = p(f, 96, 102, EASEOUT) * (1 - p(f, 104, 118, EASEOUT));
  const focus = p(f, 84, 96, EASEOUT);
  const ripple = p(f, 96, 126, EASE);

  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: H_A, padding: `0 ${PAD}px` }}>
      <div style={{ position: "absolute", top: 168, left: PAD, right: PAD }}>
        <Fade f={f} at={0} dur={14}>
          <Eyebrow>post a project</Eyebrow>
        </Fade>

        <Fade f={f} at={3} dur={18} y={26}>
          <div
            style={{
              fontFamily: AR,
              fontSize: 82,
              fontWeight: 400,
              color: INK,
              lineHeight: 1.2,
              direction: "rtl",
              marginTop: 26,
              letterSpacing: "-0.01em",
            }}
          >
            اطلب ما تحتاجه
          </div>
        </Fade>

        <Fade f={f} at={8} dur={18}>
          <div style={{ fontFamily: AR, fontSize: 29, fontWeight: 400, color: ink(0.5), direction: "rtl", marginTop: 14, lineHeight: 1.55 }}>
            اكتب طلبك بكلمات بسيطة، والعروض تصلك.
          </div>
        </Fade>
      </div>

      <div style={{ position: "absolute", top: 400, left: PAD, right: PAD, opacity: p(f, 2, 16, EASEOUT) }}>
        <Panel
          glow={focus}
          style={{ padding: "26px 30px 22px", transform: `scale(${1 + focus * 0.004 - press * 0.004})` }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", direction: "rtl" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 9, height: 9, borderRadius: 9, background: `rgba(${PU},0.9)`, boxShadow: `0 0 10px rgba(${PU},0.8)` }} />
              <div style={{ fontFamily: AR, fontSize: 23, fontWeight: 600, color: ink(0.78) }}>طلب جديد</div>
            </div>
            <div style={{ fontFamily: MONO, fontSize: 15, letterSpacing: "0.16em", color: ink(0.3), direction: "ltr" }}>DRAFT</div>
          </div>

          <div style={{ marginTop: 20, minHeight: 104, direction: "rtl" }}>
            <div style={{ fontFamily: AR, fontSize: 35, fontWeight: 400, color: INK, lineHeight: 1.6, textAlign: "right" }}>
              <div>
                {LINE1.slice(0, c1)}
                {c1 < LINE1.length ? <Caret on={caret} /> : null}
              </div>
              {c1 >= LINE1.length ? (
                <div style={{ color: ink(0.55) }}>
                  {LINE2.slice(0, c2)}
                  <Caret on={caret} />
                </div>
              ) : null}
            </div>
          </div>

          <div style={{ marginTop: 16, direction: "rtl", textAlign: "right" }}>
            <span style={{ display: "inline-block", marginLeft: 10 }}>
              <Chip tone={CYAN}>
                <Num>35,000</Num> دج
              </Chip>
            </span>
            <span style={{ display: "inline-block", marginLeft: 10 }}>
              <Chip tone={PURPLE}>أسبوعان</Chip>
            </span>
            <span style={{ display: "inline-block" }}>
              <Chip tone={PURPLE}>تصميم وتطوير</Chip>
            </span>
          </div>

          <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "20px -30px 18px" }} />

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", direction: "rtl" }}>
            <div
              style={{
                position: "relative",
                fontFamily: AR,
                fontSize: 24,
                fontWeight: 600,
                color: BG,
                background: `linear-gradient(100deg, ${PURPLE}, ${CYAN})`,
                borderRadius: 15,
                padding: "15px 30px",
                transform: `scale(${1 - press * 0.05})`,
                boxShadow: `0 ${10 - press * 6}px ${34 - press * 12}px rgba(${PU},${0.34 - press * 0.16})`,
                overflow: "hidden",
              }}
            >
              نشر الطلب مجاناً
              {ripple > 0 && ripple < 1 ? (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: 15,
                    border: `1.5px solid rgba(${CY},${1 - ripple})`,
                    transform: `scale(${1 + ripple * 0.6})`,
                    opacity: 1 - ripple,
                  }}
                />
              ) : null}
            </div>
            <div style={{ fontFamily: AR, fontSize: 20, color: ink(0.34), maxWidth: 330, lineHeight: 1.5, textAlign: "right" }}>
              يصل طلبك إلى المهنيين المناسبين، لا إلى الجميع.
            </div>
          </div>
        </Panel>
      </div>

      {/* the three steps, as the site states them */}
      <div style={{ position: "absolute", top: 800, left: PAD, right: PAD, display: "flex", gap: 16, direction: "rtl" }}>
        {[
          { n: "01", t: "اكتب طلبك", d: "سطران يكفيان" },
          { n: "02", t: "تصلك العروض", d: "الأفضل أولاً" },
          { n: "03", t: "أتمّ بأمان", d: "تأكيد من الطرفين" },
        ].map((st, i) => {
          const on = p(f, 34 + i * 9, 54 + i * 9, EASEOUT);
          return (
            <div
              key={st.n}
              style={{
                flex: 1,
                opacity: on,
                transform: `translateY(${(1 - on) * 26}px)`,
                borderRadius: 20,
                border: "1px solid rgba(255,255,255,0.07)",
                background: "linear-gradient(168deg, rgba(255,255,255,0.045), rgba(255,255,255,0.012))",
                padding: "22px 22px 24px",
              }}
            >
              <div style={{ fontFamily: DISP, fontSize: 15, fontWeight: 700, letterSpacing: "0.16em", color: `rgba(${CY},0.8)`, direction: "ltr" }}>{st.n}</div>
              <div style={{ fontFamily: AR, fontSize: 25, fontWeight: 400, color: INK, marginTop: 12 }}>{st.t}</div>
              <div style={{ fontFamily: AR, fontSize: 18, color: ink(0.4), marginTop: 6, lineHeight: 1.4 }}>{st.d}</div>
            </div>
          );
        })}
      </div>

      {/* every craft, one band, sliding like the site's category rail */}
      <div
        style={{
          position: "absolute",
          top: 990,
          left: 0,
          right: 0,
          height: 96,
          opacity: p(f, 56, 80),
          maskImage: "linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)",
          WebkitMaskImage: "linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)",
        }}
      >
        <div style={{ display: "flex", gap: 14, direction: "rtl", transform: `translateX(${(f * 1.1) % 300 - 150}px)`, whiteSpace: "nowrap", paddingLeft: 0 }}>
          {["الذكاء الاصطناعي", "الأعمال والاستشارات", "التصميم والإبداع", "التسويق الرقمي", "الموسيقى والصوت", "البرمجة والتقنية", "الفيديو والرسوم", "الكتابة والترجمة", "الذكاء الاصطناعي", "الأعمال والاستشارات", "التصميم والإبداع", "التسويق الرقمي"].map((c, i) => (
            <div
              key={`${c}-${i}`}
              style={{
                fontFamily: AR,
                fontSize: 21,
                color: i % 3 === 0 ? `rgba(${CY},0.8)` : ink(0.34),
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 12,
                padding: "12px 18px",
                background: i % 4 === 0 ? `rgba(${PU},0.07)` : "transparent",
              }}
            >
              {c}
            </div>
          ))}
        </div>
      </div>

      <div style={{ position: "absolute", top: 1112, left: PAD, right: PAD, opacity: p(f, 44, 64), display: "flex", alignItems: "center", justifyContent: "space-between", direction: "rtl" }}>
        <div style={{ fontFamily: AR, fontSize: 18, color: ink(0.24) }}>بدون عمولة عند النشر</div>
        <div style={{ fontFamily: AR, fontSize: 18, color: ink(0.24) }}>تسليم مؤكَّد من الطرفين</div>
      </div>

      {/* the film says the one thing the product page can only imply */}
      <div style={{ position: "absolute", top: 1244, left: PAD, right: PAD, direction: "rtl", textAlign: "right" }}>
        <div
          style={{
            height: 1,
            width: 132,
            background: `linear-gradient(90deg, rgba(${PU},0.9), rgba(${CY},0.5))`,
            transformOrigin: "100% 50%",
            transform: `scaleX(${p(f, 56, 84, EASEOUT)})`,
            marginRight: 0,
            marginLeft: "auto",
            marginBottom: 34,
          }}
        />
        <div
          style={{
            fontFamily: AR,
            fontSize: 66,
            fontWeight: 400,
            color: INK,
            lineHeight: 1.34,
            opacity: p(f, 58, 78, EASEOUT),
            transform: `translateY(${(1 - p(f, 58, 78, EASEOUT)) * 26}px)`,
            letterSpacing: "-0.01em",
          }}
        >
          طلب واحد.
        </div>
        <div
          style={{
            fontFamily: AR,
            fontSize: 66,
            fontWeight: 400,
            color: ink(0.42),
            lineHeight: 1.34,
            opacity: p(f, 66, 86, EASEOUT),
            transform: `translateY(${(1 - p(f, 66, 86, EASEOUT)) * 26}px)`,
            letterSpacing: "-0.01em",
          }}
        >
          والباقي يأتيك.
        </div>
      </div>
    </div>
  );
};

/* --------------------------------------------------------- B · the offers */

type Offer = {
  initial: string;
  name: string;
  role: string;
  projects: number;
  score: number;
  price: string;
  days: number;
  pitch: string;
  at: number;
};

const OFFERS: Offer[] = [
  { initial: "أ", name: "أمين ك.", role: "تطوير الويب", projects: 12, score: 98, price: "32,000", days: 14, pitch: "هيكل جاهز، وأبدأ غداً.", at: 142 },
  { initial: "س", name: "سارة م.", role: "تصميم الواجهات", projects: 8, score: 91, price: "28,500", days: 10, pitch: "نموذج أوليّ في ثلاثة أيام.", at: 157 },
  { initial: "ي", name: "ياسين ب.", role: "تجربة المستخدم", projects: 21, score: 84, price: "19,000", days: 7, pitch: "أبسّط المسار قبل البناء.", at: 172 },
  { initial: "ن", name: "نور الهدى", role: "الكتابة والمحتوى", projects: 6, score: 76, price: "12,000", days: 5, pitch: "نصوص عربية، لا ترجمة.", at: 187 },
  { initial: "م", name: "مهدي ز.", role: "الدفع والمدفوعات", projects: 4, score: 71, price: "24,000", days: 12, pitch: "تكامل دفع محليّ وآمن.", at: 202 },
];

const OfferCard: React.FC<{ o: Offer; f: number; fps: number; chosen: number; dim: number }> = ({ o, f, fps, chosen, dim }) => {
  const s = spring({ frame: Math.max(0, f - o.at), fps, config: { damping: 200, stiffness: 88, mass: 1 } });
  const arrive = p(f, o.at, o.at + 12, EASEOUT);
  const count = lerp(0, o.score, p(f, o.at + 4, o.at + 30, EASEOUT));
  const hire = p(f, 246, 260, EASE);
  const out = 0; // the cards scroll away with the room; fading them first opened a black hole
  const lift = chosen ? p(f, 240, 256, EASE) : 0;

  return (
    <div
      style={{
        position: "relative",
        height: 206,
        marginBottom: 20,
        borderRadius: 24,
        opacity: arrive * (1 - out) * (1 - dim * 0.62),
        transform: `translateY(${(1 - s) * 74 + lift * -8}px) scale(${lerp(0.975, 1, s) * (1 + lift * 0.012)})`,
        filter: `blur(${(1 - arrive) * 9 + dim * 1.1}px)`,
      }}
    >
      <Panel glow={lift * 1.1 + hire * 0.4} radius={24} style={{ height: "100%", padding: "26px 30px" }}>
        <div style={{ position: "absolute", left: 24, right: 24, bottom: -1, height: 2, borderRadius: 2, background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
          <div style={{ width: `${o.score}%`, height: "100%", background: `linear-gradient(90deg, ${PURPLE}, ${CYAN})`, opacity: arrive * 0.9 }} />
        </div>

        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
            <div style={{ position: "relative", width: 88, height: 88 }}>
              <div
                style={{
                  width: 88,
                  height: 88,
                  borderRadius: 26,
                  background: `linear-gradient(150deg, rgba(${PU},0.30), rgba(${CY},0.16))`,
                  border: "1px solid rgba(255,255,255,0.12)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: AR,
                  fontSize: 38,
                  fontWeight: 600,
                  color: ink(0.92),
                }}
              >
                {o.initial}
              </div>
              <svg width={34} height={34} style={{ position: "absolute", right: -9, bottom: -9 }}>
                <circle cx={17} cy={17} r={14} fill="#0A0D16" stroke={`rgba(${PU},0.5)`} strokeWidth={1.5} />
                <circle
                  cx={17}
                  cy={17}
                  r={11.5}
                  fill="none"
                  stroke={CYAN}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 11.5}`}
                  strokeDashoffset={`${2 * Math.PI * 11.5 * (1 - o.score / 100)}`}
                  transform="rotate(-90 17 17)"
                  opacity={0.92}
                />
              </svg>
            </div>

            <div style={{ direction: "rtl", paddingTop: 2 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ fontFamily: AR, fontSize: 31, fontWeight: 400, color: INK }}>{o.name}</div>
                <div style={{ fontFamily: MONO, fontSize: 17, color: CYAN, direction: "ltr", letterSpacing: "0.04em" }}>
                  {String(Math.round(count)).padStart(2, "0")}
                </div>
              </div>
              <div style={{ fontFamily: AR, fontSize: 21, color: ink(0.48), marginTop: 5, direction: "rtl" }}>
                {o.role}
                <span style={{ fontFamily: DISP, margin: "0 8px", color: ink(0.3) }}>·</span>
                <Num weight={500}>{o.projects}</Num> مشروعاً
              </div>
              <div style={{ fontFamily: AR, fontSize: 22, color: ink(0.66), marginTop: 12 }}>«{o.pitch}»</div>
            </div>
          </div>

          <div style={{ textAlign: "left", direction: "ltr", minWidth: 176 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "flex-end", gap: 7 }}>
              <div style={{ fontFamily: DISP, fontSize: 36, fontWeight: 700, color: INK, letterSpacing: "-0.01em" }}>{o.price}</div>
              <div style={{ fontFamily: AR, fontSize: 19, color: ink(0.45) }}>دج</div>
            </div>
            <div style={{ fontFamily: AR, fontSize: 20, color: ink(0.4), marginTop: 6, direction: "rtl", textAlign: "left" }}>
              <Num weight={500}>{o.days}</Num> يوماً
            </div>
          </div>
        </div>

        {chosen ? (
          <div
            style={{
              position: "absolute",
              bottom: 18,
              right: 26,
              opacity: hire,
              transform: `translateY(${(1 - hire) * -10}px) scale(${lerp(0.9, 1, hire)})`,
              fontFamily: AR,
              fontSize: 19,
              fontWeight: 600,
              color: BG,
              background: `linear-gradient(100deg, ${PURPLE}, ${CYAN})`,
              borderRadius: 9,
              padding: "5px 14px",
              display: "flex",
              alignItems: "center",
              gap: 7,
            }}
          >
            <Tick size={16} /> تم التوظيف
          </div>
        ) : null}
      </Panel>
    </div>
  );
};

const Offers: React.FC<{ f: number; fps: number }> = ({ f, fps }) => {
  const chosenOn = f >= 246;
  const shown = Math.min(5, Math.max(0, Math.ceil((f - 137) / 15)));
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: Y_B, height: H_B, padding: `0 ${PAD}px` }}>
      <div style={{ position: "absolute", top: 176, left: PAD, right: PAD }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div>
            <Fade f={f} at={126} dur={16}>
              <Eyebrow>offers · best match first</Eyebrow>
            </Fade>
            <Fade f={f} at={130} dur={18} y={26}>
              <div style={{ fontFamily: AR, fontSize: 66, fontWeight: 400, color: INK, direction: "rtl", marginTop: 18 }}>خمسة عروض</div>
            </Fade>
          </div>
          <Fade f={f} at={136} dur={16}>
            <div
              style={{
                fontFamily: MONO,
                fontSize: 18,
                letterSpacing: "0.12em",
                color: ink(0.55),
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 12,
                padding: "8px 16px",
                direction: "ltr",
              }}
            >
              {String(Math.min(5, Math.max(0, Math.floor((f - 137) / 15)))).padStart(2, "0")} / 05
            </div>
          </Fade>
        </div>
        <Fade f={f} at={142} dur={16}>
          <div style={{ fontFamily: AR, fontSize: 23, color: ink(0.42), direction: "rtl", marginTop: 12 }}>
            مطابقة حسب المهارة، السعر، وموعد التسليم.
          </div>
        </Fade>
      </div>

      <div style={{ position: "absolute", top: 422, left: PAD, right: PAD }}>
        {OFFERS.map((o, i) => (
          <OfferCard key={o.name} o={o} f={f} fps={fps} chosen={chosenOn && i === 0 ? 1 : 0} dim={chosenOn && i !== 0 ? p(f, 246, 272, EASEIO) : 0} />
        ))}
      </div>
      <div style={{ position: "absolute", left: PAD, bottom: 26, fontFamily: MONO, fontSize: 15, color: ink(0.2), direction: "ltr", letterSpacing: "0.16em" }}>
        {`MATCH ${String(shown).padStart(2, "0")}`}
      </div>
    </div>
  );
};

/* ---------------------------------------------------- C · the project room */

const STEPS = [
  { n: "01", t: "التصميم", d: "نموذج أوليّ للواجهة", amt: "9,000" },
  { n: "02", t: "البناء", d: "المتجر وصفحة الدفع", amt: "17,000" },
  { n: "03", t: "التسليم", d: "ملفات، تدريب، وتأكيد", amt: "6,000" },
];

const Room: React.FC<{ f: number; fps: number }> = ({ f, fps }) => {
  const done = p(f, 356, 384, EASE);
  const b1 = spring({ frame: Math.max(0, f - 396), fps, config: { damping: 200, stiffness: 96 } });
  const b2 = spring({ frame: Math.max(0, f - 414), fps, config: { damping: 200, stiffness: 96 } });
  const stars = p(f, 430, 462, EASE);

  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: Y_C, height: H_C, padding: `0 ${PAD}px` }}>
      <div style={{ position: "absolute", top: 178, left: PAD, right: PAD }}>
        <Fade f={f} at={324} dur={20}>
          <Eyebrow>project room</Eyebrow>
        </Fade>

        <Fade f={f} at={330} dur={22} y={26}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 22, direction: "rtl" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <div
                style={{
                  width: 74,
                  height: 74,
                  borderRadius: 22,
                  background: `linear-gradient(150deg, rgba(${PU},0.32), rgba(${CY},0.18))`,
                  border: "1px solid rgba(255,255,255,0.12)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: AR,
                  fontSize: 32,
                  fontWeight: 600,
                  color: INK,
                }}
              >
                أ
              </div>
              <div>
                <div style={{ fontFamily: AR, fontSize: 34, fontWeight: 400, color: INK }}>أمين ك.</div>
                <div style={{ fontFamily: AR, fontSize: 21, color: ink(0.46), marginTop: 4 }}>متجر إلكتروني صغير</div>
              </div>
            </div>
            <div
              style={{
                fontFamily: AR,
                fontSize: 20,
                fontWeight: 600,
                color: `rgba(${CY},0.95)`,
                border: `1px solid rgba(${CY},0.3)`,
                background: `rgba(${CY},0.08)`,
                borderRadius: 12,
                padding: "8px 18px",
              }}
            >
              قيد التنفيذ
            </div>
          </div>
        </Fade>
      </div>

      <div style={{ position: "absolute", top: 392, left: PAD, right: PAD }}>
        {STEPS.map((s, i) => {
          const on = p(f, 334 + i * 14, 354 + i * 14, EASEOUT);
          const isDone = i === 0;
          const prog = isDone ? done : 0;
          return (
            <div
              key={s.n}
              style={{
                display: "flex",
                gap: 22,
                direction: "rtl",
                opacity: on,
                transform: `translateY(${(1 - on) * 18}px)`,
                marginBottom: 30,
              }}
            >
              <div style={{ position: "relative", width: 46, display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    border: `1.5px solid ${isDone && prog > 0.6 ? `rgba(${CY},0.9)` : "rgba(255,255,255,0.16)"}`,
                    background: isDone && prog > 0.6 ? `rgba(${CY},0.14)` : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: DISP,
                    fontSize: 14,
                    fontWeight: 700,
                    color: isDone && prog > 0.6 ? CYAN : ink(0.4),
                  }}
                >
                  {isDone && prog > 0.6 ? <Tick size={15} color={CYAN} width={2.4} /> : s.n}
                </div>
                {i < STEPS.length - 1 ? <div style={{ flex: 1, width: 1, background: "rgba(255,255,255,0.1)", marginTop: 8 }} /> : null}
              </div>

              <Panel radius={20} style={{ flex: 1, padding: "26px 28px", marginBottom: 2 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontFamily: AR, fontSize: 27, fontWeight: 600, color: INK }}>{s.t}</div>
                    <div style={{ fontFamily: AR, fontSize: 20, color: ink(0.42), marginTop: 5 }}>{s.d}</div>
                  </div>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 6, justifyContent: "flex-end", direction: "ltr" }}>
                      <div style={{ fontFamily: DISP, fontSize: 26, fontWeight: 700, color: ink(isDone && prog > 0.6 ? 0.95 : 0.7) }}>{s.amt}</div>
                      <div style={{ fontFamily: AR, fontSize: 17, color: ink(0.36) }}>دج</div>
                    </div>
                    <div style={{ fontFamily: AR, fontSize: 17, color: ink(0.34), marginTop: 4 }}>
                      {isDone ? (prog > 0.6 ? "مؤكَّد" : "بانتظار التأكيد") : i === 1 ? "جارٍ" : "لاحقاً"}
                    </div>
                  </div>
                </div>
              </Panel>
            </div>
          );
        })}
      </div>

      {/* where the room stands, as the product states it */}
      <div style={{ position: "absolute", top: 950, left: PAD, right: PAD, direction: "rtl", opacity: p(f, 396, 420, EASEOUT) }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontFamily: AR, fontSize: 19, color: ink(0.44) }}>
            المرحلة <Num weight={500}>1</Num> من <Num weight={500}>3</Num> مؤكدة
          </div>
          <div style={{ fontFamily: AR, fontSize: 19, color: ink(0.44) }}>لا يُحجز أي مبلغ</div>
        </div>
        <div style={{ marginTop: 14, height: 3, borderRadius: 3, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
          <div style={{ width: `${p(f, 400, 452, EASE) * 33.3}%`, height: "100%", background: `linear-gradient(90deg, ${PURPLE}, ${CYAN})` }} />
        </div>
      </div>

      <div style={{ position: "absolute", top: 1064, left: PAD, right: PAD }}>
        <div style={{ display: "flex", gap: 14, direction: "rtl", marginBottom: 16 }}>
          <div
            style={{
              opacity: cl(b1),
              transform: `translateY(${(1 - b1) * 14}px) scale(${lerp(0.96, 1, b1)})`,
              fontFamily: AR,
              fontSize: 22,
              color: ink(0.9),
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "20px 20px 20px 6px",
              padding: "14px 22px",
              maxWidth: 620,
            }}
          >
            النموذج جاهز، أرسلته في الملف أدناه.
          </div>
        </div>
        <div style={{ display: "flex", direction: "rtl", justifyContent: "flex-start", marginBottom: 22 }}>
          <div
            style={{
              opacity: cl(b2),
              transform: `translateY(${(1 - b2) * 14}px) scale(${lerp(0.96, 1, b2)})`,
              fontFamily: AR,
              fontSize: 22,
              color: BG,
              background: `linear-gradient(100deg, ${PURPLE}, ${CYAN})`,
              borderRadius: "20px 20px 6px 20px",
              padding: "14px 22px",
              maxWidth: 560,
              marginRight: 190,
            }}
          >
            ممتاز، أكمل إلى صفحة الدفع.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", direction: "rtl", opacity: p(f, 416, 436) }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 44, height: 54, borderRadius: 8, background: `linear-gradient(150deg, rgba(${PU},0.4), rgba(${CY},0.22))`, border: "1px solid rgba(255,255,255,0.14)" }} />
            <div>
              <div style={{ fontFamily: MONO, fontSize: 18, color: ink(0.8), direction: "ltr", letterSpacing: "0.02em" }}>store-home.fig</div>
              <div style={{ fontFamily: AR, fontSize: 17, color: ink(0.36), marginTop: 3 }}>
                تسليم · <Num weight={500}>4.2</Num> ميغابايت
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", gap: 4 }}>
              {[0, 1, 2, 3, 4].map((k) => (
                <div
                  key={k}
                  style={{
                    width: 15,
                    height: 15,
                    background: `linear-gradient(140deg, ${PURPLE}, ${CYAN})`,
                    clipPath: "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)",
                    opacity: p(f, 432 + k * 4, 442 + k * 4, EASEOUT) * (0.4 + 0.6 * stars),
                  }}
                />
              ))}
            </div>
            <div style={{ fontFamily: AR, fontSize: 19, color: ink(0.5) }}>تأكيد من الطرفين</div>
          </div>
        </div>
      </div>
      {/* what a project room is made of */}
      <div style={{ position: "absolute", top: 1360, left: PAD, right: PAD, direction: "rtl", display: "flex", gap: 12 }}>
        {[
          { k: "رسائل", v: "محادثة" },
          { k: "مراحل", v: "3" },
          { k: "تسليم", v: "ملف" },
          { k: "تأكيد", v: "طرفان" },
        ].map((it, i) => {
          const on = p(f, 452 + i * 9, 472 + i * 9, EASEOUT);
          return (
            <div key={it.k} style={{ flex: 1, opacity: on * 0.95, transform: `translateY(${(1 - on) * 14}px)`, borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 14 }}>
              <div style={{ fontFamily: AR, fontSize: 18, color: ink(0.32) }}>{it.k}</div>
              <div style={{ fontFamily: AR, fontSize: 24, color: ink(0.8), marginTop: 5 }}>{it.v}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* --------------------------------------------------------- D · the closing line */

const EndCard: React.FC<{ f: number }> = ({ f }) => {
  const o = p(f, 566, 596, EASEOUT);
  const sheen = p(f, 600, 706, EASEIO);
  const pulse = 0.5 + 0.5 * Math.sin((f - 600) * 0.07);
  const mark = p(f, 578, 602, EASEOUT);
  const rule = p(f, 592, 626, EASEOUT);

  return (
    <div style={{ position: "absolute", inset: 0, opacity: o }}>
      {/* a hairline that draws itself under the wordmark, like the site's rule */}
      <div
        style={{
          position: "absolute",
          left: PAD + 40,
          right: PAD + 40,
          top: 1180,
          height: 1,
          background: `linear-gradient(90deg, transparent, rgba(${PU},0.6), rgba(${CY},0.6), transparent)`,
          transform: `scaleX(${rule})`,
          transformOrigin: "50% 50%",
        }}
      />

      <div style={{ position: "absolute", left: 0, right: 0, top: 700, textAlign: "center", padding: `0 ${PAD + 30}px` }}>
        <div style={{ fontFamily: AR, fontSize: 33, color: ink(0.46), direction: "rtl", lineHeight: 1.6, opacity: p(f, 566, 592, EASEOUT) }}>
          من أول كلمة… إلى آخر تسليم.
        </div>
      </div>

      <div style={{ position: "absolute", left: 0, right: 0, top: 828, display: "flex", justifyContent: "center" }}>
        <div style={{ position: "relative" }}>
          <div
            style={{
              fontFamily: DISP,
              fontSize: 104,
              fontWeight: 700,
              letterSpacing: "0.18em",
              color: INK,
              direction: "ltr",
              opacity: mark,
              transform: `translateY(${(1 - mark) * 20}px)`,
              textShadow: `0 0 90px rgba(${PU},0.3)`,
            }}
          >
            NAKSAB
          </div>
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `linear-gradient(104deg, transparent ${sheen * 100 - 28}%, rgba(255,255,255,0.55) ${sheen * 100}%, transparent ${sheen * 100 + 24}%)`,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
              fontFamily: DISP,
              fontSize: 104,
              fontWeight: 700,
              letterSpacing: "0.18em",
              direction: "ltr",
              opacity: mark,
              pointerEvents: "none",
            }}
          >
            NAKSAB
          </div>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 978,
          textAlign: "center",
          fontFamily: DISP,
          fontSize: 25,
          fontWeight: 500,
          letterSpacing: "0.04em",
          color: ink(0.44),
          direction: "ltr",
          opacity: p(f, 590, 616, EASEOUT),
        }}
      >
        Hire the right talent, with confidence.
      </div>

      <div style={{ position: "absolute", left: 0, right: 0, top: 1236, display: "flex", justifyContent: "center" }}>
        <div
          style={{
            fontFamily: AR,
            fontSize: 28,
            fontWeight: 600,
            color: BG,
            background: `linear-gradient(100deg, ${PURPLE}, ${CYAN})`,
            borderRadius: 16,
            padding: "21px 46px",
            opacity: p(f, 602, 626, EASEOUT),
            transform: `translateY(${(1 - p(f, 602, 626, EASEOUT)) * 16}px)`,
            boxShadow: `0 18px 64px rgba(${PU},${0.24 + pulse * 0.12})`,
          }}
        >
          ابدأ الآن مجاناً
        </div>
      </div>

      <div style={{ position: "absolute", left: 0, right: 0, top: 1362, display: "flex", justifyContent: "center", alignItems: "center", gap: 12, opacity: p(f, 616, 640, EASEOUT) }}>
        <div style={{ width: 7, height: 7, borderRadius: 7, background: CYAN, boxShadow: `0 0 14px rgba(${CY},0.9)`, opacity: 0.6 + pulse * 0.4 }} />
        <div style={{ fontFamily: MONO, fontSize: 21, color: ink(0.6), direction: "ltr", letterSpacing: "0.02em" }}>naksab.vitobytestudio.workers.dev</div>
      </div>

      <div style={{ position: "absolute", left: 0, right: 0, top: 1424, textAlign: "center", fontFamily: AR, fontSize: 20, color: ink(0.28), direction: "rtl", opacity: p(f, 626, 650, EASEOUT) }}>
        الأسعار بالدينار الجزائري · مجاني خلال الإطلاق
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ fx */

const Aurora: React.FC<{ f: number }> = ({ f }) => (
  <>
    <div
      style={{
        position: "absolute",
        left: -260 + Math.sin(f * 0.006) * 90,
        top: 120 + Math.cos(f * 0.005) * 70,
        width: 1300,
        height: 1300,
        borderRadius: "50%",
        background: `radial-gradient(circle, rgba(${PU},0.20), rgba(${PU},0.05) 42%, transparent 66%)`,
        filter: "blur(46px)",
      }}
    />
    <div
      style={{
        position: "absolute",
        right: -340 + Math.cos(f * 0.0055) * 80,
        bottom: -180 + Math.sin(f * 0.0048) * 90,
        width: 1200,
        height: 1200,
        borderRadius: "50%",
        background: `radial-gradient(circle, rgba(${CY},0.14), rgba(${CY},0.03) 44%, transparent 68%)`,
        filter: "blur(52px)",
      }}
    />
    <div
      style={{
        position: "absolute",
        inset: 0,
        backgroundImage:
          "linear-gradient(rgba(255,255,255,0.022) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.022) 1px, transparent 1px)",
        backgroundSize: "60px 60px",
        maskImage: "radial-gradient(ellipse 78% 62% at 50% 46%, rgba(0,0,0,0.9), transparent 78%)",
        WebkitMaskImage: "radial-gradient(ellipse 78% 62% at 50% 46%, rgba(0,0,0,0.9), transparent 78%)",
        opacity: 0.55,
      }}
    />
  </>
);

const Grain: React.FC<{ f: number; amount?: number }> = ({ f, amount = 0.024 }) => (
  <div
    style={{
      position: "absolute",
      inset: -60,
      opacity: amount,
      mixBlendMode: "overlay",
      backgroundImage:
        "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/></filter><rect width='180' height='180' filter='url(%23n)' opacity='0.9'/></svg>\")",
      backgroundPosition: `${(f * 17) % 180}px ${(f * 31) % 180}px`,
    }}
  />
);

/* ------------------------------------------------------------------- film */

export type NaksabProps = { score?: string };

export const Naksab01: React.FC<NaksabProps> = ({ score }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scroll = scrollAt(f);
  const v = Math.abs(scroll - scrollAt(f - 1));
  const mblur = Math.min(1.9, v * 0.05);
  const collapse = p(f, 552, 596, EASEIO);
  const intro = p(f, 0, 6, EASEOUT);
  const breathe = 0.5 + 0.5 * Math.sin(f * 0.021);

  return (
    <AbsoluteFill style={{ background: BG, overflow: "hidden" }}>
      <AbsoluteFill style={{ opacity: 0.9 + breathe * 0.1 }}>
        <Aurora f={f} />
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          opacity: intro * (1 - collapse),
          transform: `translateY(${collapse * 40}px) scale(${1 - collapse * 0.06})`,
          filter: mblur > 0.02 || collapse > 0.02 ? `blur(${mblur + collapse * 10}px)` : undefined,
          transformOrigin: "50% 34%",
        }}
      >
        <div style={{ position: "absolute", inset: 0, transform: `translateY(${-scroll}px)` }}>
          <Composer f={f} />
          <Offers f={f} fps={fps} />
          <Room f={f} fps={fps} />
        </div>
      </AbsoluteFill>

      <div style={{ opacity: intro * (1 - collapse) }}>
        <AppBar f={f} />
      </div>

      <EndCard f={f} />

      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse 92% 74% at 50% 44%, transparent 46%, rgba(0,0,0,0.55) 100%)",
          pointerEvents: "none",
        }}
      />
      <Grain f={f} />
      {score && score.length > 32 ? <Audio src={score} /> : null}
    </AbsoluteFill>
  );
};
