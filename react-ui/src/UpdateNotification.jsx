import { useState, useEffect } from 'react';
import './UpdateNotification.css';

const UpdateNotification = ({ updateInfo, onDismiss }) => {
  const [isVisible, setIsVisible] = useState(true);

  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(() => onDismiss(), 300); // Wait for animation
  };

  const handleGoToRepo = () => {
    window.open('https://github.com/moisalucian/office-or-home-office', '_blank');
  };

  if (!isVisible) return null;

  return (
    <div className="update-notification">
      <div className="update-notification-content">
        <button className="update-close-btn" onClick={handleDismiss}>
          ❌
        </button>
        
        <div className="update-header">
          <h3>🚀 New Version Available!</h3>
        </div>
        
        <div className="update-info">
          <p>A new version of the app is available on GitHub.</p>
          <div className="version-details">
            <span className="version-badge current">Current: {updateInfo.currentVersion}</span>
            <span className="version-badge latest">Latest: {updateInfo.latestVersion}</span>
          </div>
          {updateInfo.commitMessage && (
            <p className="commit-message">Latest: {updateInfo.commitMessage}</p>
          )}
          {updateInfo.commitDate && (
            <p className="commit-date">Updated: {updateInfo.commitDate}</p>
          )}
        </div>
        
        <div className="update-actions">
          <button 
            className="update-btn primary" 
            onClick={handleGoToRepo}
          >
            📦 Go to Repo
          </button>
          <button 
            className="update-btn secondary" 
            onClick={handleDismiss}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpdateNotification;
