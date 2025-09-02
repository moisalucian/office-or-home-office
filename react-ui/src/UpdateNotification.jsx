import { useState, useEffect, useRef } from 'react';
import './UpdateNotification.css';

const UpdateNotification = ({ 
  updateInfo, 
  onDismiss, 
  onPostpone, 
  onUpdateNow, 
  updateProgress,
  onRestartNow,
  onRestartLater,
  onCancelUpdate 
}) => {
  const lastLoggedPercent = useRef(-1);

  useEffect(() => {
    // Only log significant progress updates (every 10%)
    if (updateProgress?.phase === 'downloading' && updateProgress?.percent !== undefined) {
      const currentPercent = Math.floor(updateProgress.percent / 10) * 10;
      if (currentPercent !== lastLoggedPercent.current && currentPercent >= 0) {
        console.log(`[Update] Download progress: ${currentPercent}% - ${updateProgress.message}`);
        lastLoggedPercent.current = currentPercent;
      }
    } else if (updateProgress?.phase === 'installing') {
      console.log('[Update] Installing update...');
    } else if (updateProgress?.phase === 'ready') {
      console.log('[Update] Update ready for restart');
    } else if (updateProgress?.phase === 'error') {
      console.log('[Update] Error:', updateProgress.message);
    }
  }, [updateProgress]);
  const [isVisible, setIsVisible] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState(null);

  const handleDismiss = () => {
    if (updateProgress?.phase) return; // Don't allow dismiss during update
    setIsVisible(false);
    setTimeout(() => onDismiss(updateInfo.latestVersion), 300);
  };

  const handlePostpone = () => {
    if (updateProgress?.phase) return; // Don't allow postpone during update
    setIsVisible(false);
    setTimeout(() => onPostpone(updateInfo.latestVersion), 300);
  };

  const handleCancelUpdate = () => {
    setIsUpdating(false);
    setUpdateError(null);
    if (onCancelUpdate) {
      onCancelUpdate();
    }
  };

  const handleUpdateNow = async () => {
    console.log('[UpdateNotification] Download and Install button clicked.');
    setIsUpdating(true);
    setUpdateError(null);
    try {
      await onUpdateNow(updateInfo);
    } catch (error) {
      console.error('[UpdateNotification] Update failed:', error);
      setUpdateError(error.message);
      setIsUpdating(false);
    }
  };
  // Reset updating state when progress completes
  useEffect(() => {
    if (updateProgress?.phase === 'restart_required') {
      setIsUpdating(false);
    }
  }, [updateProgress]);

  if (!isVisible) return null;

  // Show restart options when update is ready
  if (updateProgress?.phase === 'restart_required') {
    return (
      <div className="update-notification">
        <div className="update-notification-content">
          <div className="update-header">
            <h3>🎉 Update Staged Successfully!</h3>
          </div>
          
          <div className="update-info">
            <p>The update has been downloaded and staged. Restart the app to apply the update.</p>
          </div>
          
          <div className="update-actions">
            <button 
              className="update-btn primary" 
              onClick={onRestartNow}
              title="Restart the app now to complete the update"
            >
              🔄 Restart Now
            </button>
            
            <button 
              className="update-btn secondary" 
              onClick={onRestartLater}
              title="Restart later - the update will take effect on next app launch"
            >
              📅 Restart Later
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="update-notification">
      <div className="update-notification-content">
        {!updateProgress?.phase && (
          <button 
            className="update-close-btn" 
            onClick={handlePostpone}
            disabled={isUpdating}
            title="Show again next time"
          >
            ❌
          </button>
        )}
        
        <div className="update-header">
          <h3>🚀 New Version Available!</h3>
        </div>
        
        {!updateProgress?.phase && (
          <div className="update-info">
            <div className="version-details">
              <span className="version-badge current">Current: {updateInfo.currentVersion}</span>
              <span className="version-badge latest">Latest: {updateInfo.latestVersion}</span>
            </div>
            
            {updateInfo.releaseDate && (
              <p className="release-date">Released: {updateInfo.releaseDate}</p>
            )}
            
            {updateInfo.releaseNotes && (
              <div className="release-notes">
                <h4>What's New:</h4>
                <div className="release-notes-content">
                  {updateInfo.releaseNotes}
                </div>
              </div>
            )}
            
            {updateInfo.commitMessage && (
              <p className="commit-message">Latest: {updateInfo.commitMessage}</p>
            )}
          </div>
        )}

        {/* Progress section during update */}
        {updateProgress?.phase && (
          <div className="update-progress">
            <div className="progress-header">
              <h4>
                {updateProgress.phase === 'downloading' && '📥 Downloading Update...'}
                {updateProgress.phase === 'installing' && '⚙️ Installing Update...'}
                {updateProgress.phase === 'restart_required' && '🎉 Update Staged!'}
                {updateProgress.phase === 'error' && '❌ Update Failed'}
              </h4>
              {updateProgress.phase !== 'restart_required' && (
                <button 
                  className="cancel-update-btn" 
                  onClick={handleCancelUpdate}
                  title="Cancel update"
                >
                  ❌
                </button>
              )}
              {updateProgress.phase === 'restart_required' && (
                <button 
                  className="cancel-update-btn" 
                  onClick={onRestartLater}
                  title="Hide notification - update will apply on next restart"
                >
                  ❌
                </button>
              )}
            </div>
            
            <div className="progress-bar-container">
              <div className="progress-bar">
                <div 
                  className="progress-bar-fill" 
                  style={{ width: `${updateProgress.percent}%` }}
                ></div>
              </div>
              <span className="progress-text">{updateProgress.percent}%</span>
            </div>
            
            <p className="progress-message">{updateProgress.message}</p>
          </div>
        )}
        
        {updateError && (
          <div className="update-error">
            <p>❌ Update failed: {updateError}</p>
            <p>You can download manually from the repository.</p>
          </div>
        )}
        
        {!updateProgress?.phase && (
          <div className="update-actions">
            <button 
              className="update-btn primary" 
              onClick={e => { console.log('[UpdateNotification] Download and Install button onClick fired'); handleUpdateNow(e); }}
              disabled={isUpdating}
              title="Download and install update automatically"
            >
              {isUpdating ? (
                <>
                  <span className="loading-spinner">⏳</span>
                  Starting...
                </>
              ) : (
                <>
                   Download and Install
                </>
              )}
            </button>
            
            <button 
              className="update-btn secondary" 
              onClick={handlePostpone}
              disabled={isUpdating}
              title="Show this notification again next time the app starts"
            >
              📅 Update Later
            </button>
            
            <button 
              className="update-btn tertiary" 
              onClick={handleDismiss}
              disabled={isUpdating}
              title="Don't show this notification for this version anymore"
            >
              🚫 Dismiss
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default UpdateNotification;
