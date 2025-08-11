/**
 * Save notification settings for a user
 */
export const saveNotificationSettings = (username, settings) => {
  const current = JSON.parse(localStorage.getItem("notificationSettings")) || {};
  current[username] = settings;
  localStorage.setItem("notificationSettings", JSON.stringify(current));
};

/**
 * Load notification settings for a user
 */
export const loadNotificationSettings = (username) => {
  const current = JSON.parse(localStorage.getItem("notificationSettings")) || {};
  return current[username] || [];
};

/**
 * Update notification settings when username changes
 */
export const updateNotificationSettingsName = (oldUsername, newUsername) => {
  const settings = JSON.parse(localStorage.getItem("notificationSettings")) || {};
  if (settings[oldUsername]) {
    settings[newUsername] = settings[oldUsername];
    delete settings[oldUsername];
    localStorage.setItem("notificationSettings", JSON.stringify(settings));
  }
};

/**
 * Save a single setting to localStorage
 */
export const saveSetting = (key, value) => {
  localStorage.setItem(key, typeof value === 'boolean' ? value.toString() : value);
};

/**
 * Load a setting from localStorage
 */
export const loadSetting = (key, defaultValue = null) => {
  const value = localStorage.getItem(key);
  if (value === null) return defaultValue;
  
  // Handle boolean values
  if (value === 'true') return true;
  if (value === 'false') return false;
  
  return value;
};
