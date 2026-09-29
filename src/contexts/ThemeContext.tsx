"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type DisplayTheme = "amoled" | "slate";

interface ThemeContextType {
  theme: DisplayTheme;
  isAmoled: boolean;
  toggleTheme: () => void;
  setTheme: (theme: DisplayTheme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "slate",
  isAmoled: false,
  toggleTheme: () => {},
  setTheme: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<DisplayTheme>("slate");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("apexwall_display_theme") as DisplayTheme | null;
    if (saved === "amoled" || saved === "slate") {
      setThemeState(saved);
      applyThemeToDom(saved);
    } else {
      // Default to soft Obsidian Slate for smooth, glare-free executive eye appeal
      setThemeState("slate");
      applyThemeToDom("slate");
    }
  }, []);

  const applyThemeToDom = (newTheme: DisplayTheme) => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const body = document.body;

    if (newTheme === "amoled") {
      root.classList.add("amoled");
      body.classList.add("amoled");
      root.setAttribute("data-theme", "amoled");
    } else {
      root.classList.remove("amoled");
      body.classList.remove("amoled");
      root.setAttribute("data-theme", "slate");
    }
  };

  const setTheme = (newTheme: DisplayTheme) => {
    setThemeState(newTheme);
    localStorage.setItem("apexwall_display_theme", newTheme);
    applyThemeToDom(newTheme);
  };

  const toggleTheme = () => {
    const next = theme === "amoled" ? "slate" : "amoled";
    setTheme(next);
  };

  return (
    <ThemeContext.Provider value={{ theme, isAmoled: theme === "amoled", toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
