// Version checking utility
const GITHUB_API_URL = 'https://api.github.com/repos/moisalucian/office-or-home-office/commits/main';
const VERSION_CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

export const getCurrentVersion = () => {
  // Get current version from localStorage or default
  return localStorage.getItem('currentAppVersion') || 'unknown';
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

export const checkForUpdates = async () => {
  try {
    const response = await fetch(GITHUB_API_URL);
    if (!response.ok) throw new Error('Failed to fetch version info');
    
    const data = await response.json();
    const latestCommitSha = data.sha.substring(0, 7); // Short SHA
    const currentVersion = getCurrentVersion();
    
    setLastVersionCheck();
    
    // If we don't have a current version, set it and don't show update
    if (currentVersion === 'unknown') {
      setCurrentVersion(latestCommitSha);
      return { hasUpdate: false };
    }
    
    // Check if there's a new version
    const hasUpdate = currentVersion !== latestCommitSha;
    
    return {
      hasUpdate,
      currentVersion,
      latestVersion: latestCommitSha,
      commitMessage: data.commit.message,
      commitDate: new Date(data.commit.committer.date).toLocaleDateString()
    };
  } catch (error) {
    console.error('Version check failed:', error);
    return { hasUpdate: false, error: error.message };
  }
};

export const dismissUpdate = () => {
  localStorage.setItem('updateDismissed', 'true');
};

export const isUpdateDismissed = () => {
  return localStorage.getItem('updateDismissed') === 'true';
};

export const clearUpdateDismissal = () => {
  localStorage.removeItem('updateDismissed');
};
