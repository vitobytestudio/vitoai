/**
 * NEXUS — the shell.
 *
 * A real site: a sticky bar, a public trial notice, seven pages, three
 * languages, a footer with the legal documents reachable from anywhere.
 *
 * The one rule that matters for performance: nothing heavy is imported here.
 * The film engine is only reached through /studio, and the encoder only through
 * a dynamic import inside it, so the first paint is text and hairlines.
 */
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { LANGS, LANG_LABEL, useLang, isRTL, type Lang } from "./i18n";
import { Link, usePath, navigate } from "./router";
import { Home, Models, About, Legal, Feedback, Inbox, Missing } from "./site";
import { Tool } from "./tool";

const BETA_KEY = "nexus.beta.dismissed";

const BetaBar: React.FC<{ lang: Lang; c: ReturnType<typeof useLang>[1] }> = ({ c }) => {
  const [open, setOpen] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    try {
      setGone(localStorage.getItem(BETA_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  if (gone) return null;

  return (
    <div className={`beta ${open ? "open" : ""}`}>
      <div className="beta-line">
        <span className="beta-tag">{c.beta.label}</span>
        <p>
          <b>{c.beta.title}</b> {open ? c.beta.body : null}
        </p>
        <button className="beta-more" onClick={() => setOpen((v) => !v)} aria-label="expand">
          {open ? "–" : "+"}
        </button>
        <Link to="/feedback" className="beta-cta" onNavigate={() => setOpen(false)}>
          {c.beta.cta}
        </Link>
        <button
          className="beta-x"
          aria-label={c.common.close}
          onClick={() => {
            setGone(true);
            try {
              localStorage.setItem(BETA_KEY, "1");
            } catch {
              /* ignore */
            }
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
};

const Bar: React.FC<{ lang: Lang; setLang: (l: Lang) => void; c: ReturnType<typeof useLang>[1]; path: string }> = ({
  lang,
  setLang,
  c,
  path,
}) => {
  const [menu, setMenu] = useState(false);

  useEffect(() => setMenu(false), [path]);

  const links: { to: string; label: string }[] = [
    { to: "/studio", label: c.nav.studio },
    { to: "/models", label: c.nav.models },
    { to: "/about", label: c.nav.about },
    { to: "/feedback", label: c.nav.feedback },
  ];

  return (
    <header className="s-bar">
      <Link to="/" className="s-mark">
        <span className="s-dot" />
        <b>{c.brand}</b>
        <span>{c.by}</span>
      </Link>

      <nav className={`s-nav ${menu ? "open" : ""}`}>
        {links.map((l) => (
          <Link key={l.to} to={l.to} className={path === l.to ? "on" : ""}>
            {l.label}
          </Link>
        ))}
        <div className="langs">
          {LANGS.map((l) => (
            <button key={l} className={l === lang ? "on" : ""} onClick={() => setLang(l)} aria-label={LANG_LABEL[l]}>
              {LANG_LABEL[l]}
            </button>
          ))}
        </div>
        <Link to="/studio" className="s-go small">
          {c.common.open}
        </Link>
      </nav>

      <button className="burger" onClick={() => setMenu((v) => !v)} aria-label="menu">
        <i />
        <i />
      </button>
    </header>
  );
};

const Foot: React.FC<{ c: ReturnType<typeof useLang>[1] }> = ({ c }) => (
  <footer className="foot">
    <div className="foot-grid">
      <div className="foot-brand">
        <span className="s-dot" />
        <b>{c.brand}</b>
        <p>{c.footer.tagline}</p>
      </div>
      <div>
        <span className="foot-h">{c.footer.product}</span>
        <Link to="/studio">{c.nav.studio}</Link>
        <Link to="/models">{c.nav.models}</Link>
      </div>
      <div>
        <span className="foot-h">{c.footer.company}</span>
        <Link to="/about">{c.nav.about}</Link>
        <Link to="/feedback">{c.nav.feedback}</Link>
      </div>
      <div>
        <span className="foot-h">{c.footer.legal}</span>
        <Link to="/privacy">{c.nav.privacy}</Link>
        <Link to="/terms">{c.nav.terms}</Link>
        <Link to="/inbox">{c.beta.label}</Link>
      </div>
    </div>
    <div className="foot-bottom">
      <span>
        © {new Date().getFullYear()} {c.by}
      </span>
      <span>{c.footer.rights}</span>
    </div>
  </footer>
);

const App: React.FC = () => {
  const [lang, c, setLang] = useLang();
  const path = usePath();

  // a cold load of /models lands at the top of /models, not at a scroll offset
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [path]);

  const page = (() => {
    if (path === "/") return <Home c={c} lang={lang} />;
    if (path === "/studio") return <Tool lang={lang} />;
    if (path === "/models") return <Models c={c} />;
    if (path === "/about") return <About c={c} />;
    if (path === "/privacy") return <Legal c={c} kind="privacy" />;
    if (path === "/terms") return <Legal c={c} kind="terms" />;
    if (path === "/feedback") return <Feedback c={c} lang={lang} />;
    if (path === "/inbox") return <Inbox c={c} />;
    return <Missing lang={lang} />;
  })();

  return (
    <div className={`site ${isRTL(lang) ? "rtl" : ""}`}>
      <BetaBar lang={lang} c={c} />
      <Bar lang={lang} setLang={setLang} c={c} path={path} />
      <main key={path} className="main">
        {page}
      </main>
      <Foot c={c} />
      {path !== "/studio" && path !== "/" ? (
        <button className="fab" onClick={() => navigate("/studio")} aria-label={c.common.open}>
          <span />
          {c.common.open}
        </button>
      ) : null}
    </div>
  );
};

/* a handle for the render-timing probe: nothing is loaded unless ?probe is set */
if (new URLSearchParams(location.search).has("probe")) {
  void import("./exporter").then((m) => {
    (window as unknown as { __x: unknown }).__x = m;
  });
}

createRoot(document.getElementById("root") as HTMLElement).render(<App />);
