import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { colors } from './index';

type Theme = 'light' | 'dark';

interface ThemeContextType {
    theme: Theme;
    isDark: boolean;
    setTheme: (theme: Theme) => void;
    colors: typeof colors;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  isDark: false,
  setTheme: () => { },
  colors: colors,
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemScheme = useColorScheme();
  const [theme, setTheme] = useState<Theme>(systemScheme === 'dark' ? 'dark' : 'light');

  useEffect(() => {
    if (systemScheme) {
      setTheme(systemScheme === 'dark' ? 'dark' : 'light');
    }
  }, [systemScheme]);

  const value = {
    theme,
    isDark: theme === 'dark',
    setTheme,
    colors,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
