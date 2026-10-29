/**
 * THE SITE — everything that is not the tool.
 *
 * Home, models, about, privacy, terms, feedback, inbox. Written as one file on
 * purpose: these pages share a rhythm (eyebrow → statement → proof → rule), and
 * keeping them together is what stops a marketing page drifting into a
 * different design language from the legal page three clicks away.
 */
import React, { useMemo, useState } from "react";
import { demoFilm } from "../src/studio/brain";
import { MiniFilm } from "./preview";
import { type Lang, type Copy, DICT } from "./i18n";
import { Link, navigate } from "./router";

const Shell: React.FC<{ eyebrow?: string; title: string; sub?: string; children?: React.ReactNode }> = ({
  eyebrow,
  title,
  sub,
  children,
}) => (
  <section className="pg">
    {eyebrow ? (
      <p className="s-eyebrow">
        <span />
        {eyebrow}
      </p>
    ) : null}
    <h1 className="pg-title">{title}</h1>
    {sub ? <p className="pg-sub">{sub}</p> : null}
    {children}
  </section>
);

/* ------------------------------------------------------------------- home */

export const Home: React.FC<{ c: Copy; lang: Lang }> = ({ c, lang }) => {
  // one real film, made by the same engine, before anyone types anything
  const demo = useMemo(() => {
    try {
      return demoFilm(lang);
    } catch {
      return null;
    }
  }, [lang]);

  return (
    <>
      <section className="s-hero">
        <div className="s-hero-grid">
          <div className="s-hero-copy">
            <p className="s-eyebrow">
              <span />
              {c.home.eyebrow}
            </p>
            <h1>
              {c.home.h1a}
              <br />
              <span>{c.home.h1b}</span>
            </h1>
            <p className="s-sub">{c.home.sub}</p>
            <div className="hero-cta">
              <Link to="/studio" className="s-go">
                {c.home.ctaPrimary}
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M1 7h11M7.5 2.5 12 7l-4.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
              <Link to="/models" className="s-ghost">
                {c.home.ctaSecondary}
              </Link>
            </div>
          </div>

          {demo ? (
            <aside className="s-demo">
              <div className="s-phone">
                <MiniFilm plan={demo} width={306} />
                <span className="s-phone-glare" />
              </div>
              <p className="s-demo-note">
                <b>{c.home.demoNote}</b>
                {c.home.demoMeta}
              </p>
            </aside>
          ) : null}
        </div>
      </section>

      <section className="stats">
        {c.home.stats.map((s) => (
          <div key={s.l} className="stat">
            <b>{s.n}</b>
            <span>{s.l}</span>
          </div>
        ))}
      </section>

      <section className="s-steps-wrap">
        <p className="s-eyebrow small">
          <span />
          {c.home.howTitle}
        </p>
        <div className="s-steps">
          {c.home.how.map((h) => (
            <article key={h.n} className="s-step">
              <span className="s-step-n">{h.n}</span>
              <h3>{h.t}</h3>
              <p>{h.d}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="tease">
        <div className="tease-head">
          <h2>{c.home.modelsTitle}</h2>
          <p>{c.home.modelsSub}</p>
          <Link to="/models" className="s-ghost">
            {c.nav.models}
          </Link>
        </div>
        <div className="tease-row">
          {c.models.cards.map((m, i) => (
            <div key={m.name} className={`tease-card ${i === 0 ? "on" : ""}`}>
              <b>{m.name}</b>
              <em>{m.tag}</em>
            </div>
          ))}
        </div>
      </section>

      <section className="close">
        <h2>{c.home.closeTitle}</h2>
        <p>{c.home.closeSub}</p>
        <Link to="/studio" className="s-go">
          {c.home.ctaPrimary}
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M1 7h11M7.5 2.5 12 7l-4.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </section>
    </>
  );
};

/* ----------------------------------------------------------------- models */

export const Models: React.FC<{ c: Copy }> = ({ c }) => (
  <Shell eyebrow={c.nav.models.toLowerCase()} title={c.models.title} sub={c.models.sub}>
    <div className="mgrid">
      {c.models.cards.map((m, i) => (
        <article key={m.name} className={`mcard ${i === 0 ? "open" : ""}`}>
          <div className="mcard-top">
            <span className="s-model-dot" />
            <b>{m.name}</b>
            <em>{m.tag}</em>
          </div>
          <p>{m.blurb}</p>
          <ul>
            {m.strong.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
          <div className="s-limits">
            {m.limits.map((s) => (
              <span key={s}>{s}</span>
            ))}
          </div>
        </article>
      ))}
    </div>

    <div className="table">
      <div className="table-head">
        <span>{c.models.tableTitle}</span>
        {c.models.cards.map((m) => (
          <span key={m.name}>{m.name}</span>
        ))}
      </div>
      {c.models.table.map((row) => (
        <div key={row[0]} className="table-row">
          {row.map((cell, i) => (
            <span key={i} className={i === 0 ? "k" : i === 1 ? "v on" : "v"}>
              {cell}
            </span>
          ))}
        </div>
      ))}
    </div>

    <p className="note">{c.models.note}</p>
  </Shell>
);

/* ------------------------------------------------------------------ about */

export const About: React.FC<{ c: Copy }> = ({ c }) => (
  <Shell eyebrow={c.nav.about.toLowerCase()} title={c.about.title} sub={c.about.sub}>
    <div className="facts">
      {c.about.facts.map((f) => (
        <div key={f.k}>
          <span>{f.k}</span>
          <b>{f.v}</b>
        </div>
      ))}
    </div>
    <div className="prose">
      {c.about.sections.map((s) => (
        <section key={s.h}>
          <h2>{s.h}</h2>
          <p>{s.p}</p>
        </section>
      ))}
    </div>
  </Shell>
);

/* ------------------------------------------------------------------ legal */

export const Legal: React.FC<{ c: Copy; kind: "privacy" | "terms" }> = ({ c, kind }) => {
  const doc = c[kind];
  return (
    <Shell eyebrow={kind === "privacy" ? c.nav.privacy.toLowerCase() : c.nav.terms.toLowerCase()} title={doc.title} sub={doc.intro}>
      <p className="stamp">{doc.updated}</p>
      <div className="prose legal">
        {doc.sections.map((s, i) => (
          <section key={s.h}>
            <span className="num">{String(i + 1).padStart(2, "0")}</span>
            <h2>{s.h}</h2>
            <p>{s.p}</p>
          </section>
        ))}
      </div>
      <p className="note">
        <Link to="/feedback">{c.feedback.title}</Link>
      </p>
    </Shell>
  );
};

/* --------------------------------------------------------------- feedback */

export const Feedback: React.FC<{ c: Copy; lang: Lang }> = ({ c, lang }) => {
  const [kind, setKind] = useState(0);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle");

  const send = async () => {
    if (!message.trim()) return;
    setState("sending");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: c.feedback.kind[kind], message: message.slice(0, 2000), email: email.slice(0, 160), lang, path: location.pathname }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setState("sent");
      setMessage("");
      setEmail("");
    } catch {
      setState("failed");
    }
  };

  if (state === "sent") {
    return (
      <Shell eyebrow={c.nav.feedback.toLowerCase()} title={c.feedback.thanks} sub={c.feedback.thanksSub}>
        <button className="s-ghost" onClick={() => setState("idle")} style={{ marginTop: 26 }}>
          {c.feedback.again}
        </button>
      </Shell>
    );
  }

  return (
    <Shell eyebrow={c.nav.feedback.toLowerCase()} title={c.feedback.title} sub={c.feedback.sub}>
      <div className="fb">
        <div className="fb-kinds">
          {c.feedback.kind.map((k, i) => (
            <button key={k} className={i === kind ? "on" : ""} onClick={() => setKind(i)}>
              {k}
            </button>
          ))}
        </div>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, 2000))}
          placeholder={c.feedback.placeholder}
          rows={6}
        />
        <div className="fb-foot">
          <label>
            <span>{c.feedback.email}</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value.slice(0, 160))}
              placeholder={c.feedback.emailHint}
            />
          </label>
          <button className="s-go" onClick={send} disabled={!message.trim() || state === "sending"}>
            {state === "sending" ? c.feedback.sending : c.feedback.send}
          </button>
        </div>
        {state === "failed" ? <p className="s-fatal">{c.feedback.failed}</p> : null}
      </div>
    </Shell>
  );
};

