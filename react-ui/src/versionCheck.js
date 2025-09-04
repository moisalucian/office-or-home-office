// Enhanced Version checking and auto-update utility
const GITHUB_API_URL = 'https://api.github.com/repos/moisalucian/office-or-home-office';
const GITHUB_RELEASES_URL = `${GITHUB_API_URL}/releases/latest`;
const VERSION_CHECK_INTERVAL = 2 * 60 * 60 * 1000; // 2 hours in milliseconds

// Get current app version from package.json or fallback
export const getCurrentVersion = async () => {
  // Try to get from app metadata first (will be injected by Electron)
  if (window.electronAPI?.getAppVersion) {
    try {
      const version = await window.electronAPI.getAppVersion();
      console.log('Got version from Electron:', version);
      return version || '1.0.0';
    } catch (error) {
      console.error('Error getting app version:', error);
      return '1.0.0';
    }
  }
  // Fallback to localStorage or default
  return localStorage.getItem('currentAppVersion') || '1.0.0';
};

export const setCurrentVersion = (version) => {
  localStorage.setItem('currentAppVersion', version);
};

export const getLastVersionCheck = () => {
  const lastCheck = localStorage.getItem('lastVersionCheck');
  return lastCheck ? new Date(lastCheck) : null;
};

export const setLastVersionCheck = () => {
  localStorage.setItem('lastVersionCheck', new Date().toISOString());
};

export const shouldCheckForUpdates = () => {
  const lastCheck = getLastVersionCheck();
  if (!lastCheck) return true;
  
  const timeSinceLastCheck = Date.now() - lastCheck.getTime();
  return timeSinceLastCheck >= VERSION_CHECK_INTERVAL;
};

// Enhanced update checking with proper semantic versioning
export const checkForUpdates = async () => {
  try {
    // Use electron-updater instead of GitHub API
    if (window.electronAPI?.checkForUpdates) {
      console.log('[Update] Using electron-updater to check for updates');
      const result = await window.electronAPI.checkForUpdates();
      
      setLastVersionCheck();
      return result;
    } else {
      console.log('[Update] electronAPI.checkForUpdates not available - likely in development mode');
      
      // Fallback for development mode only
      const currentVersion = await getCurrentVersion();
      return {
        hasUpdate: false,
        currentVersion,
        latestVersion: currentVersion,
        releaseNotes: 'Update checking only works in packaged app',
        isDevelopment: true
      };
    }
  } catch (error) {
    console.error('[Update] Error checking for updates:', error);
    throw error;
  }
};

// Fallback to commits if no releases are available
const checkForUpdatesFromCommits = async () => {
  try {
    const response = await fetch(`${GITHUB_API_URL}/commits/main`);
    if (!response.ok) throw new Error('Failed to fetch commit info');
    
    const data = await response.json();
    const latestCommitSha = data.sha.substring(0, 7);
    const currentVersion = await getCurrentVersion();
    
    // For commit-based versioning, use commit SHA comparison
    const storedCommitSha = localStorage.getItem('currentCommitSha') || '';
    const hasUpdate = storedCommitSha !== latestCommitSha;
    
    if (hasUpdate) {
      localStorage.setItem('latestCommitSha', latestCommitSha);
    }
    
    return {
      hasUpdate,
      currentVersion,
      latestVersion: `${currentVersion}-${latestCommitSha}`,
      commitMessage: data.commit.message,
      commitDate: new Date(data.commit.committer.date).toLocaleDateString(),
      isCommitBased: true
    };
  } catch (error) {
    console.error('Commit-based version check failed:', error);
    return { hasUpdate: false, error: error.message };
  }
};

// Compare semantic versions (e.g., 1.2.3 vs 1.2.4)
const isNewerVersion = (latest, current) => {
  console.log(`Comparing versions: ${latest} vs ${current}`);
  
  const parseVersion = (version) => {
    // Handle version strings that might contain extra text
    const cleanVersion = version.replace(/[^\d.]/g, '').split('.').slice(0, 3);
    return cleanVersion.map(num => parseInt(num, 10) || 0);
  };
  
  const latestParts = parseVersion(latest);
  const currentParts = parseVersion(current);
  
  console.log('Latest parts:', latestParts);
  console.log('Current parts:', currentParts);
  
  for (let i = 0; i < Math.max(latestParts.length, currentParts.length); i++) {
    const latestPart = latestParts[i] || 0;
    const currentPart = currentParts[i] || 0;
    
    if (latestPart > currentPart) {
      console.log(`Latest is newer: ${latestPart} > ${currentPart}`);
      return true;
    }
    if (latestPart < currentPart) {
      console.log(`Current is newer: ${currentPart} > ${latestPart}`);
      return false;
    }
  }
  
  console.log('Versions are equal');
  return false;
};

// Update action handlers
export const dismissUpdate = (version) => {
  localStorage.setItem('dismissedUpdateVersion', version);
  localStorage.removeItem('postponedUpdateVersion');
};

export const postponeUpdate = (version) => {
  localStorage.setItem('postponedUpdateVersion', version);
  localStorage.removeItem('dismissedUpdateVersion');
};

export const clearUpdateActions = () => {
  localStorage.removeItem('dismissedUpdateVersion');
  localStorage.removeItem('postponedUpdateVersion');
};

export const getDismissedVersion = () => {
  return localStorage.getItem('dismissedUpdateVersion');
};

export const getPostponedVersion = () => {
  return localStorage.getItem('postponedUpdateVersion');
};

// Check if we should show update notification
export const shouldShowUpdateNotification = (updateInfo) => {
  if (!updateInfo.hasUpdate) return false;
  
  // Always show if postponed (they want to see it again)
  if (updateInfo.wasPostponed) return true;
  
  // Don't show if dismissed
  if (updateInfo.wasDismissed) return false;
  
  return true;
};

// Auto-update functionality
export const manualUpdateCheck = async () => {
  if (window.electronAPI?.checkForUpdates) {
    console.log('[Update] Using electron-updater for manual check');
    return window.electronAPI.checkForUpdates();
  } else {
    console.log('[Update] electronAPI.checkForUpdates not available');
    return null;
  }
};

export const downloadAndInstallUpdate = async () => {
  console.log('[Update] Using electron-updater to download and install update');
  
  if (window.electronAPI?.downloadUpdate) {
    try {
      console.log('[Update] Starting download via electron-updater');
      const result = await window.electronAPI.downloadUpdate();
      console.log('[Update] Download result:', result);
      return result;
    } catch (err) {
      console.error('[Update] Download failed:', err);
      throw err;
    }
  } else {
    console.error('[Update] electronAPI.downloadUpdate not available');
    throw new Error('Update functionality not available');
  }
};

