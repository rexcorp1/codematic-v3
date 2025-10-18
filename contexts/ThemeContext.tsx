import React, { createContext, useState, useEffect, useContext, useMemo } from 'react';

type Theme = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: ResolvedTheme;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') {
      return 'system';
    }
    return (localStorage.getItem('theme') as Theme) || 'system';
  });

  // This effect handles the side-effect of updating the DOM (the class on <html>)
  // and listening for system theme changes.
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const root = window.document.documentElement;

    const handleThemeChange = () => {
      if (theme === 'system') {
        root.classList.toggle('dark', mediaQuery.matches);
      } else {
        root.classList.toggle('dark', theme === 'dark');
      }
    };

    // Apply theme on mount and when `theme` changes
    handleThemeChange();

    // Listen for system changes
    mediaQuery.addEventListener('change', handleThemeChange);

    // Cleanup listener
    return () => {
      mediaQuery.removeEventListener('change', handleThemeChange);
    };
  }, [theme]); // This effect re-runs whenever the user's preference changes.

  const setThemeAndPersist = (newTheme: Theme) => {
    localStorage.setItem('theme', newTheme);
    setTheme(newTheme);
  };

  // The resolved theme is calculated on every render.
  // This avoids state synchronization issues and is very fast.
  const resolvedTheme: ResolvedTheme = useMemo(() => {
     if (theme !== 'system') {
       return theme;
     }
     if (typeof window !== 'undefined') {
       return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
     }
     // Default for server-side rendering or environments without `window`
     return 'light';
  }, [theme]);


  return (
    <ThemeContext.Provider value={{ theme, setTheme: setThemeAndPersist, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
