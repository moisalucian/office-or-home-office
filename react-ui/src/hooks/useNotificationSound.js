import { useState, useEffect } from 'react';
import { loadSetting, saveSetting } from '../utils/storageUtils';

export const useNotificationSound = () => {
  const [notificationSound, setNotificationSound] = useState('none');

  useEffect(() => {
    // Load saved notification sound setting
    const savedNotificationSound = loadSetting("notificationSound", "none");
    setNotificationSound(savedNotificationSound);

    // Listen for sound errors
    if (window.electronAPI?.onSoundError) {
      window.electronAPI.onSoundError((errorMessage) => {
        alert(`Sound Error: ${errorMessage}\n\nPlease add the sound files to the electron/sounds/ folder.`);
      });
    }
  }, []);

  const handleNotificationSoundChange = (e) => {
    const value = e.target ? e.target.value : e; // Handle both event objects and direct values
    console.log('[React] Notification sound changed to:', value);
    
    setNotificationSound(value);
    saveSetting("notificationSound", value);
    console.log('[React] Saved to localStorage');
    
    // Call Electron API to save setting
    if (window.electronAPI) {
      console.log('[React] Calling electronAPI.setNotificationSound with:', value);
      window.electronAPI.setNotificationSound(value);
      console.log('[React] electronAPI.setNotificationSound called');
    } else {
      console.error('[React] electronAPI not available!');
    }
  };

  const previewNotificationSound = () => {
    if (notificationSound !== 'none' && window.electronAPI) {
      window.electronAPI.previewNotificationSound(notificationSound);
    }
  };

  return {
    notificationSound,
    handleNotificationSoundChange,
    previewNotificationSound
  };
};
