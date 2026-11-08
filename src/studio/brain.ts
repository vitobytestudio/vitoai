/**
 * THE BRAIN — what the agent decides before a single frame is drawn.
 *
 * A template engine asks "which template?". This asks "what is this film
 * about, and what does that rule out?" — and it can answer, out loud, with a
 * reason for every choice. That is the whole difference between a generator and
 * an agent: it knows what NOT to use.
 *
 * No model, no network. It reads the brief, classifies it, and produces a plan
 * the renderer can execute: places, palette, pacing, narration, sound, and the
 * list of things it deliberately refused.
 */

export type Subject =
  | "fashion"
  | "property"
  | "tech"
  | "auto"
  | "food"
  | "travel"
  | "beauty"
  | "corporate"
  | "unknown";

export type WorldKind = "skyline" | "haussmann" | "street" | "mall" | "showroom" | "plan";

export type Tone = "noir" | "warm" | "clinical" | "epic" | "editorial";

export type BeatKind = "hook" | "place" | "place" | "evidence" | "detail" | "number" | "end";

export type Beat = {
  kind: "hook" | "place" | "evidence" | "detail" | "number" | "end";
  seconds: number;
  world?: WorldKind;
  caption?: string;
  line?: string;
  transition: "cut" | "dissolve" | "whip" | "match" | "dip";
  /** a page chosen by the director rather than by the hash */
  arch?: string;
};

export type Reason = { call: string; because: string };

export type Decision = {
  brief: string;
  subject: Subject;
  language: "ar" | "en" | "fr";
  title: string;
  kicker: string;
  headline: string;
  sub: string;
  tone: Tone;
  paletteId: string;
  accent: string;
  ink: string;
  /** what the film will show */
  worlds: WorldKind[];
  /** what it will refuse, and why — shown to the user */
  refused: string[];
  beats: Beat[];
  seconds: number;
  music: boolean;
  narration: boolean;
  /** the words spoken over the film, one line per beat */
  voice: string[];
  reasons: Reason[];
  seed: number;
  /** the film's idea, one sentence */
  concept?: string;
  /** who wrote the copy — shown to the user, never the model's name */
  by?: "director" | "planner";
  /** the full direction the director returned, kept for the panel */
  direction?: {
    palette: string;
    visual?: string;
    beats: { i: number; label: string; line: string; visual: string; arch: string }[];
    ms?: number;
  };
};

/* --------------------------------------------------------------- reading */

