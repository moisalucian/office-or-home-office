import React, { useState } from 'react';
import './PostUpdateNotification.css';

const PostUpdateNotification = ({ 
  updateState, 
  onDismiss, 
  onRetryUpdate, 
  onManualUpdate 
}) => {
  const [isVisible, setIsVisible] = useState(true);

  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(() => onDismiss(), 300);
  };

  const handleRetryUpdate = () => {
    handleDismiss();
    setTimeout(() => onRetryUpdate(), 300);
  };

  const handleManualUpdate = () => {
    onManualUpdate();
  };

  if (!isVisible) return null;

  // Success notification
  if (updateState.success) {
    return (
      <div className="post-update-notification success">
        <div className="post-update-notification-content">
          <button 
            className="close-btn" 
            onClick={handleDismiss}
            title="Close notification"
          >
            ×
          </button>
          
          <div className="post-update-header">
            <h3>✅ Update Successful!</h3>
          </div>
          
          <div className="post-update-info">
            <p>New version installed successfully.</p>
            <div className="version-info">
              <strong>Current version: {updateState.version}</strong>
            </div>
          </div>
          
          <div className="post-update-actions">
            <button 
              className="post-update-btn primary"
              onClick={handleDismiss}
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Failure notification
  return (
    <div className="post-update-notification error">
      <div className="post-update-notification-content">
        <button 
          className="close-btn" 
          onClick={handleDismiss}
          title="Close notification"
        >
          ×
        </button>
        
        <div className="post-update-header">
          <h3>⚠️ Update Issue</h3>
        </div>
        
        <div className="post-update-info">
          <p>New version couldn't be installed automatically. You can try again or update manually.</p>
          <p className="error-details">If the problem persists, contact the system administrator.</p>
        </div>
        
        <div className="post-update-actions">
          <button 
            className="post-update-btn primary"
            onClick={handleRetryUpdate}
            title="Retry the automatic update process"
          >
            Try Again
          </button>
          <button 
            className="post-update-btn secondary"
            onClick={handleManualUpdate}
            title="Open GitHub repository to download manually"
          >
            Update Manually
          </button>
          <button 
            className="post-update-btn tertiary"
            onClick={handleDismiss}
            title="Dismiss this notification"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};

export default PostUpdateNotification;
