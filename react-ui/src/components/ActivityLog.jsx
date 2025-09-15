import { useState, useEffect } from 'react';
import './ActivityLog.css';

const ActivityLog = ({ 
  activityLogs = [], 
  statuses = {}, 
  isWindowMode = false,
  onResetLayout 
}) => {
  const [splitPosition, setSplitPosition] = useState(() => {
    const saved = localStorage.getItem('activityLogSplitPosition');
    return saved ? parseFloat(saved) : 50; // Default to 50% (middle)
  });

  // Listen for external reset events
  useEffect(() => {
    const handleReset = () => {
      setSplitPosition(50);
    };
    
    window.addEventListener('resetActivityLogLayout', handleReset);
    return () => window.removeEventListener('resetActivityLogLayout', handleReset);
  }, []);

  // Helper functions for status processing
  const getStatusIcon = (status) => {
    switch (status) {
      case 'yes': return '🏢'; // Office building
      case 'no': return '🏠'; // House
      case 'undecided': return '❓'; // Question mark
      default: return '−';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'yes': return 'Office';
      case 'no': return 'Home';
      case 'undecided': return 'Undecided';
      default: return 'No status';
    }
  };

  // Generate 7-day data structure (tomorrow, today, 5 days back)
  const generateDailyData = () => {
    const workingDays = [];
    const today = new Date();
    const todayIsWeekend = today.getDay() === 0 || today.getDay() === 6;
    
    // Add tomorrow (first column) - next working day
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Skip weekends for tomorrow
    while (tomorrow.getDay() === 0 || tomorrow.getDay() === 6) {
      tomorrow.setDate(tomorrow.getDate() + 1);
    }
    
    workingDays.push({
      dateKey: tomorrow.toISOString().split('T')[0],
      dayName: tomorrow.toLocaleDateString('en-US', { weekday: 'short' }),
      fullDate: tomorrow.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      isTomorrow: true,
      isToday: false
    });
    
    // Add today (second column, highlighted) - only if it's a working day
    if (!todayIsWeekend) {
      workingDays.push({
        dateKey: today.toISOString().split('T')[0],
        dayName: today.toLocaleDateString('en-US', { weekday: 'short' }),
        fullDate: today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        isTomorrow: false,
        isToday: true
      });
    }
    
    // Add previous working days to fill remaining slots (these are historical)
    let current = new Date(today);
    current.setDate(current.getDate() - 1);
    
    while (workingDays.length < 7) {
      if (current.getDay() >= 1 && current.getDay() <= 5) {
        workingDays.push({
          dateKey: current.toISOString().split('T')[0],
          dayName: current.toLocaleDateString('en-US', { weekday: 'short' }),
          fullDate: current.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          isTomorrow: false,
          isToday: false,
          isHistorical: true // Mark as historical so status doesn't move
        });
      }
      current.setDate(current.getDate() - 1);
    }
    
    return workingDays;
  };

  // Process data for the overview table
  const generateStatusMatrix = () => {
    const days = generateDailyData();
    const allUsers = new Set();
    
    // Collect all users from statuses and activity logs
    Object.keys(statuses).forEach(user => allUsers.add(user));
    activityLogs.forEach(dayLog => {
      dayLog.entries.forEach(entry => allUsers.add(entry.user));
    });
    
    // Build status matrix
    const statusMatrix = {};
    Array.from(allUsers).forEach(user => {
      statusMatrix[user] = {};
    });
    
    // Fill from activity logs
    activityLogs.forEach(dayLog => {
      const userEntries = {};
      dayLog.entries.forEach(entry => {
        if (!userEntries[entry.user]) userEntries[entry.user] = [];
        userEntries[entry.user].push(entry);
      });
      
      Object.keys(userEntries).forEach(user => {
        const latestEntry = userEntries[user][userEntries[user].length - 1];
        statusMatrix[user][dayLog.date] = {
          status: latestEntry.status,
          time: latestEntry.time,
          targetDate: latestEntry.targetDate
        };
      });
    });
    
    // Add current live statuses (match by target date, not current date)
    Object.entries(statuses).forEach(([user, userData]) => {
      // Show live status for the date it targets, regardless of current date
      statusMatrix[user][userData.date] = {
        status: userData.status,
        time: new Date().toTimeString().slice(0, 5),
        targetDate: userData.date,
        isLive: true
      };
    });
    
    // Filter users with actual data in the 7 days
    const daysKeys = days.map(d => d.dateKey);
    const usersWithData = Array.from(allUsers).filter(user => {
      return daysKeys.some(dateKey => {
        const userStatus = statusMatrix[user][dateKey];
        return userStatus && userStatus.status;
      });
    });
    
    return { days, statusMatrix, users: usersWithData.sort() };
  };

  const resetLayout = () => {
    // Reset horizontal divider
    setSplitPosition(50);
    localStorage.setItem('activityLogSplitPosition', '50');
    
    // Reset vertical divider if function is provided
    if (onResetLayout) {
      onResetLayout();
    }
  };

  const { days, statusMatrix, users } = generateStatusMatrix();

  return (
    <div className={`activity-log ${isWindowMode ? 'window-mode' : 'maximized-mode'}`}>
      {/* Header with centered title and top-right reset button */}
      <div className="activity-log-header">
        <h3><span className="selectable">Activity Log</span></h3>
      </div>

      {/* Split container */}
      <div className="activity-log-split-container">
        {/* Top Section - Daily Overview */}
        <div 
          className="activity-overview-section"
          style={{ height: `${splitPosition}%` }}
        >
          <h4><span className="selectable">Last Status - Daily Overview</span></h4>
          <div className="activity-overview-content">
            {users.length === 0 ? (
              <div className="no-data-message">No users have set status yet.</div>
            ) : (
              <div className="overview-table-container">
                {/* Fixed header */}
                <div className="overview-table-header">
                  <div className="overview-header-cell user-header selectable">User</div>
                  {days.map(day => (
                    <div 
                      key={day.dateKey} 
                      className={`overview-header-cell day-header selectable ${day.isToday ? 'today' : ''}`}
                    >
                      <div className="day-name">{day.dayName}</div>
                      <div className="day-date">{day.fullDate}</div>
                    </div>
                  ))}
                </div>
                
                {/* Scrollable content */}
                <div className="overview-table-body">
                  {users.map(user => (
                    <div key={user} className="overview-table-row">
                      <div className="overview-cell user-cell selectable">{user}</div>
                      {days.map(day => {
                        const userStatus = statusMatrix[user][day.dateKey];
                        return (
                          <div 
                            key={day.dateKey}
                            className={`overview-cell status-cell selectable ${userStatus ? `status-${userStatus.status}` : 'status-empty'}`}
                            title={userStatus ? `${userStatus.time} - ${getStatusText(userStatus.status)}` : 'No status set'}
                          >
                            {userStatus ? getStatusIcon(userStatus.status) : '−'}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Horizontal Divider */}
        <div 
          className="activity-horizontal-divider"
          onMouseDown={(e) => {
            e.preventDefault(); // Prevent text selection
            const startY = e.clientY;
            const startSplit = splitPosition;
            
            // Disable text selection during drag
            document.body.style.userSelect = 'none';
            document.body.style.webkitUserSelect = 'none';
            document.body.style.msUserSelect = 'none';
            
            const handleMouseMove = (e) => {
              e.preventDefault();
              const container = e.target.closest('.activity-log-split-container');
              if (!container) return;
              
              const containerRect = container.getBoundingClientRect();
              const deltaY = e.clientY - startY;
              const deltaPercent = (deltaY / containerRect.height) * 100;
              
              // Constrain between 20% and 80%
              const newSplit = Math.max(20, Math.min(80, startSplit + deltaPercent));
              setSplitPosition(newSplit);
              localStorage.setItem('activityLogSplitPosition', newSplit.toString());
            };
            
            const handleMouseUp = () => {
              // Re-enable text selection
              document.body.style.userSelect = '';
              document.body.style.webkitUserSelect = '';
              document.body.style.msUserSelect = '';
              
              document.removeEventListener('mousemove', handleMouseMove);
              document.removeEventListener('mouseup', handleMouseUp);
            };
            
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
          }}
        />

        {/* Bottom Section - Activity History */}
        <div 
          className="activity-history-section"
          style={{ height: `${100 - splitPosition}%` }}
        >
          <h4><span className="selectable">Past 7 Days Activity History</span></h4>
          <div className="activity-history-content">
            {activityLogs.length === 0 ? (
              <div className="no-data-message">No activity recorded yet. Status changes will appear here.</div>
            ) : (
              <div className="activity-history-scrollable scroll-no-drag">
                {activityLogs.map((dayLog, _dayIndex) => (
                  <div key={dayLog.date} className="activity-day">
                    <h5 className="activity-day-header selectable">{dayLog.dayName}</h5>
                    {dayLog.entries.map((entry, entryIndex) => (
                      <div key={entryIndex} className="activity-entry">
                        <span className="activity-time selectable">{entry.time}</span>
                        <span className={`activity-message selectable ${entry.colorClass}`}>
                          {entry.message}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActivityLog;
