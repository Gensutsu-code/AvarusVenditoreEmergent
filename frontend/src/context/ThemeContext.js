import { createContext, useContext, useEffect } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// Always light theme; toggles are no-ops kept for compatibility
const VALUE = { theme: 'light', setTheme: () => {}, toggleTheme: () => {}, isDark: false, isLight: true };

export const ThemeProvider = ({ children }) => {

  useEffect(() => {
    // Ensure light theme is applied
    document.documentElement.classList.add('light-theme');
    document.documentElement.classList.remove('dark-theme');
    localStorage.setItem('theme', 'light');
  }, []);

  return <ThemeContext.Provider value={VALUE}>{children}</ThemeContext.Provider>;
};
