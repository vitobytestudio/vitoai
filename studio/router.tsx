/**
 * A router in sixty lines.
 *
 * Real URLs, not hashes: every page can be linked to, bookmarked and indexed.
 * The Worker serves the app for any path (`not_found_handling =
 * "single-page-application"`), so a cold load of /privacy works and the router
 * simply reads the path.
 */
import React, { useCallback, useEffect, useState } from "react";

const go = (to: string) => {
  if (to === location.pathname + location.search) return;
  history.pushState({}, "", to);
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
};

export const usePath = (): string => {
  const [path, setPath] = useState(location.pathname.replace(/\/+$/, "") || "/");
  useEffect(() => {
    const on = () => setPath(location.pathname.replace(/\/+$/, "") || "/");
    window.addEventListener("popstate", on);
    return () => window.removeEventListener("popstate", on);
  }, []);
  return path;
};

export const navigate = go;

export const Link: React.FC<{ to: string; className?: string; children: React.ReactNode; onNavigate?: () => void }> = ({
  to,
  className,
  children,
  onNavigate,
}) => {
  const click = useCallback(
    (e: React.MouseEvent) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      onNavigate?.();
      go(to);
    },
    [to, onNavigate],
  );
  return (
    <a href={to} className={className} onClick={click}>
      {children}
    </a>
  );
};

export const ROUTES = ["/", "/studio", "/models", "/about", "/privacy", "/terms", "/feedback", "/inbox"] as const;
export type Route = (typeof ROUTES)[number];
