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
    const currentVersion = await getCurrentVersion();
    console.log('Current version:', currentVersion);
    
    const response = await fetch(GITHUB_RELEASES_URL);
    if (!response.ok) {
      // Fallback to commits API if no releases
      return await checkForUpdatesFromCommits();
    }
    
    const releaseData = await response.json();
    const latestVersion = releaseData.tag_name.replace(/^v/, ''); // Remove 'v' prefix if present
    console.log('Latest version:', latestVersion);
    
    setLastVersionCheck();
    
    // Compare semantic versions - only show if latest is actually newer
    const hasUpdate = isNewerVersion(latestVersion, currentVersion);
    console.log('Has update:', hasUpdate);
    
    if (!hasUpdate) {
      return { hasUpdate: false, currentVersion, latestVersion };
    }
    
    // Check if this specific version was dismissed
    const dismissedVersion = getDismissedVersion();
    const wasDismissed = dismissedVersion === latestVersion;
    
    // Check if update was postponed
    const postponedVersion = getPostponedVersion();
    const wasPostponed = postponedVersion === latestVersion;
    
    return {
      hasUpdate,
      currentVersion,
      latestVersion,
      releaseNotes: releaseData.body || 'No release notes available',
      releaseDate: new Date(releaseData.published_at).toLocaleDateString(),
      downloadUrl: releaseData.assets.find(asset => 
        asset.name.includes('win') || asset.name.includes('.exe') || asset.name.includes('.zip')
      )?.browser_download_url,
      wasDismissed,
      wasPostponed
    };
  } catch (error) {
    console.error('Version check failed:', error);
    return { hasUpdate: false, error: error.message };
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
export const downloadAndInstallUpdate = async (downloadUrl) => {
  if (!downloadUrl) {
    throw new Error('No download URL available');
  }
  if (window.electronAPI?.downloadAndInstallUpdate && window.electronAPI?.extractAndInstallUpdate) {
    // Download the update file
    const result = await Promise.race([
      window.electronAPI.downloadAndInstallUpdate(downloadUrl),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Download timeout - please try again or download manually')), 120000)
      )
    ]);
    // Now extract and install the update
    if (result && result.success && window.electronAPI?.extractAndInstallUpdate) {
      await window.electronAPI.extractAndInstallUpdate(result.filePath);
    }
    return result;
  } else {
    window.open(downloadUrl, '_blank');
    throw new Error('Auto-update not supported in this environment');
  }
};


// Manual update check (for settings button)
export const manualUpdateCheck = async () => {
  const result = await checkForUpdates();
  setLastVersionCheck();
  return result;
};