/* ------------------------------------------------------------------ inbox */

export const Inbox: React.FC<{ c: Copy }> = ({ c }) => {
  const [key, setKey] = useState("");
  const [items, setItems] = useState<{ at: string; kind: string; message: string; email?: string; lang?: string; path?: string }[] | null>(null);
  const [error, setError] = useState("");

  const open = async () => {
    setError("");
    try {
      const res = await fetch(`/api/feedback/inbox?key=${encodeURIComponent(key)}`);
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as { items: typeof items };
      setItems(json.items || []);
    } catch {
      setError(c.inbox.error);
      setItems(null);
    }
  };

  return (
    <Shell eyebrow={c.beta.label.toLowerCase()} title={c.inbox.title} sub={c.inbox.sub}>
      <div className="fb-foot" style={{ maxWidth: 520 }}>
        <label>
          <span>{c.inbox.key}</span>
          <input value={key} onChange={(e) => setKey(e.target.value)} type="password" />
        </label>
        <button className="s-go" onClick={open}>
          {c.inbox.open}
        </button>
      </div>
      {error ? <p className="s-fatal">{error}</p> : null}
      {items && items.length === 0 ? <p className="note">{c.inbox.empty}</p> : null}
      {items && items.length > 0 ? (
        <ul className="inbox">
          {items.map((it, i) => (
            <li key={i}>
              <div className="inbox-meta">
                <em>{it.kind}</em>
                <span>{new Date(it.at).toLocaleString()}</span>
                {it.email ? <a href={`mailto:${it.email}`}>{it.email}</a> : null}
                <i>{it.lang} · {it.path}</i>
              </div>
              <p>{it.message}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </Shell>
  );
};

/* --------------------------------------------------------------- not found */

export const Missing: React.FC<{ lang: Lang }> = ({ lang }) => (
  <Shell
    eyebrow="404"
    title={lang === "ar" ? "لا شيء هنا." : lang === "fr" ? "Rien ici." : "Nothing here."}
    sub={lang === "ar" ? "الصفحة غير موجودة. الاستوديو ما زال مفتوحاً." : lang === "fr" ? "Cette page n'existe pas. Le studio, lui, est ouvert." : "That page does not exist. The studio still is."}
  >
    <button className="s-go" style={{ marginTop: 26 }} onClick={() => navigate("/studio")}>
      {DICT[lang].common.open}
    </button>
  </Shell>
);
