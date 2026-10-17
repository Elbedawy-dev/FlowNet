import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { usersApi } from '../api/axios';

const ThemeContext = createContext({
  palette: 'cosmic',
  mode: 'dark',
  resolvedMode: 'dark',
  setPalette: () => {},
  setMode: () => {},
  isDark: true,
});

export const ThemeProvider = ({ children }) => {
  // Read initial values from localStorage or document element
  const [palette, setPaletteState] = useState(() => {
    try {
      const stored = localStorage.getItem('flownet_theme');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.palette === 'cosmic' || parsed?.palette === 'midnight') {
          return parsed.palette;
        }
      }
    } catch {
      // ignore
    }
    return document.documentElement.getAttribute('data-palette') || 'cosmic';
  });

  const [mode, setModeState] = useState(() => {
    try {
      const stored = localStorage.getItem('flownet_theme');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (['light', 'dark', 'system'].includes(parsed?.mode)) {
          return parsed.mode;
        }
      }
    } catch {
      // ignore
    }
    return document.documentElement.getAttribute('data-mode') || 'dark';
  });

  const [systemIsDark, setSystemIsDark] = useState(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return true;
  });

  // Listen to system dark mode changes
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => setSystemIsDark(e.matches);

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const resolvedMode = mode === 'system' ? (systemIsDark ? 'dark' : 'light') : mode;
  const isDark = resolvedMode === 'dark';

  // Apply attributes to <html>
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-palette', palette);
    root.setAttribute('data-mode', resolvedMode);

    if (isDark) {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
  }, [palette, resolvedMode, isDark]);

  const setPalette = useCallback((newPalette, persistToBackend = true) => {
    if (newPalette !== 'cosmic' && newPalette !== 'midnight') return;
    setPaletteState(newPalette);

    try {
      const stored = localStorage.getItem('flownet_theme');
      const prev = stored ? JSON.parse(stored) : {};
      localStorage.setItem('flownet_theme', JSON.stringify({ ...prev, palette: newPalette }));
    } catch {
      // ignore
    }

    if (persistToBackend) {
      usersApi.updateSettings({ appearance: { theme: newPalette } }).catch(() => {});
    }
  }, []);

  const setMode = useCallback((newMode, persistToBackend = true) => {
    if (!['light', 'dark', 'system'].includes(newMode)) return;
    setModeState(newMode);

    try {
      const stored = localStorage.getItem('flownet_theme');
      const prev = stored ? JSON.parse(stored) : {};
      localStorage.setItem('flownet_theme', JSON.stringify({ ...prev, mode: newMode }));
    } catch {
      // ignore
    }

    if (persistToBackend) {
      usersApi.updateSettings({ appearance: { mode: newMode } }).catch(() => {});
    }
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        palette,
        mode,
        resolvedMode,
        setPalette,
        setMode,
        isDark,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
export default ThemeContext;
