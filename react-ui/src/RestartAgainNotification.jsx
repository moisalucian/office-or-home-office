import { useState, useEffect } from 'react';
import './RestartAgainNotification.css';

function RestartAgainNotification() {
  const [restartInfo, setRestartInfo] = useState(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    checkForSecondRestartNeeded();
  }, []);

  const checkForSecondRestartNeeded = async () => {
    try {
      const result = await window.electronAPI.checkSecondRestartCompleted();
      if (result && result.isSecondRestart) {
        setRestartInfo(result);
        setIsVisible(true);
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
          setIsVisible(false);
        }, 5000);
      }
    } catch (error) {
      console.error('Error checking second restart status:', error);
    }
  };

  const handleRestartAgain = async () => {
    try {
      await window.electronAPI.restartApp();
    } catch (error) {
      console.error('Error restarting app:', error);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
  };

  if (!isVisible || !restartInfo) {
    return null;
  }

  return (
    <div className="restart-again-overlay">
      <div className="restart-again-notification">
        <div className="restart-again-header">
          <h3>🔄 Update Applied!</h3>
          <button 
            className="restart-again-close" 
            onClick={handleDismiss}
            type="button"
            aria-label="Dismiss notification"
          >
            ✕
          </button>
        </div>
        
        <div className="restart-again-content">
          <p>Your app has been updated to version <strong>v{restartInfo.version}</strong>!</p>
          <p>For the update to take full effect, please restart the app one more time.</p>
          
          <div className="restart-again-actions">
            <button 
              className="restart-again-button primary"
              onClick={handleRestartAgain}
              type="button"
            >
              🔄 Restart Now
            </button>
            <button 
              className="restart-again-button secondary"
              onClick={handleDismiss}
              type="button"
            >
              Later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RestartAgainNotification;
