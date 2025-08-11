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
  
  let daysToAdd = 1; // Default: tomorrow
  
  // If it's Friday (5), add 3 days to get to Monday
  // If it's Saturday (6), add 2 days to get to Monday  
  // If it's Sunday (0), add 1 day to get to Monday
  if (dayOfWeek === 5) { // Friday
    daysToAdd = 3;
  } else if (dayOfWeek === 6) { // Saturday
    daysToAdd = 2;
  } else if (dayOfWeek === 0) { // Sunday
    daysToAdd = 1;
  }
  
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
  
  // Fixed height approach - min 700px, max 800px for consistent behavior
  return Math.min(Math.max(totalHeight, 700), 800);
};
