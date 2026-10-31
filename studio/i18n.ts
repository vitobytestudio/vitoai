/**
 * THREE LANGUAGES, ONE VOICE.
 *
 * The site is written in English, then French and Arabic as equal citizens, not
 * as translations bolted on. `typeof EN` is the contract: if a key is missing
 * from French or Arabic the build fails, so a page can never ship half-written
 * in a language the visitor chose.
 *
 * Arabic flips the document to RTL and gets its own face (Cairo), because Arabic
 * set in a Latin typeface reads as an afterthought.
 */
import { useEffect, useState } from "react";

export type Lang = "en" | "fr" | "ar";
export const LANGS: Lang[] = ["en", "fr", "ar"];
export const LANG_LABEL: Record<Lang, string> = { en: "EN", fr: "FR", ar: "AR" };
export const isRTL = (l: Lang) => l === "ar";

const EN = {
  brand: "NEXUS",
  by: "by VITO BYTE",
  nav: { studio: "Studio", models: "Models", about: "About", privacy: "Privacy", terms: "Terms", feedback: "Feedback" },
  common: {
    open: "Open the studio",
    back: "Back to the studio",
    send: "Send",
    sending: "Sending",
    optional: "optional",
    required: "required",
    lang: "Language",
    close: "Close",
  },
  beta: {
    label: "Beta",
    title: "This is a public trial.",
    body: "NEXUS is in early testing. Films will be imperfect, some browsers will refuse to encode, and a bad brief will produce a bad film. Tell us what broke — that is the point of this stage.",
    cta: "Send feedback",
  },
  home: {
    eyebrow: "agent studio · vertical film",
    h1a: "Say it once.",
    h1b: "Get the film.",
    sub: "One sentence about anything — a collection, a tower, a compiler, a perfume. The agent decides the idea, the places, the page for every beat and the score, then writes a vertical film you can download.",
    ctaPrimary: "Make a film",
    ctaSecondary: "See the models",
    demoNote: "made by the agent",
    demoMeta: "18 s · one line of brief · no footage, no stock",
    stats: [
      { n: "11", l: "page architectures" },
      { n: "3", l: "languages, detected" },
      { n: "0", l: "files uploaded" },
      { n: "30 s", l: "per film" },
    ],
    howTitle: "How it works",
    how: [
      { n: "01", t: "Read", d: "The brief is read for what it is: a fashion house, a tower, a compiler, a perfume. Language, subject and appetite are settled before anything is drawn." },
      { n: "02", t: "Decide", d: "Six beats are cast — a claim, the places, the proof, the record, the signature — and each is given the page architecture that earns it. Consecutive beats are never the same page." },
      { n: "03", t: "Render", d: "Every place is drawn from geometry, not photographed. The score is synthesised. The film is encoded in your browser, so nothing is uploaded and nothing is queued." },
    ],
    modelsTitle: "Three engines",
    modelsSub: "One is open today. The other two are being built with studios that need more than thirty seconds.",
    closeTitle: "Start with one sentence.",
    closeSub: "No account. No credit card. Three films in this trial, then it asks you to come back later.",
  },
  models: {
    title: "Models",
    sub: "Three engines, one studio. Each is tuned for a different length of ambition — the free one is deliberately limited so the paid ones can be good.",
    note: "Paid engines are closed during the trial. Nothing on this page charges anything, and no card is asked for anywhere on this site.",
    cards: [
      {
        name: "VITO LITE V2",
        tag: "open · free",
        blurb: "Reads the brief, decides the film, draws every place from code, scores it, and hands you the file.",
        strong: ["eleven page architectures, never repeating", "sound design and music at −14 LUFS", "three films per device in the trial", "encodes on your own machine"],
        limits: ["3 films", "30 seconds", "1080 × 1920"],
      },
      {
        name: "VITO X1 AUTO",
        tag: "closed",
        blurb: "Works alone. A whole campaign in, a set of films that share one grammar out.",
        strong: ["a series, not a single film", "voice artist in three languages", "60 s and 90 s cuts", "a shared art direction across the set"],
        limits: ["not open yet"],
      },
      {
        name: "VITO ULTRA V8",
        tag: "closed",
        blurb: "For a launch. Deeper worlds, more passes, a director's cut you can show a board.",
        strong: ["4K, both orientations", "three review passes before delivery", "bespoke score with stems", "a film that survives a projector"],
        limits: ["not open yet"],
      },
    ],
    tableTitle: "What differs",
    table: [
      ["length", "30 s", "60–90 s", "up to 3 min"],
      ["films per brief", "one", "a set", "a set"],
      ["page architectures", "11", "24", "24 + bespoke"],
      ["voice", "none", "three languages", "directed voice"],
      ["resolution", "1080 × 1920", "1080 × 1920", "4K"],
      ["review passes", "none", "one", "three"],
    ],
  },
  about: {
    title: "A studio that is not a template.",
    sub: "NEXUS makes short vertical films from a sentence. It is built on one belief: a film is a series of decisions, and decisions can be taught.",
    sections: [
      { h: "What it does", p: "You write a brief. The planner reads it for subject, language and appetite, and casts a film of six beats. A director then writes the idea, every line of copy, and chooses which of eleven page architectures each beat deserves. The picture is drawn from geometry in the browser; the score is synthesised from the same cue sheet the picture is cut to." },
      { h: "Why it is not a template", p: "A template changes colour and keeps the skeleton. Here the skeleton is only the floor: consecutive beats are never the same page, two briefs never cast the same film, and the film tells you what it refused to include and why. If the copy reads generic, the director failed that beat — not the layout." },
      { h: "What it is not", p: "It is not a stock library, a video editor, or a camera. There is no footage: every place is built from geometry, so nothing is licensed and nothing can be recognised as someone else's frame. It will not replace a director with footage, a crew and a week." },
      { h: "Why it is free right now", p: "Because it is in testing. The trial is deliberately limited to three films per device and thirty seconds each, so that the engine is used by people who will tell us where it is weak." },
    ],
    facts: [
      { k: "Stage", v: "public trial" },
      { k: "Runs", v: "in your browser" },
      { k: "Uploads", v: "none" },
      { k: "Built by", v: "VITO BYTE" },
    ],
  },
  privacy: {
    title: "Privacy",
    updated: "Last updated 29 October 2026 · trial version",
    intro: "This is written to be read, not to protect us. During the trial NEXUS collects almost nothing, and what it does collect is listed below in full.",
    sections: [
      { h: "Your brief", p: "Briefs are typed into the studio and sent to our edge to be written by the director model. They are not stored after the reply is returned, not used to train anything, and not attached to your identity — there is no account and no cookie that identifies you." },
      { h: "Your film", p: "Films are rendered and encoded inside your browser. The video file is never uploaded to us; when you press download it goes from memory to your disk. We cannot see it, recover it, or delete it for you." },
      { h: "What is kept on your device", p: "One entry in local storage counts how many films this device has made, so the trial can be limited honestly, and one remembers your language. You can clear both from your browser settings at any time and nothing breaks except the counter." },
      { h: "Feedback", p: "If you send feedback, we keep the message you wrote, the page it was sent from, the language, and an email address only if you choose to leave one. We keep it to fix the product and to reply. Ask us to delete it and it is deleted." },
      { h: "Logs and infrastructure", p: "The site is served by Cloudflare Workers. Cloudflare keeps standard request logs for security and abuse prevention under its own policy. We do not run advertising, analytics pixels, session recording or fingerprinting of any kind." },
      { h: "Children", p: "The studio is not directed at children under 13 and we do not knowingly keep anything about them. If a child has sent feedback, write to us and it will be removed." },
      { h: "Your rights", p: "You may ask what we hold about you, ask for a copy, or ask for deletion. During the trial the honest answer will usually be: one feedback message, if you sent one. Requests go through the feedback page." },
      { h: "Changes", p: "If this policy changes materially, the date above changes and the trial notice on the home page says so. Continuing to use the studio after that means you accept the new text." },
    ],
  },
  terms: {
    title: "Terms",
    updated: "Last updated 29 October 2026 · trial version",
    intro: "Plain terms for a product in testing. If something here is unfair, say so on the feedback page — the trial exists to find that out.",
    sections: [
      { h: "The service", p: "NEXUS turns a written brief into a short vertical film. It is offered as-is during a public trial: features change, limits change, and the service may be unavailable without notice while we work on it." },
      { h: "Your brief and your film", p: "What you write is yours. The film we generate from it is yours to publish, including commercially, with no attribution required. You are responsible for the brief you submit and for how the result is used — including any claim you make in it." },
      { h: "Acceptable use", p: "Do not use the studio to produce content that is unlawful, that impersonates a real person or brand you do not represent, that targets a protected group, or that is intended to deceive. We may refuse service or block access for that." },
      { h: "Limits of the trial", p: "Three films per device and thirty seconds per film, enforced in the studio. These limits exist to keep the trial usable for everyone and may change at any time." },
      { h: "No warranty", p: "The films are generated, and generation makes mistakes: a wrong word, a weak beat, a number that came from the brief and reads oddly out of it. Check anything you publish. We give no warranty of fitness for a particular purpose." },
      { h: "Liability", p: "To the extent the law allows, we are not liable for indirect or consequential loss arising from use of the studio, including lost audience or lost revenue. Nothing here limits liability that cannot be limited by law." },
      { h: "Paid engines", p: "VITO X1 AUTO and VITO ULTRA V8 are not on sale. Nothing on this site takes payment, and no card details are requested or processed anywhere in it." },
      { h: "Changes to these terms", p: "We may update these terms as the product changes. The date above is authoritative. Continued use after a change means acceptance." },
    ],
  },
  feedback: {
    title: "Tell us what broke.",
    sub: "This is a trial, and criticism is the useful part. A sentence is enough — what you asked for, what you got, and what it should have been.",
    kind: ["something is broken", "an idea", "praise, if earned"],
    message: "Your note",
    placeholder: "I asked for a perfume campaign and got a street scene. The second beat repeated the first.",
    email: "Email",
    emailHint: "only if you want a reply",
    send: "Send the note",
    sending: "Sending",
    thanks: "Received.",
    thanksSub: "Thank you — this is exactly what the trial is for. We read every note.",
    again: "Send another",
    failed: "It did not send. Try again in a moment.",
  },
  inbox: {
    title: "Feedback inbox",
    sub: "For the studio owner during the trial.",
    key: "Key",
    open: "Open",
    empty: "Nothing here yet.",
    error: "No inbox on this deployment yet, or the key is wrong.",
  },
  footer: {
    tagline: "Short vertical films, decided by an agent and drawn from geometry.",
    product: "Product",
    company: "Studio",
    legal: "Legal",
    rights: "A trial release. No accounts, no uploads, no advertising.",
  },
  errors: {
    noField: "Write a line first.",
    limit: "The trial allows three films on this device.",
  },
};

