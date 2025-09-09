import { useState, useEffect } from 'react';
import { THEME_OPTIONS } from '../utils/constants';

export const useThemeIcon = (theme, themeSetting) => {
  const [iconPath, setIconPath] = useState('/icon-black.ico');

  useEffect(() => {
    const determineIconPath = () => {
      let effectiveTheme = theme;
      
      // If theme setting is system, use the current resolved theme
      if (themeSetting === THEME_OPTIONS.SYSTEM) {
        effectiveTheme = theme; // This will be 'dark' or 'light' based on system
      } else {
        effectiveTheme = themeSetting; // Use the explicitly set theme
      }
      
      // Return appropriate icon based on theme
      if (effectiveTheme === THEME_OPTIONS.LIGHT) {
        return '/icon-black.ico'; // Dark icon for light theme
      } else {
        return '/icon-white.ico'; // White icon for dark theme
      }
    };

    setIconPath(determineIconPath());
  }, [theme, themeSetting]);

  return iconPath;
};
