import { useState, useEffect } from 'react';
import { loadSetting, saveSetting } from '../utils/storageUtils';

export const useWindowState = () => {
  const [isMaximized, setIsMaximized] = useState(false);
  // Set correct defaults: startup=true, tray=false, launch=window
  const [launchAtStartup, setLaunchAtStartup] = useState(true);
  const [launchInTray, setLaunchInTray] = useState(false);
  const [defaultLaunchOption, setDefaultLaunchOption] = useState('window');

  useEffect(() => {
    // Load saved settings with correct defaults from Electron
    const loadElectronSettings = async () => {
      if (window.electronAPI?.getSetting) {
        const startupSetting = await window.electronAPI.getSetting("startup", true);
        const traySetting = await window.electronAPI.getSetting("launchInTray", false);
        const launchSetting = await window.electronAPI.getSetting("defaultLaunchOption", "window");
        
        setLaunchAtStartup(startupSetting);
        setLaunchInTray(traySetting);
        setDefaultLaunchOption(launchSetting);
        
        // Also sync to localStorage for consistency
        saveSetting("launchAtStartup", startupSetting);
        saveSetting("launchInTray", traySetting);
        saveSetting("defaultLaunchOption", launchSetting);
      } else {
        // Fallback to localStorage if Electron API not available
        setLaunchAtStartup(loadSetting("launchAtStartup", true));
        setLaunchInTray(loadSetting("launchInTray", false));
        setDefaultLaunchOption(loadSetting("defaultLaunchOption", "window"));
      }
    };
    
    loadElectronSettings();

    // Listen for window state changes
    if (window.electronAPI?.onWindowStateChanged) {
      window.electronAPI.onWindowStateChanged((state) => {
        setIsMaximized(state.maximized);
      });
    }

    // Handle tray launch settings request
    if (window.electronAPI?.onGetSettingsForTrayLaunch) {
      const handleTrayLaunchRequest = () => {
        const settings = {
          defaultLaunchOption: loadSetting('defaultLaunchOption', 'window')
        };
        window.electronAPI.sendTrayLaunchSettings(settings);
      };
      
      window.electronAPI.onGetSettingsForTrayLaunch(handleTrayLaunchRequest);
    }
  }, []);

  const handleStartupToggle = (e) => {
    const isChecked = e.target ? e.target.checked : e; // Handle both event objects and direct values
    setLaunchAtStartup(isChecked);
    saveSetting("launchAtStartup", isChecked);
    if (window.electronAPI?.setStartup) {
      window.electronAPI.setStartup(isChecked);
    }
  };

  const handleLaunchInTrayToggle = (e) => {
    const isChecked = e.target ? e.target.checked : e; // Handle both event objects and direct values
    setLaunchInTray(isChecked);
    saveSetting("launchInTray", isChecked);
    
    if (window.electronAPI) {
      window.electronAPI.setLaunchInTray(isChecked);
    }
  };

  const handleDefaultLaunchOptionChange = (e) => {
    const value = e.target ? e.target.value : e; // Handle both event objects and direct values
    setDefaultLaunchOption(value);
    saveSetting("defaultLaunchOption", value);
    
    if (window.electronAPI) {
      window.electronAPI.setDefaultLaunchOption(value);
    }
  };

  return {
    isMaximized,
    launchAtStartup,
    launchInTray,
    defaultLaunchOption,
    handleStartupToggle,
    handleLaunchInTrayToggle,
    handleDefaultLaunchOptionChange
  };
};
