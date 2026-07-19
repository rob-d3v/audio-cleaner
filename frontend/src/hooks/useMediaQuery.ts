import { useEffect, useState } from "react";

/** Tracks a CSS media query in React state, updating live on viewport changes. */
export function useMediaQuery(query: string): boolean {
  const getMatch = () => (typeof window !== "undefined" ? window.matchMedia(query).matches : false);
  const [matches, setMatches] = useState(getMatch);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const listener = () => setMatches(mql.matches);
    listener();
    mql.addEventListener("change", listener);
    return () => mql.removeEventListener("change", listener);
  }, [query]);

  return matches;
}

/** True below Tailwind's `md` breakpoint (768px) — the app's mobile/compact layout threshold. */
export function useIsMobile(): boolean {
  return !useMediaQuery("(min-width: 768px)");
}
