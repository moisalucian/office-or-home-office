import { useState, useEffect } from 'react';
import { loadSetting, saveSetting } from '../utils/storageUtils';

export const useNotificationSound = () => {
  const [notificationSound, setNotificationSound] = useState('three-note-doorbell');

  useEffect(() => {
    // Load saved notification sound setting
    const savedNotificationSound = loadSetting("notificationSound", "three-note-doorbell");
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
    setNotificationSound(value);
    saveSetting("notificationSound", value);
    
    // Call Electron API to save setting
    if (window.electronAPI) {
      window.electronAPI.setNotificationSound(value);
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