const NORM = (s: string) =>
  s
    .toLowerCase()
    .replace(/[\u064B-\u0652]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه");

const RULES: Array<{ subject: Subject; re: RegExp }> = [
  { subject: "fashion", re: /fashion|ملابس|ازياء|موضه|بوتيك|boutique|collection|garment|runway|couture|dress|abaya|عباي|جلاب/ },
  { subject: "property", re: /عقار|عقاري|فيلا|شقه|شقق|مشروع سكني|بناء|برج|real ?estate|property|villa|apartment|tower|residence|architecture|معمار|paris|باريس/ },
  { subject: "tech", re: /تقني|برمج|كود|تطبيق|منصه|software|developer|github|api|cloud|app|saas|startup|ذكاء|ai\b/ },
  { subject: "auto", re: /سيار|سيارات|مركبه|car|cars|auto|drive|motor|vehicle|شاحن/ },
  { subject: "food", re: /طعام|مطعم|قهوه|كافيه|حلويات|food|restaurant|cafe|coffee|bakery|مطبخ/ },
  { subject: "travel", re: /سفر|رحله|سياحه|فندق|منتجع|travel|hotel|resort|tour|island|جوله/ },
  { subject: "beauty", re: /عطر|عطور|تجميل|مكياج|بشره|perfume|cosmetic|beauty|skincare|spa/ },
  { subject: "corporate", re: /شركه|مؤسسه|تقرير|سنوي|corporate|company|annual|report|investor|board/ },
];

const classify = (brief: string): Subject => {
  const t = NORM(brief);
  for (const r of RULES) if (r.re.test(t)) return r.subject;
  return "unknown";
};

const isArabic = (s: string) => /[\u0600-\u06FF]/.test(s);

/* ------------------------------------------------------------- knowledge */

/**
 * What each subject is allowed to show, and what it must never show.
 *
 * This table IS the taste. It is why a fashion brief never gets a floor plan
 * and a property brief never gets a garment rail — the mistakes a generic
 * generator makes because it treats every brief as the same brief.
 */
const ALLOWED: Record<Subject, WorldKind[]> = {
  fashion: ["showroom", "mall", "haussmann", "street"],
  property: ["haussmann", "plan", "street", "skyline"],
  tech: ["skyline", "plan", "street"],
  auto: ["street", "skyline", "haussmann"],
  food: ["mall", "showroom", "street"],
  travel: ["skyline", "street", "haussmann"],
  beauty: ["showroom", "mall", "haussmann"],
  corporate: ["skyline", "mall", "plan"],
  unknown: ["haussmann", "street", "skyline", "showroom"],
};

const FORBIDDEN: Record<Subject, Array<[WorldKind, string]>> = {
  fashion: [["plan", "a floor plan has nothing to do with a collection"], ["skyline", "a skyline does not sell clothes"]],
  property: [["showroom", "a garment rail is not a building"], ["mall", "a shopping centre is not a residence"]],
  tech: [["mall", "a mall says retail, not platform"], ["haussmann", "period architecture fights a product story"], ["showroom", "a clothing rail is the wrong metaphor"]],
  auto: [["plan", "a drawing is not a drive"], ["showroom", "a rail is not a road"], ["mall", "a mall is a dead end for speed"]],
  food: [["plan", "a blueprint is not an appetite"], ["skyline", "a skyline is too far from a plate"]],
  travel: [["plan", "a plan is not a destination"], ["showroom", "a rail is not a horizon"]],
  beauty: [["plan", "a drawing cannot show a texture"], ["street", "traffic is the opposite of calm"]],
  corporate: [["showroom", "a clothing rail is too specific"]],
  unknown: [],
};

/** the palette each subject should be lit in */
const PAL = {
  noir: { id: "noir", accent: "#E8F0FF", ink: "#FFFFFF" },
  warm: { id: "amber", accent: "#FFB020", ink: "#FFF6E8" },
  clinical: { id: "ice", accent: "#7FE3FF", ink: "#F0FAFF" },
  epic: { id: "violet", accent: "#A66BFF", ink: "#F4EEFF" },
  editorial: { id: "signal", accent: "#22F0C8", ink: "#EEFDFF" },
  jade: { id: "jade", accent: "#3BF0A8", ink: "#EAFFF6" },
  cobalt: { id: "cobalt", accent: "#4D8DFF", ink: "#EAF2FF" },
} as const;

const TONE_OF: Record<Subject, { tone: Tone; pal: keyof typeof PAL }> = {
  fashion: { tone: "editorial", pal: "jade" },
  property: { tone: "epic", pal: "warm" },
  tech: { tone: "clinical", pal: "cobalt" },
  auto: { tone: "noir", pal: "noir" },
  food: { tone: "warm", pal: "warm" },
  travel: { tone: "epic", pal: "epic" },
  beauty: { tone: "editorial", pal: "jade" },
  corporate: { tone: "clinical", pal: "clinical" },
  unknown: { tone: "editorial", pal: "jade" },
};

/* ---------------------------------------------------------------- writing */

const CAPTIONS: Record<Subject, { en: string[]; ar: string[]; fr: string[] }> = {
  fashion: { en: ["The pieces", "In the light", "Made to be worn", "The collection"], ar: ["القطع", "في الضوء", "تُلبس لتُرى", "المجموعة"], fr: ["Les pièces", "Dans la lumière", "Faites pour être portées", "La collection"] },
  property: { en: ["The address", "The plan", "The arrival", "Every floor"], ar: ["العنوان", "المخطط", "الوصول", "كل طابق"], fr: ["L'adresse", "Le plan", "L'arrivée", "Chaque étage"] },
  tech: { en: ["The platform", "The city it runs", "The record", "The build"], ar: ["المنصة", "المدينة التي تعمل فيها", "السجل", "البناء"], fr: ["La plateforme", "La ville qui tourne", "Le registre", "La livraison"] },
  auto: { en: ["The machine", "The road", "At speed", "The night"], ar: ["الآلة", "الطريق", "بالسرعة", "الليل"], fr: ["La machine", "La route", "À pleine vitesse", "La nuit"] },
  food: { en: ["The room", "The first bite", "The detail", "Every day"], ar: ["المكان", "أول لقمة", "التفصيل", "كل يوم"], fr: ["La salle", "La première bouchée", "Le détail", "Chaque jour"] },
  travel: { en: ["The departure", "The city", "The view", "Stay longer"], ar: ["الانطلاق", "المدينة", "الإطلالة", "ابقَ أطول"], fr: ["Le départ", "La ville", "La vue", "Restez plus longtemps"] },
  beauty: { en: ["The texture", "The ritual", "The finish", "Yours"], ar: ["الملمس", "الطقس", "اللمسة الأخيرة", "لك"], fr: ["La matière", "Le rituel", "La tenue", "À vous"] },
  corporate: { en: ["The company", "The numbers", "The people", "The year"], ar: ["الشركة", "الأرقام", "الناس", "العام"], fr: ["La maison", "Les chiffres", "Les gens", "L'année"] },
  unknown: { en: ["The idea", "The place", "The detail", "The result"], ar: ["الفكرة", "المكان", "التفصيل", "النتيجة"], fr: ["L'idée", "Le lieu", "Le détail", "Le résultat"] },
};

const HEADLINE: Record<Subject, { en: string; ar: string; fr: string }> = {
  fashion: { en: "Cut for the\nway you move.", ar: "مصمَّمة\nلطريقتك في الحركة.", fr: "Coupé pour\n votre allure." },
  property: { en: "An address\nthat holds.", ar: "عنوان\nيصمد.", fr: "Une adresse\nqui tient." },
  tech: { en: "Built for the\nwork that matters.", ar: "مبنيّ للعمل\nالذي يستحق.", fr: "Fait pour le\ntravail qui compte." },
  auto: { en: "Made for\nthe long road.", ar: "مصنوعة\nللطريق الطويل.", fr: "Faite pour\nla longue route." },
  food: { en: "Worth\nthe detour.", ar: "يستحق\nالانعطاف.", fr: "Ça vaut\nle détour." },
  travel: { en: "Somewhere\nelse entirely.", ar: "مكان\nآخر تماماً.", fr: "Ailleurs,\ncomplètement." },
  beauty: { en: "Skin, not\nsurface.", ar: "بشرة،\nلا سطح.", fr: "La peau,\npas la surface." },
  corporate: { en: "The year\nin one place.", ar: "العام\nفي مكان واحد.", fr: "L'année\nen un lieu." },
  unknown: { en: "Made to be\nremembered.", ar: "مصنوع\nليُذكر.", fr: "Fait pour\nrester." },
};

const SUB: Record<Subject, { en: string; ar: string; fr: string }> = {
  fashion: { en: "A collection photographed where it belongs.", ar: "مجموعة تُصوَّر حيث تنتمي.", fr: "Une collection photographiée là où elle appartient." },
  property: { en: "Position, plan, and light — in that order.", ar: "الموقع، المخطط، والضوء — بهذا الترتيب.", fr: "Position, plan et lumière — dans cet ordre." },
  tech: { en: "One surface for the whole team.", ar: "سطح واحد لكل الفريق.", fr: "Une surface pour toute l'équipe." },
  auto: { en: "Engineering you can hear.", ar: "هندسة تسمعها.", fr: "Une ingénierie qu'on entend." },
  food: { en: "The room does half the work.", ar: "المكان يقوم بنصف العمل.", fr: "La salle fait la moitié du travail." },
  travel: { en: "Three nights is not enough.", ar: "ثلاث ليالٍ لا تكفي.", fr: "Trois nuits ne suffisent pas." },
  beauty: { en: "What the light does to skin.", ar: "ما يفعله الضوء بالبشرة.", fr: "Ce que la lumière fait à la peau." },
  corporate: { en: "Twelve months, honestly reported.", ar: "اثنا عشر شهراً، بصدق.", fr: "Douze mois, rapportés honnêtement." },
  unknown: { en: "A short film about one idea.", ar: "فيلم قصير عن فكرة واحدة.", fr: "Un court film sur une seule idée." },
};

/** pull the most specific phrase out of the brief to use as a title */
const titleFrom = (brief: string) => {
  const words = brief.replace(/[.,\n]/g, " ").split(/\s+/).filter(Boolean);
  const meaningful = words.filter((w) => w.length > 2).slice(0, 4);
  return meaningful.join(" ") || "Untitled";
};

/* --------------------------------------------------------------- the plan */

export type BrainOptions = {
  /** total seconds the film should run */
  seconds?: number;
  /** whether the viewer asked for music */
  music?: boolean;
  /** maximum resolved by the model tier */
  maxSeconds?: number;
};

/**
 * French, detected the cheap and honest way: the small words that only French
 * uses in a brief, plus accented letters. A brief that happens to be English
 * will not contain them.
 */
const isFrench = (s: string) =>
  /[àâçéèêëîïôûùüÿœ]/i.test(s) ||
  /(^|\s)(le|la|les|un|une|des|du|de la|pour|avec|sur|dans|nous|notre|une|nouveau|nouvelle|lancement|collection|film|maison|projet|marque|parfum|immobilier)(\s|$)/i.test(
    s.toLowerCase(),
  );

export const think = (brief: string, opts: BrainOptions = {}): Decision => {
  const subject = classify(brief);
  const language: "ar" | "en" | "fr" = isArabic(brief) ? "ar" : isFrench(brief) ? "fr" : "en";
  const allowed = ALLOWED[subject];
  const forbidden = FORBIDDEN[subject];
  const { tone, pal } = TONE_OF[subject];
  const palette = PAL[pal];

  /* pacing: a hook, three places, one piece of evidence, a number, a signature.
     Total is clamped to the model's ceiling, then distributed so no beat is
     shorter than a viewer can register. */
  const budget = Math.min(opts.seconds ?? 28, opts.maxSeconds ?? 30);
  const shape: Array<{ kind: Beat["kind"]; w: number }> = [
    { kind: "hook", w: 0.16 },
    { kind: "place", w: 0.2 },
    { kind: "place", w: 0.18 },
    { kind: "evidence", w: 0.16 },
    { kind: "number", w: 0.14 },
    { kind: "end", w: 0.16 },
  ];
  const beats: Beat[] = [];
  const caps = CAPTIONS[subject][language];
  const transitions: Beat["transition"][] = ["cut", "dissolve", "whip", "match", "dip", "dissolve"];

  let capIdx = 0;
  const worlds: WorldKind[] = [];
  /* each place may appear once; when the allowed list runs out, borrow from the
     subject's second tier rather than showing the same street twice */
  const pool = [...allowed, ...(["haussmann", "street", "skyline", "showroom", "mall", "plan"] as WorldKind[]).filter((w) => !allowed.includes(w))];
  shape.forEach((s, i) => {
    const seconds = Math.max(2.2, +(budget * s.w).toFixed(1));
    const needsPlace = s.kind === "place" || s.kind === "evidence";
    const world = needsPlace ? pool.find((w) => !worlds.includes(w)) || pool[worlds.length % pool.length] : undefined;
    if (world) worlds.push(world);
    beats.push({
      kind: s.kind,
      seconds,
      world,
      caption: s.kind === "place" || s.kind === "evidence" ? caps[capIdx++ % caps.length] : undefined,
      transition: transitions[i % transitions.length],
    });
  });

  const total = beats.reduce((n, b) => n + b.seconds, 0);

  /* narration: one sentence per beat, in the brief's language, describing what
     is actually on screen. Never a slogan that could belong to any brand. */
  const voice: string[] = beats.map((b) => {
    if (language === "fr") {
      switch (b.kind) {
        case "hook":
          return HEADLINE[subject].fr.replace(/\n/g, " ");
        case "place":
          return `${b.caption} — ${SUB[subject].fr}`;
        case "evidence":
          return `${b.caption}. ${SUB[subject].fr}`;
        case "number":
          return "Des chiffres vérifiables.";
        default:
          return "Vito Byte.";
      }
    }
    if (language === "ar") {
      switch (b.kind) {
        case "hook":
          return HEADLINE[subject].ar.replace(/\n/g, " ");
        case "place":
          return `${b.caption} — ${SUB[subject].ar}`;
        case "evidence":
          return `${b.caption}. ${SUB[subject].ar}`;
        case "number":
          return "أرقام يمكن التحقق منها.";
        default:
          return "فيتو بايت.";
      }
    }
    switch (b.kind) {
      case "hook":
        return HEADLINE[subject].en.replace(/\n/g, " ");
      case "place":
        return `${b.caption} — ${SUB[subject].en}`;
      case "evidence":
        return `${b.caption}. ${SUB[subject].en}`;
      case "number":
        return "Numbers you can check.";
      default:
        return "Vito Byte.";
    }
  });

  /* the reasoning, written the way a director would explain it to a client */
  const reasons: Reason[] = [
    {
      call: `read the brief as ${subject === "unknown" ? "an open brief" : subject}`,
      because: /[a-z]/i.test(brief) && language === "en" ? "the words named a subject" : "the words named a subject",
    },
    {
      call: `built ${new Set(worlds).size} distinct places`,
      because: "the same place twice makes six shots look like one shot",
    },
    {
      call: `lit it ${tone}`,
      because:
        tone === "clinical"
          ? "a platform story has to look measured, not moody"
          : tone === "epic"
          ? "space and scale carry the price"
          : tone === "noir"
          ? "speed reads best against black"
          : "texture sells what a photograph cannot",
    },
    {
      call: `music ${opts.music === false ? "off" : "on"}`,
      because: opts.music === false ? "you switched it off" : "a cut without a sound is a slideshow",
    },
  ];
  for (const [w, why] of forbidden) {
    reasons.push({ call: `refused ${w}`, because: why });
  }

  beats.forEach((b, i) => {
    b.line = voice[i];
  });

  return {
    brief,
    subject,
    language,
    title: titleFrom(brief),
    kicker: language === "ar" ? "فيتو بايت" : "vito byte",
    headline: HEADLINE[subject][language],
    sub: SUB[subject][language],
    tone,
    paletteId: palette.id,
    accent: palette.accent,
    ink: palette.ink,
    worlds,
    refused: forbidden.map(([w, why]) => `${w} — ${why}`),
    beats,
    seconds: +total.toFixed(1),
    music: opts.music !== false,
    narration: true,
    voice,
    reasons,
    seed: brief.length * 2654435761 % 100000,
  };
};

/** human summary for the "what I decided" panel */
export const summarise = (d: Decision) =>
  `${d.beats.length} beats · ${d.seconds}s · ${new Set(d.worlds).size} places · ${d.subject} · ${d.language.toUpperCase()}`;


/* ------------------------------------------------------------------ demo */

/**
 * The film on the front page. It is a real plan, made by the same engine, in
 * the language of the page — showing an Arabic film to an English visitor would
 * undo the work of translating the site.
 */
const DEMO_BRIEF: Record<"en" | "fr" | "ar", string> = {
  en: "a new perfume, a global launch, Paris at night",
  fr: "un nouveau parfum, lancement mondial, Paris la nuit",
  ar: "حملة عطر جديدة، إطلاق عالمي، ليل باريس",
};

export const demoFilm = (lang: "en" | "fr" | "ar") => think(DEMO_BRIEF[lang], { seconds: 18 });