const FR: typeof EN = {
  brand: "NEXUS",
  by: "par VITO BYTE",
  nav: { studio: "Studio", models: "Modèles", about: "À propos", privacy: "Confidentialité", terms: "Conditions", feedback: "Avis" },
  common: {
    open: "Ouvrir le studio",
    back: "Retour au studio",
    send: "Envoyer",
    sending: "Envoi",
    optional: "facultatif",
    required: "requis",
    lang: "Langue",
    close: "Fermer",
  },
  beta: {
    label: "Bêta",
    title: "Ceci est un essai public.",
    body: "NEXUS est en test. Les films seront imparfaits, certains navigateurs refuseront d'encoder, et un brief faible donnera un film faible. Dites-nous ce qui casse — c'est tout l'objet de cette étape.",
    cta: "Donner un avis",
  },
  home: {
    eyebrow: "studio d'agents · film vertical",
    h1a: "Dites-le une fois.",
    h1b: "Obtenez le film.",
    sub: "Une phrase sur n'importe quoi — une collection, une tour, un compilateur, un parfum. L'agent décide l'idée, les lieux, la page de chaque temps et la musique, puis écrit un film vertical que vous téléchargez.",
    ctaPrimary: "Créer un film",
    ctaSecondary: "Voir les modèles",
    demoNote: "fait par l'agent",
    demoMeta: "18 s · une phrase · aucune image, aucune banque",
    stats: [
      { n: "11", l: "architectures de page" },
      { n: "3", l: "langues, détectées" },
      { n: "0", l: "fichier envoyé" },
      { n: "30 s", l: "par film" },
    ],
    howTitle: "Comment ça marche",
    how: [
      { n: "01", t: "Lire", d: "Le brief est lu pour ce qu'il est : une maison de couture, une tour, un compilateur, un parfum. La langue, le sujet et l'appétit sont fixés avant tout dessin." },
      { n: "02", t: "Décider", d: "Six temps sont distribués — une affirmation, les lieux, la preuve, le chiffre, la signature — et chacun reçoit l'architecture de page qu'il mérite. Deux temps consécutifs ne partagent jamais la même page." },
      { n: "03", t: "Rendre", d: "Chaque lieu est dessiné à partir de géométrie, pas photographié. La musique est synthétisée. Le film est encodé dans votre navigateur : rien n'est envoyé, rien n'attend en file." },
    ],
    modelsTitle: "Trois moteurs",
    modelsSub: "Un est ouvert aujourd'hui. Les deux autres se construisent avec des studios qui ont besoin de plus de trente secondes.",
    closeTitle: "Commencez par une phrase.",
    closeSub: "Sans compte. Sans carte. Trois films pendant l'essai, puis il vous demandera de revenir plus tard.",
  },
  models: {
    title: "Modèles",
    sub: "Trois moteurs, un studio. Chacun est réglé pour une autre ambition — le gratuit est volontairement limité pour que les payants soient bons.",
    note: "Les moteurs payants sont fermés pendant l'essai. Aucune page de ce site ne facture quoi que ce soit, et aucune carte n'est demandée nulle part.",
    cards: [
      {
        name: "VITO LITE V2",
        tag: "ouvert · gratuit",
        blurb: "Lit le brief, décide le film, dessine chaque lieu à partir de code, le met en musique et vous remet le fichier.",
        strong: ["onze architectures de page, jamais répétées", "son et musique à −14 LUFS", "trois films par appareil pendant l'essai", "encodage sur votre machine"],
        limits: ["3 films", "30 secondes", "1080 × 1920"],
      },
      {
        name: "VITO X1 AUTO",
        tag: "fermé",
        blurb: "Travaille seul. Une campagne entière en entrée, une série de films partageant une même grammaire en sortie.",
        strong: ["une série, pas un film", "voix d'artiste en trois langues", "versions de 60 s et 90 s", "direction artistique partagée"],
        limits: ["pas encore ouvert"],
      },
      {
        name: "VITO ULTRA V8",
        tag: "fermé",
        blurb: "Pour un lancement. Des mondes plus profonds, plus de passes, une version réalisateur à montrer à un comité.",
        strong: ["4K, deux orientations", "trois passes de relecture", "partition sur mesure avec stems", "un film qui survit au projecteur"],
        limits: ["pas encore ouvert"],
      },
    ],
    tableTitle: "Ce qui diffère",
    table: [
      ["durée", "30 s", "60–90 s", "jusqu'à 3 min"],
      ["films par brief", "un", "une série", "une série"],
      ["architectures", "11", "24", "24 + sur mesure"],
      ["voix", "aucune", "trois langues", "voix dirigée"],
      ["résolution", "1080 × 1920", "1080 × 1920", "4K"],
      ["passes de relecture", "aucune", "une", "trois"],
    ],
  },
  about: {
    title: "Un studio, pas un gabarit.",
    sub: "NEXUS fabrique de courts films verticaux à partir d'une phrase. Une conviction : un film est une suite de décisions, et une décision peut s'apprendre.",
    sections: [
      { h: "Ce qu'il fait", p: "Vous écrivez un brief. Le planificateur en lit le sujet, la langue et l'appétit, puis distribue un film de six temps. Un réalisateur écrit ensuite l'idée, chaque ligne de texte, et choisit laquelle des onze architectures de page chaque temps mérite. L'image est dessinée par géométrie dans le navigateur ; la musique est synthétisée à partir de la même feuille de cues que le montage." },
      { h: "Pourquoi ce n'est pas un gabarit", p: "Un gabarit change la couleur et garde le squelette. Ici le squelette n'est qu'un plancher : deux temps consécutifs ne partagent jamais la même page, deux briefs ne donnent jamais le même film, et le film vous dit ce qu'il a refusé et pourquoi. Si le texte sonne générique, le réalisateur a échoué ce temps — pas la mise en page." },
      { h: "Ce qu'il n'est pas", p: "Ni une banque d'images, ni un monteur, ni une caméra. Il n'y a aucune image filmée : chaque lieu est construit par géométrie, donc rien n'est sous licence et rien ne peut être reconnu comme le plan de quelqu'un d'autre. Il ne remplacera pas un réalisateur avec des images, une équipe et une semaine." },
      { h: "Pourquoi c'est gratuit maintenant", p: "Parce que c'est en test. L'essai est volontairement limité à trois films par appareil et trente secondes chacun, pour que le moteur soit utilisé par des gens qui nous diront où il est faible." },
    ],
    facts: [
      { k: "Étape", v: "essai public" },
      { k: "Tourne", v: "dans votre navigateur" },
      { k: "Envois", v: "aucun" },
      { k: "Par", v: "VITO BYTE" },
    ],
  },
  privacy: {
    title: "Confidentialité",
    updated: "Dernière mise à jour : 29 octobre 2026 · version d'essai",
    intro: "Ce texte est écrit pour être lu, pas pour nous protéger. Pendant l'essai, NEXUS ne collecte presque rien, et ce qu'il collecte est listé ici en entier.",
    sections: [
      { h: "Votre brief", p: "Les briefs sont saisis dans le studio et envoyés à notre edge pour être écrits par le modèle réalisateur. Ils ne sont pas conservés après la réponse, ne servent à entraîner rien, et ne sont liés à aucune identité : il n'y a ni compte ni cookie qui vous identifie." },
      { h: "Votre film", p: "Les films sont rendus et encodés dans votre navigateur. Le fichier vidéo ne nous est jamais envoyé ; quand vous téléchargez, il va de la mémoire à votre disque. Nous ne pouvons ni le voir, ni le récupérer, ni le supprimer pour vous." },
      { h: "Ce qui reste sur votre appareil", p: "Une entrée en stockage local compte les films réalisés sur cet appareil, pour que l'essai soit limité honnêtement, et une autre retient votre langue. Vous pouvez effacer les deux dans les réglages de votre navigateur : seul le compteur change." },
      { h: "Les avis", p: "Si vous envoyez un avis, nous gardons le message, la page d'origine, la langue, et une adresse email seulement si vous en laissez une. Nous les gardons pour corriger le produit et vous répondre. Demandez la suppression, elle est faite." },
      { h: "Journaux et infrastructure", p: "Le site est servi par Cloudflare Workers. Cloudflare conserve des journaux de requêtes standard pour la sécurité et la prévention des abus, selon sa propre politique. Nous n'utilisons ni publicité, ni pixel analytique, ni enregistrement de session, ni empreinte de navigateur." },
      { h: "Enfants", p: "Le studio ne s'adresse pas aux moins de 13 ans et nous ne conservons sciemment rien à leur sujet. Si un enfant a envoyé un avis, écrivez-nous et il sera supprimé." },
      { h: "Vos droits", p: "Vous pouvez demander ce que nous détenons, en obtenir une copie, ou demander la suppression. Pendant l'essai, la réponse honnête sera le plus souvent : un message d'avis, si vous en avez envoyé un. Les demandes passent par la page d'avis." },
      { h: "Modifications", p: "Si cette politique change sur le fond, la date ci-dessus change et l'avis d'essai de la page d'accueil le signale. Continuer à utiliser le studio vaut acceptation du nouveau texte." },
    ],
  },
  terms: {
    title: "Conditions",
    updated: "Dernière mise à jour : 29 octobre 2026 · version d'essai",
    intro: "Des conditions simples pour un produit en test. Si un point vous semble injuste, dites-le sur la page d'avis — l'essai existe pour le découvrir.",
    sections: [
      { h: "Le service", p: "NEXUS transforme un brief écrit en un court film vertical. Il est offert en l'état pendant un essai public : les fonctions changent, les limites changent, et le service peut être indisponible sans préavis pendant que nous travaillons." },
      { h: "Votre brief et votre film", p: "Ce que vous écrivez vous appartient. Le film généré vous appartient et peut être publié, y compris à des fins commerciales, sans mention obligatoire. Vous êtes responsable du brief soumis et de l'usage du résultat, y compris de toute affirmation qu'il contient." },
      { h: "Usage acceptable", p: "N'utilisez pas le studio pour produire un contenu illégal, usurper l'identité d'une personne ou d'une marque que vous ne représentez pas, viser un groupe protégé, ou tromper délibérément. Nous pouvons refuser le service ou bloquer l'accès pour cela." },
      { h: "Limites de l'essai", p: "Trois films par appareil et trente secondes par film, appliqués dans le studio. Ces limites gardent l'essai utilisable pour tous et peuvent changer à tout moment." },
      { h: "Aucune garantie", p: "Les films sont générés, et générer produit des erreurs : un mot faux, un temps faible, un chiffre tiré du brief et lu de travers. Vérifiez ce que vous publiez. Nous n'offrons aucune garantie d'adaptation à un usage particulier." },
      { h: "Responsabilité", p: "Dans les limites permises par la loi, nous ne sommes pas responsables des pertes indirectes ou consécutives liées à l'usage du studio, y compris l'audience ou le revenu perdus. Rien ici ne limite une responsabilité qui ne peut l'être." },
      { h: "Moteurs payants", p: "VITO X1 AUTO et VITO ULTRA V8 ne sont pas en vente. Aucune page de ce site n'encaisse de paiement, et aucune donnée bancaire n'est demandée ni traitée." },
      { h: "Modifications des conditions", p: "Nous pouvons mettre ces conditions à jour avec le produit. La date ci-dessus fait foi. Continuer à utiliser le service vaut acceptation." },
    ],
  },
  feedback: {
    title: "Dites-nous ce qui a cassé.",
    sub: "C'est un essai, et la critique est la partie utile. Une phrase suffit : ce que vous avez demandé, ce que vous avez obtenu, et ce que cela aurait dû être.",
    kind: ["quelque chose est cassé", "une idée", "un compliment, s'il est mérité"],
    message: "Votre note",
    placeholder: "J'ai demandé une campagne de parfum et obtenu une scène de rue. Le deuxième temps répétait le premier.",
    email: "Email",
    emailHint: "seulement si vous voulez une réponse",
    send: "Envoyer la note",
    sending: "Envoi",
    thanks: "Reçu.",
    thanksSub: "Merci — c'est exactement à ça que sert l'essai. Nous lisons chaque note.",
    again: "Envoyer une autre",
    failed: "L'envoi a échoué. Réessayez dans un instant.",
  },
  inbox: {
    title: "Boîte des avis",
    sub: "Pour le propriétaire du studio pendant l'essai.",
    key: "Clé",
    open: "Ouvrir",
    empty: "Rien pour l'instant.",
    error: "Pas encore de boîte sur ce déploiement, ou clé incorrecte.",
  },
  footer: {
    tagline: "De courts films verticaux, décidés par un agent et dessinés par géométrie.",
    product: "Produit",
    company: "Studio",
    legal: "Légal",
    rights: "Version d'essai. Sans compte, sans envoi, sans publicité.",
  },
  errors: {
    noField: "Écrivez d'abord une ligne.",
    limit: "L'essai autorise trois films sur cet appareil.",
  },
};

