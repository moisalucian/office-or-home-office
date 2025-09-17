import { database } from "./firebase";
import { ref, set, get, remove } from "firebase/database";
import { waitForAuth } from "./auth";

// Helper function to get current date in YYYY-MM-DD format
const getCurrentDateKey = () => {
  return new Date().toISOString().split('T')[0];
};

// Helper function to get working days (Monday-Friday) going back from today
const getWorkingDays = (count = 5) => {
  const days = [];
  const today = new Date();
  let current = new Date(today);
  
  while (days.length < count) {
    // Only add weekdays (Monday = 1, Friday = 5)
    if (current.getDay() >= 1 && current.getDay() <= 5) {
      days.push(current.toISOString().split('T')[0]);
    }
    current.setDate(current.getDate() - 1);
  }
  
  return days.reverse(); // Most recent last
};

// Helper function to get last N calendar days (including weekends)
const getLastNDays = (count = 7) => {
  const days = [];
  const today = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }
  return days.reverse(); // Most recent last
};

// Helper function to format status for display
const formatStatusMessage = (user, status, targetDate) => {
  const targetDay = new Date(targetDate).toLocaleDateString('en-US', { weekday: 'long' });
  
  switch (status) {
    case 'yes':
      return `${user} confirmed working from the office ${targetDay}.`;
    case 'no':
      return `${user} confirmed working from the home office ${targetDay}.`;
    case 'undecided':
      return `${user} marked that's not sure yet if will come to work ${targetDay}.`;
    default:
      return `${user} updated status for ${targetDay}.`;
  }
};

// Log a status change to the activity log
export const logStatusChange = async (user, status, targetDate) => {
    console.log(`[ActivityLogger] Called logStatusChange: ${user}, ${status}, ${targetDate}`);
    
    try {
      // Ensure user is authenticated before database operations
      await waitForAuth();
      
      const today = getCurrentDateKey();
      const logRef = ref(database, `activityLogs/${today}`);    // Get existing entries for today
    const snapshot = await get(logRef);
    const existingData = snapshot.val() || { entries: [] };
    
    // Only prevent if the EXACT SAME status was just recorded (last entry)
    // This allows different status changes but prevents accidental double-clicks
    if (existingData.entries.length > 0) {
      const lastEntry = existingData.entries[existingData.entries.length - 1];
      const isDuplicateOfLast = lastEntry.user === user && 
                                lastEntry.status === status && 
                                lastEntry.targetDate === targetDate;
      
      if (isDuplicateOfLast) {
        console.log(`[ActivityLogger] Duplicate prevented: ${user} -> ${status} (same as last entry)`);
        return; // Don't log if identical to last entry
      }
    }
    
    // Add new entry
    const newEntry = {
      time: new Date().toTimeString().slice(0, 5), // HH:MM format
      user,
      status,
      targetDate,
      timestamp: new Date().toISOString()
    };
    
    console.log(`[ActivityLogger] Adding new entry:`, newEntry);
    existingData.entries.push(newEntry);
    existingData.lastUpdated = new Date().toISOString();
    
    // Save updated log
    await set(logRef, existingData);
    
    // Cleanup old logs (keep only 5 working days)
    await cleanupOldLogs();
    
  } catch (error) {
    console.error("Error logging activity:", error);
  }
};

// Helper function to get last N working days (Monday-Friday)
const getLastWorkingDays = (count = 7) => {
  const days = [];
  const today = new Date();
  let current = new Date(today);
  while (days.length < count) {
    if (current.getDay() >= 1 && current.getDay() <= 5) {
      days.push(current.toISOString().split('T')[0]);
    }
    current.setDate(current.getDate() - 1);
  }
  return days.reverse(); // Most recent last
};

// Clean up logs older than last 7 working days
const cleanupOldLogs = async () => {
  try {
    const keepDays = getLastWorkingDays(7);
    const allLogsRef = ref(database, 'activityLogs');
    const snapshot = await get(allLogsRef);
    if (snapshot.val()) {
      const allLogs = snapshot.val();
      for (const dateKey in allLogs) {
        if (!keepDays.includes(dateKey)) {
          const deleteRef = ref(database, `activityLogs/${dateKey}`);
          await remove(deleteRef);
          console.log(`Cleaned up old activity log: ${dateKey}`);
        }
      }
    }
  } catch (error) {
    console.error("Error cleaning up old logs:", error);
  }
};

// Get all activity logs for display
export const getActivityLogs = async () => {
  try {
    // Ensure user is authenticated before database operations
    await waitForAuth();
    
    const logsRef = ref(database, 'activityLogs');
    const snapshot = await get(logsRef);
    
    if (!snapshot.val()) {
      return [];
    }
    
    const logs = snapshot.val();
    const formattedLogs = [];
    
    // Sort by date (most recent first)
    const sortedDates = Object.keys(logs).sort().reverse();
    
    sortedDates.forEach(dateKey => {
      const dayLog = logs[dateKey];
      const dayName = new Date(dateKey).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long', 
        day: 'numeric'
      });
      
      formattedLogs.push({
        date: dateKey,
        dayName,
        entries: dayLog.entries
          .map(entry => ({
            ...entry,
            message: formatStatusMessage(entry.user, entry.status, entry.targetDate),
            colorClass: getStatusColorClass(entry.status)
          }))
          .reverse() // Latest entries first within each day
      });
    });
    
    return formattedLogs;
    
  } catch (error) {
    console.error("Error fetching activity logs:", error);
    return [];
  }
};

// Get color for status (keeping for backward compatibility)
const getStatusColor = (status) => {
  switch (status) {
    case 'yes': return '#4caf50'; // Brighter Green
    case 'no': return '#f44336';  // Brighter Red  
    case 'undecided': return '#ff9800'; // Brighter Orange
    default: return '#999';
  }
};

// Get CSS class for status colors
const getStatusColorClass = (status) => {
  switch (status) {
    case 'yes': return 'status-yes';
    case 'no': return 'status-no';
    case 'undecided': return 'status-undecided';
    default: return 'status-default';
  }
};
