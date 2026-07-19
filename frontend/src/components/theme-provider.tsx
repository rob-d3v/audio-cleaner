import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

type Theme = "dark" | "light";

const THEME_STORAGE_KEY = "ac-theme";
const DEFAULT_THEME: Theme = "dark";

interface ThemeProviderState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeProviderContext = createContext<ThemeProviderState | undefined>(
  undefined,
);

function getStoredTheme(): Theme {
  if (typeof window === "undefined") return DEFAULT_THEME;
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return stored === "light" || stored === "dark" ? stored : DEFAULT_THEME;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getStoredTheme);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const setTheme = (next: Theme) => setThemeState(next);
  const toggleTheme = () =>
    setThemeState((prev) => (prev === "dark" ? "light" : "dark"));

  return (
    <ThemeProviderContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeProviderContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