const AR: typeof EN = {
  brand: "نيكسوس",
  by: "من ڤيتو بايت",
  nav: { studio: "الاستوديو", models: "المحرّكات", about: "عن المنصة", privacy: "الخصوصية", terms: "الشروط", feedback: "رأيك" },
  common: {
    open: "ادخل الاستوديو",
    back: "عودة إلى الاستوديو",
    send: "إرسال",
    sending: "جارٍ الإرسال",
    optional: "اختياري",
    required: "مطلوب",
    lang: "اللغة",
    close: "إغلاق",
  },
  beta: {
    label: "تجريبي",
    title: "هذه نسخة تجريبية عامة.",
    body: "نيكسوس في مرحلة اختبار مبكرة. الأفلام ستكون ناقصة، بعض المتصفحات سترفض الترميز، والموجز الضعيف سيُنتج فيلماً ضعيفاً. أخبرنا بما انكسر — هذا هو معنى هذه المرحلة.",
    cta: "أرسل ملاحظتك",
  },
  home: {
    eyebrow: "استوديو وكيل · فيلم رأسي",
    h1a: "قلها مرة واحدة.",
    h1b: "خُذ الفيلم.",
    sub: "جملة واحدة عن أي شيء — مجموعة أزياء، برج، لغة برمجة، عطر. يقرّر الوكيل الفكرة والأماكن وصفحة كل نبضة والموسيقى، ثم يكتب فيلماً رأسياً تنزّله من جهازك.",
    ctaPrimary: "اصنع فيلماً",
    ctaSecondary: "تعرّف على المحرّكات",
    demoNote: "من صنع الوكيل",
    demoMeta: "١٨ ثانية · جملة واحدة · بلا لقطات ولا مكتبات",
    stats: [
      { n: "١١", l: "معمارية صفحة" },
      { n: "٣", l: "لغات، تُكتشف" },
      { n: "٠", l: "ملف مرفوع" },
      { n: "٣٠ ث", l: "لكل فيلم" },
    ],
    howTitle: "كيف يعمل",
    how: [
      { n: "٠١", t: "يقرأ", d: "يُقرأ الموجز على حقيقته: دار أزياء، برج، مترجم برمجي، عطر. تُحسم اللغة والموضوع والرغبة قبل أن يُرسم أي شيء." },
      { n: "٠٢", t: "يقرّر", d: "تُوزَّع ستّ نبضات — دعوى، أماكن، دليل، رقم، توقيع — وتأخذ كلّ نبضة معمارية الصفحة التي تستحقها. لا تتكرّر صفحة في نبضتين متتاليتين." },
      { n: "٠٣", t: "يُرندر", d: "كل مكان يُرسم من هندسة، لا يُصوَّر. الموسيقى تُصنَّع. الفيلم يُرمَّز داخل متصفحك، فلا يُرفع شيء ولا ينتظر شيء في طابور." },
    ],
    modelsTitle: "ثلاثة محرّكات",
    modelsSub: "واحد مفتوح اليوم. والاثنان الآخران يُبنيان مع استوديوهات تحتاج أكثر من ثلاثين ثانية.",
    closeTitle: "ابدأ بجملة واحدة.",
    closeSub: "بلا حساب. بلا بطاقة. ثلاثة أفلام في التجربة، ثم يطلب منك العودة لاحقاً.",
  },
  models: {
    title: "المحرّكات",
    sub: "ثلاثة محرّكات، استوديو واحد. كل واحد مضبوط على طموح مختلف — والمجاني محدود بقصد حتى يكون المدفوع جيداً.",
    note: "المحرّكات المدفوعة مغلقة أثناء التجربة. لا صفحة في هذا الموقع تحاسب على شيء، ولا تُطلب بطاقة في أي مكان فيه.",
    cards: [
      {
        name: "VITO LITE V2",
        tag: "مفتوح · مجاني",
        blurb: "يقرأ الموجز، يقرّر الفيلم، يرسم كل مكان من الشيفرة، يضع الموسيقى، ويسلّمك الملف.",
        strong: ["إحدى عشرة معمارية صفحة، بلا تكرار", "تصميم صوتي وموسيقى عند −14 LUFS", "ثلاثة أفلام لكل جهاز في التجربة", "الترميز على جهازك"],
        limits: ["٣ أفلام", "٣٠ ثانية", "1080 × 1920"],
      },
      {
        name: "VITO X1 AUTO",
        tag: "مغلق",
        blurb: "يعمل وحده. حملة كاملة تدخل، ومجموعة أفلام تشترك في نحويّة واحدة تخرج.",
        strong: ["سلسلة لا فيلماً واحداً", "صوت فنّان بثلاث لغات", "نسخ ٦٠ و٩٠ ثانية", "إدارة فنية مشتركة للسلسلة"],
        limits: ["لم يُفتح بعد"],
      },
      {
        name: "VITO ULTRA V8",
        tag: "مغلق",
        blurb: "لإطلاق كبير. عوالم أعمق، مرورات أكثر، ونسخة مخرج تُعرض على مجلس.",
        strong: ["4K بالاتجاهين", "ثلاث مراجعات قبل التسليم", "موسيقى خاصة مع مسارات منفصلة", "فيلم يصمد على شاشة عرض"],
        limits: ["لم يُفتح بعد"],
      },
    ],
    tableTitle: "ما يختلف",
    table: [
      ["الطول", "٣٠ ثانية", "٦٠–٩٠ ثانية", "حتى ٣ دقائق"],
      ["الأفلام لكل موجز", "فيلم", "سلسلة", "سلسلة"],
      ["المعماريات", "١١", "٢٤", "٢٤ + خاصة"],
      ["الصوت", "بلا تعليق", "ثلاث لغات", "صوت مُخرَج"],
      ["الدقة", "1080 × 1920", "1080 × 1920", "4K"],
      ["مراجعات", "لا شيء", "واحدة", "ثلاث"],
    ],
  },
  about: {
    title: "استوديو، لا قالب.",
    sub: "نيكسوس يصنع أفلاماً رأسية قصيرة من جملة واحدة. يقوم على قناعة واحدة: الفيلم سلسلة قرارات، والقرار يُتعلَّم.",
    sections: [
      { h: "ما الذي يفعله", p: "تكتب موجزاً. يقرأه المخطِّط موضوعاً ولغة ورغبة، ويوزّع فيلماً من ستّ نبضات. ثم يكتب المخرج الفكرة، وكل سطر نص، ويختار أيّاً من إحدى عشرة معمارية تستحقها كل نبضة. الصورة تُرسم هندسياً في المتصفح، والموسيقى تُصنَّع من نفس ورقة الإشارات التي قُطع عليها الفيلم." },
      { h: "لماذا ليس قالباً", p: "القالب يغيّر اللون ويُبقي الهيكل. هنا الهيكل أرضية فقط: لا تتكرّر صفحة في نبضتين متتاليتين، ولا يُنتج موجزان نفس الفيلم، والفيلم يخبرك بما رفض إدخاله ولماذا. إن جاء النص عامّاً، فقد أخفق المخرج في تلك النبضة — لا التصميم." },
      { h: "ما ليس هو", p: "ليس مكتبة لقطات، ولا محرّر مونتاج، ولا كاميرا. لا توجد لقطات مصوّرة: كل مكان يُبنى هندسياً، فلا شيء مرخّص ولا يمكن أن يُعرَف كإطار شخص آخر. ولن يحلّ محل مخرج يملك لقطات وفريقاً وأسبوعاً." },
      { h: "لماذا هو مجاني الآن", p: "لأنه في مرحلة اختبار. التجربة محدودة بقصد بثلاثة أفلام لكل جهاز وثلاثين ثانية لكل فيلم، حتى يستخدمه من سيخبرنا أين يضعف." },
    ],
    facts: [
      { k: "المرحلة", v: "تجربة عامة" },
      { k: "يعمل", v: "داخل متصفحك" },
      { k: "الرفع", v: "لا شيء" },
      { k: "من", v: "ڤيتو بايت" },
    ],
  },
  privacy: {
    title: "الخصوصية",
    updated: "آخر تحديث ٢٩ أكتوبر ٢٠٢٦ · نسخة تجريبية",
    intro: "كُتب هذا النص ليُقرأ، لا ليحمينا. أثناء التجربة لا يجمع نيكسوس إلا القليل، وما يجمعه مذكور هنا بالكامل.",
    sections: [
      { h: "موجزك", p: "تُكتب الموجزات في الاستوديو وتُرسل إلى طرفنا الحافّي ليكتبها نموذج المخرج. لا تُخزَّن بعد عودة الرد، ولا تُستخدم لتدريب أي شيء، ولا تُربَط بهويتك — لا حساب ولا كوكي يعرّف بك." },
      { h: "فيلمك", p: "تُرندَر الأفلام وتُرمَّز داخل متصفحك. لا يُرفع ملف الفيديو إلينا أبداً؛ وعند الضغط على التنزيل ينتقل من الذاكرة إلى قرصك. لا نستطيع رؤيته ولا استعادته ولا حذفه بالنيابة عنك." },
      { h: "ما يُحفظ على جهازك", p: "مدخل واحد في التخزين المحلي يعدّ الأفلام المصنوعة على هذا الجهاز حتى تكون التجربة محدودة بصدق، وآخر يتذكّر لغتك. يمكنك مسحهما من إعدادات المتصفح، ولن يتأثر شيء سوى العدّاد." },
      { h: "الملاحظات", p: "إذا أرسلت ملاحظة نحفظ ما كتبته، والصفحة التي أُرسلت منها، واللغة، وبريداً إلكترونياً فقط إن اخترت تركه. نحفظها لإصلاح المنتج والرد عليك. اطلب حذفها فتُحذف." },
      { h: "السجلات والبنية", p: "يُقدَّم الموقع عبر Cloudflare Workers، وتحتفظ Cloudflare بسجلات طلبات قياسية لأغراض الأمن ومنع الإساءة وفق سياستها. لا نشغّل إعلانات، ولا بكسلات تحليل، ولا تسجيل جلسات، ولا بصمة متصفح." },
      { h: "الأطفال", p: "الاستوديو غير موجّه لمن هم دون ١٣ عاماً، ولا نحفظ عنهم شيئاً بقصد. إن أرسل طفل ملاحظة، راسلنا وستُحذف." },
      { h: "حقوقك", p: "يمكنك أن تسأل عمّا نحتفظ به عنك، أو تطلب نسخة، أو تطلب الحذف. الإجابة الصادقة في هذه المرحلة غالباً: رسالة ملاحظة واحدة، إن كنت أرسلت واحدة. الطلبات تمرّ عبر صفحة الملاحظات." },
      { h: "التغييرات", p: "إذا تغيّرت هذه السياسة جوهرياً يتغيّر التاريخ أعلاه ويُنبّه إشعار التجربة في الصفحة الرئيسية. استمرارك في الاستخدام بعد ذلك يعني قبول النص الجديد." },
    ],
  },
  terms: {
    title: "الشروط",
    updated: "آخر تحديث ٢٩ أكتوبر ٢٠٢٦ · نسخة تجريبية",
    intro: "شروط واضحة لمنتج تحت الاختبار. إن رأيت بنداً غير عادل، قله في صفحة الملاحظات — التجربة موجودة لكتشاف ذلك.",
    sections: [
      { h: "الخدمة", p: "يحوّل نيكسوس موجزاً مكتوباً إلى فيلم رأسي قصير. يُقدَّم كما هو في تجربة عامة: تتغيّر الميزات وتتغيّر الحدود، وقد تتوقف الخدمة دون إشعار أثناء العمل عليها." },
      { h: "موجزك وفيلمك", p: "ما تكتبه ملكك. والفيلم المُنتَج منه ملكك لتنشره، بما في ذلك تجارياً، دون إلزام بذكر المصدر. وأنت مسؤول عن الموجز الذي تُرسله وعن كيفية استخدام الناتج، بما في ذلك أي ادعاء فيه." },
      { h: "الاستخدام المقبول", p: "لا تستخدم الاستوديو لإنتاج محتوى غير قانوني، أو انتحال شخصية أو علامة لا تمثّلها، أو استهداف جماعة محمية، أو خداع متعمّد. ويمكننا رفض الخدمة أو حجب الوصول لذلك." },
      { h: "حدود التجربة", p: "ثلاثة أفلام لكل جهاز وثلاثون ثانية لكل فيلم، مطبّقة داخل الاستوديو. هذه الحدود تُبقي التجربة قابلة للاستخدام للجميع وقد تتغيّر في أي وقت." },
      { h: "لا ضمان", p: "الأفلام مولَّدة، والتوليد يخطئ: كلمة في غير محلها، نبضة ضعيفة، رقم جاء من الموجز ويُقرأ غريباً خارجه. راجع ما تنشره. لا نقدّم أي ضمان بملاءمة لغرض معيّن." },
      { h: "المسؤولية", p: "بالحدود التي يسمح بها القانون، لا نتحمّل مسؤولية الأضرار غير المباشرة أو التبعية الناشئة عن استخدام الاستوديو، بما في ذلك فقدان الجمهور أو الإيراد. ولا شيء هنا يحدّ من مسؤولية لا يمكن الحدّ منها." },
      { h: "المحرّكات المدفوعة", p: "VITO X1 AUTO و VITO ULTRA V8 غير مطروحين للبيع. لا صفحة في هذا الموقع تقبض أي دفعة، ولا تُطلب أي بيانات بطاقة أو تُعالَج في أي مكان فيه." },
      { h: "تغييرات الشروط", p: "يمكننا تحديث هذه الشروط مع تطوّر المنتج. التاريخ أعلاه هو المرجع. استمرار الاستخدام بعد التغيير يعني القبول." },
    ],
  },
  feedback: {
    title: "أخبرنا بما انكسر.",
    sub: "هذه تجربة، والنقد هو الجزء المفيد. جملة تكفي — ماذا طلبت، وماذا حصلت، وماذا كان يجب أن يكون.",
    kind: ["شيء لا يعمل", "فكرة", "ثناء، إن كان مستحقاً"],
    message: "ملاحظتك",
    placeholder: "طلبت حملة عطر فحصلت على مشهد شارع. والنبضة الثانية كرّرت الأولى.",
    email: "البريد",
    emailHint: "فقط إن أردت ردّاً",
    send: "أرسل الملاحظة",
    sending: "جارٍ الإرسال",
    thanks: "وصلت.",
    thanksSub: "شكراً — هذا بالضبط ما تجري التجربة من أجله. نقرأ كل ملاحظة.",
    again: "أرسل أخرى",
    failed: "لم تُرسل. أعد المحاولة بعد لحظة.",
  },
  inbox: {
    title: "صندوق الملاحظات",
    sub: "لصاحب الاستوديو أثناء التجربة.",
    key: "المفتاح",
    open: "افتح",
    empty: "لا شيء بعد.",
    error: "لا صندوق على هذا النشر بعد، أو المفتاح غير صحيح.",
  },
  footer: {
    tagline: "أفلام رأسية قصيرة، يقرّرها وكيل ويرسمها من الهندسة.",
    product: "المنتج",
    company: "الاستوديو",
    legal: "قانوني",
    rights: "نسخة تجريبية. بلا حسابات، بلا رفع، بلا إعلانات.",
  },
  errors: {
    noField: "اكتب سطراً أولاً.",
    limit: "التجربة تسمح بثلاثة أفلام على هذا الجهاز.",
  },
};

export const DICT: Record<Lang, typeof EN> = { en: EN, fr: FR, ar: AR };
export type Copy = typeof EN;

const KEY = "nexus.lang";

const detect = (): Lang => {
  try {
    const q = new URLSearchParams(location.search).get("lang");
    if (q && LANGS.includes(q as Lang)) return q as Lang;
    const saved = localStorage.getItem(KEY) as Lang | null;
    if (saved && LANGS.includes(saved)) return saved;
  } catch {
    /* private mode */
  }
  const n = (navigator.language || "en").slice(0, 2).toLowerCase();
  if (n === "ar") return "ar";
  if (n === "fr") return "fr";
  return "en";
};

export const useLang = (): [Lang, Copy, (l: Lang) => void] => {
  const [lang, setLang] = useState<Lang>(detect);
  const set = (l: Lang) => {
    setLang(l);
    try {
      localStorage.setItem(KEY, l);
    } catch {
      /* ignore */
    }
  };
  useEffect(() => {
    const html = document.documentElement;
    html.lang = lang;
    html.dir = isRTL(lang) ? "rtl" : "ltr";
  }, [lang]);
  return [lang, DICT[lang], set];
};
