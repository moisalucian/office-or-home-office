import { useState, useEffect } from 'react';
import { THEME_OPTIONS } from '../utils/constants';
import { loadSetting, saveSetting } from '../utils/storageUtils';

export const useTheme = () => {
  const [theme, setTheme] = useState(THEME_OPTIONS.SYSTEM);
  const [themeSetting, setThemeSetting] = useState(THEME_OPTIONS.SYSTEM);

  useEffect(() => {
    // Load saved theme setting with correct default (system)
    const savedTheme = loadSetting("theme", THEME_OPTIONS.SYSTEM);
    setThemeSetting(savedTheme);
    
    // Initialize theme with Electron
    if (window.electronAPI) {
      const initTheme = async () => {
        if (savedTheme === THEME_OPTIONS.SYSTEM) {
          try {
            const systemTheme = await window.electronAPI.getSystemTheme();
            setTheme(systemTheme);
            document.documentElement.setAttribute('data-theme', systemTheme);
          } catch (error) {
            console.log('Could not get system theme, defaulting to dark');
            setTheme(THEME_OPTIONS.DARK);
            document.documentElement.setAttribute('data-theme', THEME_OPTIONS.DARK);
          }
        } else {
          setTheme(savedTheme);
          document.documentElement.setAttribute('data-theme', savedTheme);
        }
        
        // Apply the theme setting to Electron
        window.electronAPI.setTheme(savedTheme);
      };
      
      // Handle theme changes from Electron
      const handleThemeChange = (newTheme) => {
        setTheme(newTheme);
        document.documentElement.setAttribute('data-theme', newTheme);
      };
      
      window.electronAPI.onThemeChanged(handleThemeChange);
      initTheme();
    }
  }, []);

  const handleThemeChange = (e) => {
    const newThemeSetting = e.target ? e.target.value : e; // Handle both event objects and direct values
    setThemeSetting(newThemeSetting);
    saveSetting("theme", newThemeSetting);
    
    // Call Electron API
    if (window.electronAPI) {
      window.electronAPI.setTheme(newThemeSetting);
    }
  };

  return {
    theme,
    themeSetting,
    handleThemeChange
  };
};
