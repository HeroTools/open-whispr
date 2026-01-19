import { useState, useEffect, useCallback, useContext, createContext, useMemo, type ReactNode } from "react";

export type ThemeMode = "light" | "dark" | "system";

const THEME_STORAGE_KEY = "themeMode";

interface ThemeContextValue {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  activeTheme: "light" | "dark";
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getStoredTheme(): ThemeMode {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") {
      return stored;
    }
  } catch {
    // Ignore storage errors
  }
  return "system";
}

function getEffectiveTheme(mode: ThemeMode): "light" | "dark" {
  if (mode === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return mode;
}

function applyThemeToDocument(theme: "light" | "dark") {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

// Apply theme on initial load (before React hydrates)
if (typeof window !== "undefined") {
  applyThemeToDocument(getEffectiveTheme(getStoredTheme()));
}

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(getStoredTheme);
  const [activeTheme, setActiveTheme] = useState<"light" | "dark">(() => getEffectiveTheme(getStoredTheme()));

  // Apply theme to document when themeMode changes
  useEffect(() => {
    const effective = getEffectiveTheme(themeMode);
    setActiveTheme(effective);
    applyThemeToDocument(effective);
  }, [themeMode]);

  // Listen for storage changes from other tabs/windows
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === THEME_STORAGE_KEY) {
        const newTheme = getStoredTheme();
        setThemeModeState(newTheme);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // Listen for system theme changes when in "system" mode
  useEffect(() => {
    if (themeMode !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = () => {
      const effective = mediaQuery.matches ? "dark" : "light";
      setActiveTheme(effective);
      applyThemeToDocument(effective);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [themeMode]);

  const setThemeMode = useCallback((newMode: ThemeMode) => {
    try {
      // Save to localStorage
      localStorage.setItem(THEME_STORAGE_KEY, newMode);

      // Immediately apply theme to document (don't wait for useEffect)
      const effective = getEffectiveTheme(newMode);
      applyThemeToDocument(effective);

      // Update state
      setThemeModeState(newMode);
      setActiveTheme(effective);
    } catch (error) {
      console.error("Failed to save theme:", error);
    }
  }, []);

  const value = useMemo<ThemeContextValue>(() => ({
    themeMode,
    setThemeMode,
    activeTheme,
    isDark: activeTheme === "dark",
  }), [themeMode, setThemeMode, activeTheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }

  return context;
}
