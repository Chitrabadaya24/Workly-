import { createContext, useContext, useLayoutEffect, useState, useCallback } from 'react';

const ThemeContext = createContext(null);

const STORAGE_KEY = 'darkMode';

export function readDarkModePreference() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'true') return true;
    if (stored === 'false') return false;
  } catch {
    /* private browsing / blocked storage */
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? false;
}

export function applyDarkModeToDocument(isDark) {
  const root = document.documentElement;
  root.classList.toggle('dark', isDark);
  root.style.colorScheme = isDark ? 'dark' : 'light';
  try {
    localStorage.setItem(STORAGE_KEY, isDark ? 'true' : 'false');
  } catch {
    /* ignore */
  }
}

export function ThemeProvider({ children }) {
  const [darkMode, setDarkMode] = useState(readDarkModePreference);

  useLayoutEffect(() => {
    applyDarkModeToDocument(darkMode);
  }, [darkMode]);

  const toggleDarkMode = useCallback(() => {
    setDarkMode((prev) => !prev);
  }, []);

  const setDark = useCallback((value) => {
    setDarkMode(Boolean(value));
  }, []);

  return (
    <ThemeContext.Provider value={{ darkMode, toggleDarkMode, setDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}
