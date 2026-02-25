import { createContext, useContext, useEffect } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  // Always light theme
  const theme = 'light';
  const isDark = false;
  const isLight = true;

  useEffect(() => {
    // Ensure light theme is applied
    document.documentElement.classList.add('light-theme');
    document.documentElement.classList.remove('dark-theme');
    localStorage.setItem('theme', 'light');
  }, []);

  // No-op toggle for compatibility
  const toggleTheme = () => {};
  const setTheme = () => {};

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, isDark, isLight }}>
      {children}
    </ThemeContext.Provider>
  );
};
