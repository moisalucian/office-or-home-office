import { DAYS } from './constants';

/**
 * Get human readable timestamp
 */
export const getHumanReadableTimestamp = () => {
  return new Date().toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric', 
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
};

/**
 * Calculate next working day (skip weekends)
 */
export const getNextWorkingDay = () => {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  
  let daysToAdd = 1; // Default: tomorrow (next working day)
  
  // If it's Friday (5), next working day is Monday (add 3 days)
  // If it's Saturday (6), next working day is Monday (add 2 days)  
  // If it's Sunday (0), next working day is Monday (add 1 day)
  // For Mon-Thu (1-4), next working day is simply tomorrow (add 1 day)
  if (dayOfWeek === 5) { // Friday
    daysToAdd = 3; // Skip Saturday and Sunday
  } else if (dayOfWeek === 6) { // Saturday
    daysToAdd = 2; // Skip Sunday
  } else if (dayOfWeek === 0) { // Sunday
    daysToAdd = 1; // Tomorrow is Monday
  }
  // For Monday-Thursday, daysToAdd remains 1 (tomorrow)
  
  return new Date(Date.now() + (daysToAdd * 86400000));
};

/**
 * Get day name for display
 */
export const getDayName = (date) => {
  return DAYS.LONG[date.getDay()];
};

/**
 * Get tomorrow's date in YYYY-MM-DD format
 */
export const getTomorrowDate = () => {
  const nextWorkingDay = getNextWorkingDay();
  return nextWorkingDay.toISOString().split("T")[0];
};

/**
 * Get next working day name
 */
export const getNextWorkingDayName = () => {
  const nextWorkingDay = getNextWorkingDay();
  return getDayName(nextWorkingDay);
};

/**
 * Get the target date for status submission (matches ActivityLog's "tomorrow" column logic)
 * This is the date that corresponds to the "tomorrow" column in the activity log table
 */
export const getStatusTargetDate = () => {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  // Skip weekends for tomorrow (same logic as ActivityLog)
  while (tomorrow.getDay() === 0 || tomorrow.getDay() === 6) {
    tomorrow.setDate(tomorrow.getDate() + 1);
  }
  
  return tomorrow.toISOString().split('T')[0];
};

/**
 * Get the display name for the status target date
 */
export const getStatusTargetDayName = () => {
  const today = new Date();
  const targetDate = new Date(today);
  targetDate.setDate(targetDate.getDate() + 1);
  
  // Skip weekends for tomorrow
  while (targetDate.getDay() === 0 || targetDate.getDay() === 6) {
    targetDate.setDate(targetDate.getDate() + 1);
  }
  
  return getDayName(targetDate);
};

/**
 * Calculate optimal window height based on content
 */
export const calculateOptimalHeight = (statuses, tomorrowDate) => {
  const tomorrowStatuses = Object.entries(statuses).filter(([_, v]) => v.date === tomorrowDate);
  const statusCount = tomorrowStatuses.length;
  
  // Base height for header, buttons, and other content
  const baseHeight = 520;
  
  // Height per status card (including wrapping)
  const cardHeight = 40; // Approximate height per card including margins
  const cardsPerRow = 4; // Approximate cards per row
  const rows = Math.ceil(statusCount / cardsPerRow);
  
  // Always calculate for maximum possible content to prevent resizing
  const maxRows = 3; // Fixed to prevent window resizing
  const visibleRows = Math.min(rows, maxRows);
  
  const statusSectionHeight = visibleRows * cardHeight + 80; // Extra space for titles
  
  // Calculate for maximum notification space to avoid resizing
  // Assume maximum 3 notifications when open + 100px for controls
  const maxNotificationHeight = 3 * 120 + 150; // Space for header + controls
  
  const totalHeight = baseHeight + statusSectionHeight + maxNotificationHeight;
  
  // Increased maximum height for better activity log viewing - min 750px, max 900px
  // This provides more vertical space for the activity log when opened
  return Math.min(Math.max(totalHeight, 750), 900);
};
