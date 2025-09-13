import { useEffect, useState, useCallback, useRef } from "react";
import { database, initializeFirebase, isFirebaseInitialized, saveFirebaseConfig, getFirebaseConfig } from "./firebase";
import { ref, set, onValue, remove, get } from "firebase/database";
import "./styles/theme.css";
import "./styles/layout.css";
import "./styles.css";
import "./components/Settings.css";
import UpdateNotification from "./UpdateNotification";
import PostUpdateNotification from "./PostUpdateNotification";
import FirebaseConfig from "./components/FirebaseConfig";
import ErrorBoundary from "./components/ErrorBoundary";
import { 
  checkForUpdates, 
  shouldCheckForUpdates, 
  dismissUpdate, 
  postponeUpdate,
  shouldShowUpdateNotification,
  downloadAndInstallUpdate,
  manualUpdateCheck as performManualUpdateCheck,
  setCurrentVersion
} from "./versionCheck";
import { logStatusChange, getActivityLogs } from "./activityLogger";
import { initializeAuth, waitForAuth } from "./auth";

// Components
import WindowControls from "./components/WindowControls";
import StatusGrid from "./components/StatusGrid";
// import Settings from "./components/Settings";

// Hooks
import { useTheme } from "./hooks/useTheme";
import { useThemeIcon } from "./hooks/useThemeIcon";
import { useWindowState } from "./hooks/useWindowState";
import { useNotificationSound } from "./hooks/useNotificationSound";

// Utils
import { 
  getHumanReadableTimestamp, 
  getTomorrowDate, 
  getNextWorkingDayName,
  calculateOptimalHeight 
} from "./utils/dateUtils";
import { 
  saveNotificationSettings, 
  loadNotificationSettings, 
  updateNotificationSettingsName,
  loadSetting 
} from "./utils/storageUtils";
import { STATUS_TYPES, CACHE_DURATION, UPDATE_CHECK_INTERVAL } from "./utils/constants";

function App() {
  const [name, setName] = useState("");
  const [oldName, setOldName] = useState(null);
  const [statuses, setStatuses] = useState({});
  const [isNameSaved, setIsNameSaved] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [statusColor, setStatusColor] = useState('');
  const statusMessageTimeoutRef = useRef(null);
  const overviewScrollRef = useRef(null);
  const historyScrollRef = useRef(null);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationSummary, setNotificationSummary] = useState('');
  const [updateInfo, setUpdateInfo] = useState(null);
  const [showUpdateNotification, setShowUpdateNotification] = useState(false);
  const [postUpdateState, setPostUpdateState] = useState(null);
  const [showPostUpdateNotification, setShowPostUpdateNotification] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false); // Always start with sidebar closed
  const [userManuallyResized, setUserManuallyResized] = useState(false);

  // Helper function to set status message with automatic timeout (using useRef for stability)
  const setStatusMessageWithTimeout = useCallback((message, color, timeout = 5000) => {
    // Clear any existing timeout
    if (statusMessageTimeoutRef.current) {
      clearTimeout(statusMessageTimeoutRef.current);
      statusMessageTimeoutRef.current = null;
    }
    
    setStatusMessage(message);
    setStatusColor(color);
    
    // Set new timeout to clear the message
    statusMessageTimeoutRef.current = setTimeout(() => {
      setStatusMessage('');
      setStatusColor('');
      statusMessageTimeoutRef.current = null;
    }, timeout);
  }, []);

  // Listen for download progress events from Electron
  useEffect(() => {
    if (window.electronAPI?.onUpdateDownloadProgress) {
      window.electronAPI.onUpdateDownloadProgress((progress) => {
        setUpdateProgress((prev) => ({
          ...prev,
          phase: 'downloading',
          percent: progress.percent,
          message: `Downloaded ${progress.downloaded}MB of ${progress.total}MB`
        }));
      });
    }
    if (window.electronAPI?.onUpdateInstallProgress) {
      window.electronAPI.onUpdateInstallProgress((progress) => {
        setUpdateProgress((prev) => ({
          ...prev,
          phase: progress.phase || 'installing',
          percent: progress.percent,
          message: progress.message
        }));
      });
    }
  }, []);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('sidebarWidth');
    return saved ? parseInt(saved) : 650; // Increased default to ensure all 7 columns are clearly visible
  });
  const [splitPosition, setSplitPosition] = useState(() => {
    const saved = localStorage.getItem('activityLogSplitPosition');
    return saved ? parseFloat(saved) : 50; // Default to 50% (half)
  });
  const [activityLogs, setActivityLogs] = useState([]);
  const [activityLogsCache, setActivityLogsCache] = useState(null);
  const [lastCacheTime, setLastCacheTime] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [manualUpdateCheck, setManualUpdateCheck] = useState({
    isChecking: false,
    lastChecked: null,
    result: null
  });
  const [appVersion, setAppVersion] = useState('1.0.0');
  const [updateProgress, setUpdateProgress] = useState({
    phase: null, // 'downloading', 'installing', 'ready'
    percent: 0,
    message: ''
  });
  
  // Firebase configuration state
  const [showFirebaseConfig, setShowFirebaseConfig] = useState(false);
  const [firebaseConfigured, setFirebaseConfigured] = useState(false);
  const [firebaseError, setFirebaseError] = useState(null);
  const [firebaseLoading, setFirebaseLoading] = useState(true);
  const [currentFirebaseConfig, setCurrentFirebaseConfig] = useState({});
  
  // Use custom hooks
  const { theme, themeSetting, handleThemeChange } = useTheme();
  const iconPath = useThemeIcon(theme, themeSetting);
  const { notificationSound, handleNotificationSoundChange, previewNotificationSound } = useNotificationSound();
  const { 
    isMaximized, 
    launchAtStartup,
    launchInTray,
    defaultLaunchOption,
    handleStartupToggle,
    handleLaunchInTrayToggle,
    handleDefaultLaunchOptionChange
  } = useWindowState();

  // Track manual window resizing and reset when maximized state changes
  useEffect(() => {
    // Reset manual resize flag when toggling maximize/windowed mode
    setUserManuallyResized(false);
  }, [isMaximized]);

  // Detect manual window resizing
  useEffect(() => {
    if (!window.electronAPI?.onWindowResize) return;

    const handleResize = () => {
      // Only mark as manually resized if not maximized
      if (!isMaximized) {
        setUserManuallyResized(true);
      }
    };

    window.electronAPI.onWindowResize(handleResize);
    
    return () => {
      if (window.electronAPI?.removeWindowResizeListener) {
        window.electronAPI.removeWindowResizeListener(handleResize);
      }
    };
  }, [isMaximized]);

  // Calculate dates (moved to avoid duplication)
  const tomorrow = getTomorrowDate();
  const nextWorkDay = getNextWorkingDayName();
  
  // Load activity logs when needed with caching
  const loadActivityLogs = useCallback(async () => {
    const now = Date.now();
    
    // Use cache if it's fresh
    if (activityLogsCache && (now - lastCacheTime) < CACHE_DURATION) {
      setActivityLogs(activityLogsCache);
      return;
    }
    
    const logs = await getActivityLogs();
    setActivityLogs(logs);
    setActivityLogsCache(logs);
    setLastCacheTime(now);
  }, [activityLogsCache, lastCacheTime]);

  // Initialize app version
  useEffect(() => {
    const getVersion = async () => {
      try {
        if (window.electronAPI?.getAppVersion) {
          const version = await window.electronAPI.getAppVersion();
          setAppVersion(version || '1.0.0');
        }
      } catch (error) {
        console.error('Error getting app version:', error);
        setAppVersion('1.0.0');
      }
    };
    getVersion();
  }, []);

  // Restore "Launch in tray" setting after app update (runs once on startup)
  useEffect(() => {
    const restoreLaunchInTrayAfterUpdate = () => {
      const shouldRestore = localStorage.getItem('restoreLaunchInTray');
      if (shouldRestore === 'true') {
        console.log('[App] Restoring "Launch in tray" setting after update');
        // Clear the flag first
        localStorage.removeItem('restoreLaunchInTray');
        // Restore the setting with a small delay to ensure the app is fully initialized
        setTimeout(() => {
          handleLaunchInTrayToggle({ target: { checked: true } });
        }, 1000);
      }
    };
    restoreLaunchInTrayAfterUpdate();
  }, [handleLaunchInTrayToggle]);

  // Update body class based on maximized state
  useEffect(() => {
    const applyWindowStyling = () => {
      const container = document.querySelector('.container');
      const html = document.documentElement;
      const body = document.body;
      
      if (isMaximized) {
        body.classList.add('maximized');
        body.style.borderRadius = '0px';
        html.style.borderRadius = '0px';
        
        if (container) {
          container.classList.add('maximized');
          container.style.borderRadius = '0px !important';
        }
      } else {
        body.classList.remove('maximized');
        body.style.borderRadius = '16px';
        html.style.borderRadius = '16px';
        
        if (container) {
          container.classList.remove('maximized');
          
          // Force immediate style refresh
          container.style.borderRadius = '';
          container.style.display = 'none';
          container.offsetHeight; // Force reflow
          container.style.display = 'flex';
          
          // Apply border radius with multiple fallbacks
          requestAnimationFrame(() => {
            if (container) {
              container.style.borderRadius = '16px !important';
              
              // Additional timing to ensure it sticks
              setTimeout(() => {
                if (container && !isMaximized) {
                  container.style.borderRadius = '16px !important';
                  // Force hardware acceleration to fix rendering issues
                  container.style.transform = 'translateZ(0)';
                  setTimeout(() => {
                    if (container) {
                      container.style.transform = '';
                    }
                  }, 100);
                }
              }, 50);
            }
          });
        }
      }
    };

    // Apply styling with multiple timing strategies
    applyWindowStyling();
    const timeouts = [10, 50, 100, 200, 500].map(delay => 
      setTimeout(applyWindowStyling, delay)
    );
    
    return () => {
      timeouts.forEach(clearTimeout);
    };
  }, [isMaximized]);

  // Initialize Firebase configuration
  useEffect(() => {
    const initFirebase = async () => {
      try {
        setFirebaseLoading(true);
        
        // Check if Firebase is already initialized (from env variables)
        if (isFirebaseInitialized()) {
          setFirebaseConfigured(true);
          setFirebaseLoading(false);
          console.log('Firebase already initialized');
          return;
        }

        // Try to initialize from stored config
        await initializeFirebase();
        setFirebaseConfigured(true);
        setFirebaseLoading(false);
        console.log('Firebase initialized from stored config');
      } catch (error) {
        console.error('Firebase initialization failed:', error);
        if (error.message === 'FIREBASE_CONFIG_MISSING') {
          setFirebaseError('Firebase configuration required');
          setShowFirebaseConfig(true);
        } else {
          setFirebaseError(error.message);
        }
        setFirebaseConfigured(false);
        setFirebaseLoading(false);
      }
    };

    initFirebase();
  }, []);

  // Load activity logs when sidebar opens or app starts
  useEffect(() => {
    if (sidebarOpen) {
      // Always load fresh data when sidebar opens to avoid empty state
      const loadFreshLogs = async () => {
        try {
          const logs = await getActivityLogs();
          setActivityLogs(logs);
          setActivityLogsCache(logs);
          setLastCacheTime(Date.now());
        } catch (error) {
          console.error('Error loading activity logs:', error);
        }
      };
      loadFreshLogs();
    }
  }, [sidebarOpen]);
  
  // Preload activity logs on app start for faster access
  useEffect(() => {
    const preloadLogs = async () => {
      try {
        await loadActivityLogs();
      } catch (error) {
        console.error('Error preloading activity logs:', error);
      }
    };
    preloadLogs();
  }, [loadActivityLogs]);

  // Refresh logs when switching between maximized/windowed modes
  useEffect(() => {
    if (sidebarOpen) {
      // Small delay to ensure window state has settled
      const refreshTimer = setTimeout(() => {
        loadActivityLogs();
      }, 100);
      
      return () => clearTimeout(refreshTimer);
    }
  }, [isMaximized, sidebarOpen, loadActivityLogs]);

  // Check if this is the sidebar window
  const isSidebarWindow = window.location.hash === '#sidebar';
  
  // Reset function for activity log state
  const resetActivityLogState = () => {
    // Reset sidebar width to new increased default to ensure all 7 columns are visible
    setSidebarWidth(650);
    localStorage.setItem('sidebarWidth', '650');
    
    // Reset split position
    setSplitPosition(50);
    localStorage.setItem('activityLogSplitPosition', '50');
  };
  
  // Shared activity log content component
  const ActivityLogContent = () => {
    // Process activity logs into status cards (latest status per person per day)
    const generateStatusCards = () => {
      const cards = [];
      const workingDays = [];
      const today = new Date();
      
      // First, add the NEXT working day (for live tracking of tomorrow's statuses)
      const getNextWorkingDay = () => {
        const next = new Date(today);
        next.setDate(next.getDate() + 1);
        
        // Skip weekends
        while (next.getDay() === 0 || next.getDay() === 6) {
          next.setDate(next.getDate() + 1);
        }
        return next;
      };
      
      const nextWorkingDay = getNextWorkingDay();
      
      // Only add next working day if today is a working day
      // This prevents weekend issues
      if (today.getDay() >= 1 && today.getDay() <= 5) {
        workingDays.push({
          dateKey: nextWorkingDay.toISOString().split('T')[0],
          dayName: nextWorkingDay.toLocaleDateString('en-US', { weekday: 'short' }),
          fullDate: nextWorkingDay.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          isNextDay: true,
          isToday: false
        });
      }
      
      // Then add today (highlighted) only if it's a working day
      if (today.getDay() >= 1 && today.getDay() <= 5) {
        workingDays.push({
          dateKey: today.toISOString().split('T')[0],
          dayName: today.toLocaleDateString('en-US', { weekday: 'short' }),
          fullDate: today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          isNextDay: false,
          isToday: true
        });
      }
      
      // Then add the previous working days to fill up to 7 total
      let current = new Date(today);
      current.setDate(current.getDate() - 1); // Start from yesterday
      
      while (workingDays.length < 7) {
        // Only add weekdays (Monday = 1, Friday = 5)
        if (current.getDay() >= 1 && current.getDay() <= 5) {
          workingDays.push({
            dateKey: current.toISOString().split('T')[0],
            dayName: current.toLocaleDateString('en-US', { weekday: 'short' }),
            fullDate: current.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            isNextDay: false,
            isToday: false
          });
        }
        current.setDate(current.getDate() - 1);
      }
      
      // Get unique users from both current statuses and activity logs
      const allUsers = new Set();
      
      // Add users from current statuses
      Object.keys(statuses).forEach(user => {
        allUsers.add(user);
      });
      
      // Add users from activity logs
      activityLogs.forEach(dayLog => {
        dayLog.entries.forEach(entry => {
          allUsers.add(entry.user);
        });
      });
      
      // Create status matrix: user -> date -> latest status
      const statusMatrix = {};
      Array.from(allUsers).forEach(user => {
        statusMatrix[user] = {};
      });
      
      // Fill status matrix with latest status per user per day from activity logs
      activityLogs.forEach(dayLog => {
        // Group entries by user for this day
        const userEntries = {};
        dayLog.entries.forEach(entry => {
          if (!userEntries[entry.user]) {
            userEntries[entry.user] = [];
          }
          userEntries[entry.user].push(entry);
        });
        
        // Get latest entry per user for this day
        Object.keys(userEntries).forEach(user => {
          const latestEntry = userEntries[user][userEntries[user].length - 1];
          statusMatrix[user][dayLog.date] = {
            status: latestEntry.status,
            time: latestEntry.time,
            targetDate: latestEntry.targetDate
          };
        });
      });
      
      // Add current live statuses to their TARGET DATE columns (not source date)
      Object.entries(statuses).forEach(([user, userData]) => {
        // Show status in the column for the date it's intended for
        statusMatrix[user][userData.date] = {
          status: userData.status,
          time: new Date().toTimeString().slice(0, 5),
          targetDate: userData.date,
          isLive: true // Mark as live data
        };
      });
      
      // Filter users to only show those who have at least one status in the displayed days
      const workingDaysKeys = workingDays.map(day => day.dateKey);
      const usersWithStatus = Array.from(allUsers).filter(user => {
        // Check if user has any actual status (not just empty entries) in the displayed days
        return workingDaysKeys.some(dateKey => {
          const userStatus = statusMatrix[user][dateKey];
          return userStatus && userStatus.status; // Must have actual status data
        });
      });
      
      return { last7Days: workingDays, statusMatrix, users: usersWithStatus.sort() };
    };
    
    const { last7Days, statusMatrix, users } = generateStatusCards();
    
    return (
      <>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, flex: 1, textAlign: 'center' }}>Activity Log</h3>
          <button 
            onClick={resetActivityLogState}
            style={{
              background: 'var(--control-button-bg)',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              color: 'var(--control-button-text)',
              fontSize: '0.8rem',
              padding: '0.3rem 0.6rem',
              cursor: 'pointer',
              position: 'absolute',
              right: '1rem',
              top: '0.5rem'
            }}
            title="Reset sidebar width and split position to defaults"
          >
            Reset Layout
          </button>
        </div>
        
        <div className="activity-log-split-container">
          {/* Status Cards Section */}
          <div 
            className="activity-overview-section"
            style={{ height: `${splitPosition}%` }}
          >
            <h4>Last Status - Daily Overview</h4>
            <div className="activity-overview-container">
              {users.length === 0 ? (
                <p className="no-data-message">No users have set status yet.</p>
              ) : (
                <div 
                  className={`activity-overview-wrapper ${needsHorizontalScroll ? 'needs-horizontal-scroll' : ''}`}
                  style={{
                    '--dynamic-user-width': `${userWidth}px`,
                    '--dynamic-day-width': `${dayWidth}px`
                  }}
                >
                  <div className="activity-overview-table">
                    {/* Fixed header outside scrollable area */}
                    <div className="activity-overview-header">
                      <div className="overview-user-header">User</div>
                      {last7Days.map(day => (
                        <div key={day.dateKey} className={`overview-day-header ${day.isToday ? 'today' : ''}`}>
                          <div className="overview-day-name">{day.dayName}</div>
                          <div className="overview-day-date">{day.fullDate}</div>
                        </div>
                      ))}
                    </div>
                    {/* Scrollable content area with just the rows */}
                    <div 
                      className="activity-overview-scrollable-container"
                      ref={overviewScrollRef}
                    >
                      <div className="activity-overview-scrollable">
                        {users.map(user => (
                          <div key={user} className="overview-user-row">
                            <div className="overview-user-name">{user}</div>
                            {last7Days.map(day => {
                              const userStatus = statusMatrix[user][day.dateKey];
                              const isToday = day.isToday;
                              // Removed live indicator for now to avoid confusion
                              const showLiveIndicator = false;
                              return (
                                <div 
                                  key={day.dateKey} 
                                  className={`overview-status-cell ${userStatus ? `overview-status-${userStatus.status}` : 'overview-status-empty'} ${showLiveIndicator ? 'live-status' : ''}`}
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
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Draggable Divider */}
          <div 
            className="activity-log-divider"
            onMouseDown={(e) => {
              const startY = e.clientY;
              const startSplit = splitPosition;
              
              // Add dragging class to prevent text selection
              const divider = e.target;
              const splitContainer = e.target.closest('.activity-log-split-container');
              
              if (splitContainer) {
                splitContainer.classList.add('dragging');
              }
              
              const handleMouseMove = (e) => {
                const container = e.target.closest('.activity-log-split-container') || splitContainer;
                if (!container) return;
                
                const containerRect = container.getBoundingClientRect();
                const deltaY = e.clientY - startY;
                const deltaPercent = (deltaY / containerRect.height) * 100;
                
                // Use dynamic constraints based on container height (same logic as main app)
                const containerHeight = containerRect.height;
                const minSectionHeight = 100; // Minimum height in pixels for each section
                const minPercent = (minSectionHeight / containerHeight) * 100;
                const maxPercent = 100 - minPercent; // Ensure both sections have minimum height
                
                // Apply constraints with more generous bounds
                const newSplit = Math.max(minPercent, Math.min(maxPercent, startSplit + deltaPercent));
                
                setSplitPosition(newSplit);
                localStorage.setItem('activityLogSplitPosition', newSplit.toString());
              };
              
              const handleMouseUp = () => {
                // Remove dragging class
                if (splitContainer) {
                  splitContainer.classList.remove('dragging');
                }
                
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
              };
              
              document.addEventListener('mousemove', handleMouseMove);
              document.addEventListener('mouseup', handleMouseUp);
            }}
          />
          
          {/* Activity History Section */}
          <div 
            className="activity-history-section"
            style={{ height: `${100 - splitPosition}%` }}
          >
            <h4>Past 7 Days Activity History</h4>
            <div 
              className="activity-history-container"
              ref={historyScrollRef}
            >
              {activityLogs.length === 0 ? (
                <p style={{ color: '#888', textAlign: 'center', marginTop: '1rem' }}>
                  No activity recorded yet.<br/>
                  Status changes will appear here.
                </p>
              ) : (
                activityLogs.map((dayLog, dayIndex) => (
                  <div key={dayLog.date} className="activity-day">
                    <h4 className="activity-day-header">{dayLog.dayName}</h4>
                    {dayLog.entries.map((entry, entryIndex) => (
                      <div key={entryIndex} className="activity-entry">
                        <span className="activity-time">{entry.time}</span>
                        <span 
                          className={`activity-message ${entry.colorClass}`}
                        >
                          {entry.message}
                        </span>
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </>
    );
  };
  
  // Helper functions for status cards
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
  
  // Use ref to always get current name value in popup handler
  const nameRef = useRef(name);
  useEffect(() => {
    nameRef.current = name;
  }, [name]);

  // Calculate optimal window height based on content
  const calculateOptimalHeightCallback = useCallback(() => {
    return calculateOptimalHeight(statuses, tomorrow);
  }, [statuses, tomorrow]);

  useEffect(() => {
    // Only auto-resize if user hasn't manually resized and window is not maximized
    if (window.electronAPI?.resizeWindow && !isMaximized && !userManuallyResized) {
      const optimalHeight = calculateOptimalHeightCallback();
      console.log('Auto-resizing window to:', 940, optimalHeight);
      window.electronAPI.resizeWindow(940, optimalHeight);
    }
  }, [statuses, isMaximized, calculateOptimalHeightCallback, userManuallyResized]);

  useEffect(() => {
    const savedName = loadSetting("username");
    if (savedName) {
      setName(savedName);
      setOldName(savedName);
      setIsNameSaved(true);
      // Load notifications for the saved user
      const loaded = loadNotificationSettings(savedName);
      setNotifications(loaded);
    }
  }, []);

  // Initialize anonymous authentication on app startup
  useEffect(() => {
    const authenticateUser = async () => {
      try {
        await initializeAuth();
        console.log('Authentication initialized successfully');
      } catch (error) {
        console.error('Authentication failed:', error);
        // App will still work, but database operations might fail
      }
    };

    authenticateUser();
  }, []);

  useEffect(() => {
    // Only set up Firebase listener if Firebase is configured
    if (!firebaseConfigured || !database) {
      return;
    }

    const statusesRef = ref(database, "statuses");
    const unsubscribe = onValue(statusesRef, (snapshot) => {
      const data = snapshot.val() || {};
      setStatuses(data);
    });
    
    // Cleanup function to unsubscribe from Firebase listener
    return () => unsubscribe();
  }, [firebaseConfigured]);

  useEffect(() => {
    if (name) {
      const loaded = loadNotificationSettings(name);
      setNotifications(loaded);
    }
  }, [name]);

  useEffect(() => {
    if (name) {
      saveNotificationSettings(name, notifications);

      if (notifications.length > 0) {
        const descrieri = notifications.map((n) => {
          const zile = n.days.join(', ');
          return `🕘 ${n.time} on days: ${zile}`;
        }).join("\n");
        setNotificationSummary(`${name}, you have notifications set for:\n${descrieri}`);
      } else {
        setNotificationSummary('');
      }
    }
  }, [notifications, name]);

  useEffect(() => {
    let timeoutId;
    let intervalId;

    const checkNotifications = () => {
      const now = new Date();
      const currentDay = ["D", "L", "Ma", "Mi", "J", "V", "S"][now.getDay()];
      const currentTime = now.toTimeString().slice(0, 5);

      notifications.forEach((n) => {
        if (n.time === currentTime && n.days.includes(currentDay)) {
          if (window?.electronAPI?.sendNotificationPopup) {
            window.electronAPI.sendNotificationPopup();
          }
        }
      });
    };

    const scheduleNextCheck = () => {
      const now = new Date();
      // Calculate milliseconds until the next minute (when seconds = 0)
      const msUntilNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
      
      // Schedule the first check at the exact start of the next minute
      timeoutId = setTimeout(() => {
        checkNotifications();
        // After the first precise check, set up regular interval checks every minute
        intervalId = setInterval(checkNotifications, 60000);
      }, msUntilNextMinute);
    };

    // Start the precise scheduling
    scheduleNextCheck();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [notifications]);

  useEffect(() => {
    if (!window.electronAPI?.onPopupStatus) return;

    const handlePopup = async (status) => {
      const currentName = nameRef.current; // Get current name from ref
      
      if (!currentName || !currentName.trim()) {
        return; // Ensure name exists and is not empty
      }
      
      // Check if Firebase is configured
      if (!firebaseConfigured || !database) {
        console.error('Firebase not configured, cannot save status');
        return;
      }
      
      // Convert boolean values to string for backward compatibility
      let normalizedStatus = status;
      if (typeof status === 'boolean') {
        normalizedStatus = status ? 'yes' : 'no';
      }

      // Check if user already has the same status for the same target date
      const currentUserStatus = statuses[currentName];
      if (currentUserStatus && 
          currentUserStatus.status === normalizedStatus && 
          currentUserStatus.date === tomorrow) {
        // Same status for same day - ignore silently
        console.log(`Ignoring duplicate status from notification: ${currentName} already has status '${normalizedStatus}' for ${tomorrow}`);
        return;
      }
      
      // Use the current name for saving status
      const userRef = ref(database, `statuses/${currentName}`);
      
      try {
        await set(userRef, {
          date: tomorrow,
          status: normalizedStatus,
          updatedAt: getHumanReadableTimestamp()
        });

        // Update UI with status message (same as main app)
        const dayText = nextWorkDay.toLowerCase() === 'monday' ? 'Monday' : 'Tomorrow';
        
        let message = '';
        let color = '';
        
        switch (normalizedStatus) {
          case 'yes':
            message = `${currentName}, you confirmed that you're working from the office ${dayText}.`;
            color = 'green';
            break;
          case 'no':
            message = `${currentName}, you confirmed that you're working from the home office ${dayText}.`;
            color = 'red';
            break;
          case 'undecided':
            message = `${currentName}, you marked that you're not sure yet where you'll work ${dayText}.`;
            color = 'orange';
            break;
          default:
            message = "Status saved.";
            color = 'gray';
        }
        
        setStatusMessageWithTimeout(message, color);

        // Log this change to activity log
        await logStatusChange(currentName, normalizedStatus, tomorrow);
        
        // Clear cache and refresh activity logs if sidebar is open
        setActivityLogsCache(null);
        if (sidebarOpen) {
          await loadActivityLogs();
        }
        
        // Notify satellite window to refresh if it exists
        if (window.electronAPI?.refreshSidebarActivityLogs) {
          window.electronAPI.refreshSidebarActivityLogs();
        }
        
      } catch (error) {
        console.error("Error saving from popup:", error);
        setStatusMessageWithTimeout("An error occurred while saving status from notification.", 'red');
      }
    };

    console.log('Registering popup handler');
    window.electronAPI.onPopupStatus(handlePopup);
    
    return () => {
      if (window.electronAPI?.removeAllPopupStatusListeners) {
        window.electronAPI.removeAllPopupStatusListeners();
      }
    };
  }, [firebaseConfigured, database]); // Add dependencies to ensure handler has access to Firebase

  // Listen for sidebar window being closed externally
  useEffect(() => {
    if (!window.electronAPI?.onSidebarWindowClosed) return;

    const handleSidebarClosed = () => {
      setSidebarOpen(false);
      localStorage.setItem('sidebarOpen', 'false');
    };

    window.electronAPI.onSidebarWindowClosed(handleSidebarClosed);
  }, []);

  // Version checking effect
  useEffect(() => {
    const checkVersion = async () => {
      if (shouldCheckForUpdates()) {
        const result = await checkForUpdates();
        if (result.hasUpdate && shouldShowUpdateNotification(result)) {
          setUpdateInfo(result);
          setShowUpdateNotification(true);
        }
      }
    };

    const checkPostUpdateState = async () => {
      if (window.electronAPI?.checkUpdateState) {
        try {
          const updateState = await window.electronAPI.checkUpdateState();
          if (updateState) {
            console.log('Post-update state detected:', updateState);
            // Clear any existing update progress/notifications
            setUpdateProgress({ phase: null, percent: 0, message: '' });
            setShowUpdateNotification(false);
            
            // Refresh current version display after update
            if (window.electronAPI?.getAppVersion) {
              try {
                const newVersion = await window.electronAPI.getAppVersion();
                setCurrentVersion(newVersion);
              } catch (error) {
                console.error('Error refreshing version after update:', error);
              }
            }
            
            // Show post-update notification with the actual new version
            setPostUpdateState({
              success: true,
              version: updateState.version,
              timestamp: updateState.timestamp
            });
            setShowPostUpdateNotification(true);
          }
        } catch (error) {
          console.error('Error checking post-update state:', error);
        }
      }
    };

    // Check for post-update state first
    checkPostUpdateState();
    
    // Then check for updates when app starts
    checkVersion();
    
    // Check for updates every 2 hours while app is running
    const interval = setInterval(checkVersion, 2 * 60 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  const saveStatus = async (status) => {
    if (!name) {
      alert("Please enter your name before confirming status.");
      return;
    }

    try {
      // Check if user already has the same status for the same target date
      const currentUserStatus = statuses[name];
      if (currentUserStatus && 
          currentUserStatus.status === status && 
          currentUserStatus.date === tomorrow) {
        // Same status for same day - ignore silently
        console.log(`Ignoring duplicate status: ${name} already has status '${status}' for ${tomorrow}`);
        return;
      }

      // Ensure user is authenticated before database operations
      await waitForAuth();
      
      const userRef = ref(database, `statuses/${name}`);
      
      await set(userRef, {
        date: tomorrow,
        status,
        updatedAt: getHumanReadableTimestamp()
      });

      const dayText = nextWorkDay.toLowerCase() === 'monday' ? 'Monday' : 'Tomorrow';
      
      let message = '';
      let color = '';
      
      switch (status) {
        case 'yes':
          message = `${name}, you confirmed that you're working from the office ${dayText}.`;
          color = 'green';
          break;
        case 'no':
          message = `${name}, you confirmed that you're working from the home office ${dayText}.`;
          color = 'red';
          break;
        case 'undecided':
          message = `${name}, you marked that you're not sure yet where you'll work ${dayText}.`;
          color = 'orange';
          break;
        default:
          message = "Status saved.";
          color = 'gray';
      }
      
      setStatusMessageWithTimeout(message, color);
      
      // Log this change to activity log
      await logStatusChange(name, status, tomorrow);
      
      // Clear cache and refresh activity logs if sidebar is open
      setActivityLogsCache(null);
      if (sidebarOpen) {
        await loadActivityLogs();
      }
      
      // Notify satellite window to refresh if it exists
      if (window.electronAPI?.refreshSidebarActivityLogs) {
        window.electronAPI.refreshSidebarActivityLogs();
      }
      
    } catch (error) {
      console.error("Error saving:", error);
      setStatusMessageWithTimeout("An error occurred while saving status.", 'red');
    }
  };

  const handleSaveName = async () => {
    if (!name) {
      alert("Please enter a name.");
      return;
    }

    if (oldName && oldName !== name) {
      try {
        // Ensure user is authenticated before database operations
        await waitForAuth();
        
        const oldUserRef = ref(database, `statuses/${oldName}`);
        const snapshot = await get(oldUserRef);
        if (snapshot.exists()) {
          const oldData = snapshot.val();
          const newUserRef = ref(database, `statuses/${name}`);
          await set(newUserRef, oldData);
          await remove(oldUserRef);
          setStatusMessageWithTimeout(`${name} took over status from ${oldName}.`, 'blue');
        }
        updateNotificationSettingsName(oldName, name);
      } catch (err) {
        console.error("Error transferring status:", err);
        setStatusMessageWithTimeout("An error occurred while transferring the old status.", 'red');
      }
    }

    localStorage.setItem("username", name);
    setIsNameSaved(true);
    setOldName(name);
  };

  const handleEditName = () => {
    localStorage.removeItem("username");
    setIsNameSaved(false);
    setOldName(name);
    setName("");
  };

  // Listen for sound errors
  useEffect(() => {
    if (window.electronAPI?.onSoundError) {
      window.electronAPI.onSoundError((errorMessage) => {
        alert(`Sound Error: ${errorMessage}\n\nPlease add the sound files to the electron/sounds/ folder.`);
      });
    }
  }, []);

  const addNotification = () => {
    setNotifications([...notifications, { time: "", days: [] }]);
  };

  const deleteNotification = (index) => {
    const updated = [...notifications];
    updated.splice(index, 1);
    setNotifications(updated);
  };

  const handleUpdateDismiss = (version) => {
    dismissUpdate(version);
    setShowUpdateNotification(false);
    setUpdateInfo(null);
    setUpdateProgress({ phase: null, percent: 0, message: '' });
    // Clear update check result
    setManualUpdateCheck(prev => ({ ...prev, result: null }));
  };

  const handleUpdatePostpone = (version) => {
    postponeUpdate(version);
    setShowUpdateNotification(false);
    setUpdateInfo(null);
    setUpdateProgress({ phase: null, percent: 0, message: '' });
    // Clear update check result
    setManualUpdateCheck(prev => ({ ...prev, result: null }));
  };

  const handleCancelUpdate = () => {
    // Cancel download on electron side if available
    if (window.electronAPI?.cancelUpdate) {
      window.electronAPI.cancelUpdate();
    }
    
    // Reset the update progress and show error
    setUpdateProgress({ phase: null, percent: 0, message: '' });
    
    // Clear update check result
    setManualUpdateCheck(prev => ({ ...prev, result: null }));
  };

  const handleUpdateNow = async (updateInfo) => {
    console.log('[App] handleUpdateNow called with:', updateInfo);
    
    // Store the current "Launch in tray" setting to restore it after update
    if (launchInTray) {
      console.log('[App] Storing "Launch in tray" setting and temporarily disabling to prevent update conflicts');
      // Store the setting in localStorage to persist across app restarts
      localStorage.setItem('restoreLaunchInTray', 'true');
      handleLaunchInTrayToggle({ target: { checked: false } });
    }
    
    try {
      // Check if we have a download URL
      if (updateInfo.downloadUrl) {
        console.log('[App] Download URL found:', updateInfo.downloadUrl);
        // Reset progress
        setUpdateProgress({ phase: 'downloading', percent: 0, message: 'Starting download...' });
        // Call the actual download function
        await downloadAndInstallUpdate(updateInfo.downloadUrl, updateInfo.latestVersion);
        // The app should restart after successful update
      } else {
        console.log('[App] No download URL, opening repository page.');
        window.open('https://github.com/moisalucian/office-or-home-office/releases/latest', '_blank');
        throw new Error('Auto-update not available, opened download page');
      }
    } catch (error) {
      console.error('[App] Update failed:', error);
      setUpdateProgress({ phase: null, percent: 0, message: '' });
      throw error;
    }
  };

  const handleManualUpdateCheck = async () => {
    setManualUpdateCheck(prev => ({ ...prev, isChecking: true }));
    
    try {
      const result = await performManualUpdateCheck();
      setManualUpdateCheck({
        isChecking: false,
        lastChecked: new Date(),
        result
      });
      
      if (result.hasUpdate) {
        setUpdateInfo(result);
        setShowUpdateNotification(true);
      }
    } catch (error) {
      console.error('Manual update check failed:', error);
      setManualUpdateCheck({
        isChecking: false,
        lastChecked: new Date(),
        result: { hasUpdate: false, error: error.message }
      });
    }
  };

  // REMOVED: Test update notification function for production

  // Post-update notification handlers
  const handlePostUpdateDismiss = () => {
    setShowPostUpdateNotification(false);
    setPostUpdateState(null);
  };

  const handlePostUpdateRetry = () => {
    // Trigger a new update check and show the update notification
    setShowPostUpdateNotification(false);
    setPostUpdateState(null);
    handleManualUpdateCheck();
  };

  const handlePostUpdateManual = () => {
    window.open('https://github.com/moisalucian/office-or-home-office/releases/latest', '_blank');
  };

  // Firebase configuration handlers
  const handleFirebaseConfigSave = async (config) => {
    console.log('=== handleFirebaseConfigSave START ===');
    console.log('Config received:', config);
    
    try {
      // Close dialog immediately to prevent re-renders
      console.log('Closing Firebase config dialog...');
      setShowFirebaseConfig(false);
      
      // Just save the config, don't try to reinitialize Firebase immediately
      console.log('Calling saveFirebaseConfig...');
      
      if (window.electronAPI && window.electronAPI.saveFirebaseConfig) {
        const result = await window.electronAPI.saveFirebaseConfig(config);
        console.log('saveFirebaseConfig result:', result);
        
        if (result.success) {
          console.log('Firebase config saved successfully');
          setFirebaseError('Configuration saved! Please restart the app to apply changes.');
          
          // Show a simple success message instead of complex reinitializatoin
          setTimeout(() => {
            if (window.confirm('Firebase configuration saved successfully! Would you like to restart the app now to apply the changes?')) {
              if (window.electronAPI?.restartApp) {
                window.electronAPI.restartApp();
              } else {
                window.location.reload();
              }
            }
          }, 500);
          
        } else {
          console.error('Failed to save Firebase configuration:', result.error);
          setFirebaseError(`Failed to save Firebase configuration: ${result.error || 'Unknown error'}`);
          setShowFirebaseConfig(true);
        }
      } else {
        console.error('electronAPI.saveFirebaseConfig not available');
        setFirebaseError('Cannot save configuration - Electron API not available');
        setShowFirebaseConfig(true);
      }
      
    } catch (error) {
      console.error('=== Error in handleFirebaseConfigSave ===');
      console.error('Error details:', error);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      
      setFirebaseError(`Failed to save Firebase configuration: ${error.message}`);
      setShowFirebaseConfig(true);
    }
    
    console.log('=== handleFirebaseConfigSave END ===');
  };

  const openFirebaseConfig = async () => {
    console.log('=== openFirebaseConfig START ===');
    
    // Load current config before showing dialog
    try {
      if (window.electronAPI?.getFirebaseConfig) {
        const currentConfig = await window.electronAPI.getFirebaseConfig();
        console.log('Current config loaded:', currentConfig);
        setCurrentFirebaseConfig(currentConfig || {});
      }
    } catch (error) {
      console.error('Error loading current config:', error);
      setCurrentFirebaseConfig({});
    }
    
    console.log('Before setting showFirebaseConfig...');
    setShowFirebaseConfig(true);
    console.log('After setting showFirebaseConfig...');
    console.log('=== openFirebaseConfig END ===');
  };

  // Settings and theme integration useEffect
  useEffect(() => {
    if (window.electronAPI) {
      // Handle tray double-click launch settings request
      const handleTrayLaunchRequest = () => {
        const settings = {
          defaultLaunchOption: localStorage.getItem('defaultLaunchOption') || 'window'
        };
        window.electronAPI.sendTrayLaunchSettings(settings);
      };
      
      // Set up listeners
      window.electronAPI.onGetSettingsForTrayLaunch(handleTrayLaunchRequest);
    }
  }, []);

  // State to track if horizontal scrolling is needed
  const [needsHorizontalScroll, setNeedsHorizontalScroll] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  
  // Check if horizontal scrolling is needed based on sidebar width (for maximized mode)
  useEffect(() => {
    if (isMaximized && sidebarOpen) {
      // Default column sizes: user=65px, day columns=55px each, gap=0.2rem each (7 gaps total)
      const defaultUserColumnWidth = 65;
      const defaultDayColumnWidth = 55;
      const gapWidth = 3.2; // 0.2rem converted to pixels (approximately)
      const totalGaps = 7 * gapWidth; // 7 gaps between 8 columns
      
      // Calculate minimum required width (25% of default for day columns)
      const minDayColumnWidth = defaultDayColumnWidth * 0.25; // 13.75px
      const minRequiredWidth = defaultUserColumnWidth + (7 * minDayColumnWidth) + totalGaps;
      
      // If sidebar width is less than minimum, enable horizontal scroll and use default column sizes
      setNeedsHorizontalScroll(sidebarWidth < minRequiredWidth);
    } else {
      setNeedsHorizontalScroll(false);
    }
  }, [isMaximized, sidebarOpen, sidebarWidth]);

  // Calculate dynamic column widths for fullscreen mode
  const getDynamicColumnWidths = () => {
    if (!isMaximized || !sidebarOpen || needsHorizontalScroll) {
      return { userWidth: 65, dayWidth: 55 }; // Default fixed sizes
    }

    const defaultUserColumnWidth = 65;
    const defaultDayColumnWidth = 55;
    const gapWidth = 3.2; // 0.2rem converted to pixels
    const totalGaps = 7 * gapWidth;
    
    // More conservative available width calculation to prevent table overflow
    // Account for: container padding (2rem), overview container padding (1rem), scrollbar space, margins
    const containerPadding = 32 + 16 + 16 + 8; // 2rem + 1rem + margins + scrollbar space
    const availableWidth = sidebarWidth - containerPadding;
    
    // Calculate how much extra space we have, but be conservative
    const usedWidth = defaultUserColumnWidth + (7 * defaultDayColumnWidth) + totalGaps;
    const extraWidth = Math.max(0, availableWidth - usedWidth);
    
    // Only distribute extra width if we have significant extra space (more than 70px)
    // This prevents small increases that could cause boundary issues
    if (extraWidth > 70) {
      const extraPerDayColumn = Math.floor(extraWidth / 8); // Distribute among day columns + some for user column
      const dynamicUserWidth = defaultUserColumnWidth + Math.floor(extraPerDayColumn * 0.2); // 20% extra to user column
      const dynamicDayWidth = defaultDayColumnWidth + Math.floor(extraPerDayColumn * 0.8); // 80% to day columns
      
      return { 
        userWidth: Math.min(dynamicUserWidth, 80), // Cap user column width
        dayWidth: Math.min(dynamicDayWidth, 70)     // Cap day column width
      };
    }
    
    return { userWidth: defaultUserColumnWidth, dayWidth: defaultDayColumnWidth };
  };

  const { userWidth, dayWidth } = getDynamicColumnWidths();

  // Load sidebar state from localStorage on startup
  useEffect(() => {
    const savedSidebarWidth = localStorage.getItem('sidebarWidth');
    
    if (savedSidebarWidth !== null) {
      setSidebarWidth(parseInt(savedSidebarWidth, 10));
    }
  }, []);

  // Save sidebar width when it changes (but not open state - no sync)
  useEffect(() => {
    localStorage.setItem('sidebarWidth', sidebarWidth.toString());
  }, [sidebarWidth]);

  // Close external sidebar window on mode changes (always start fresh)
  useEffect(() => {
    // Always close sidebar when switching modes to avoid sync issues
    setSidebarOpen(false);
    
    // Always close external window to prevent conflicts
    if (window.electronAPI?.toggleSidebarWindow) {
      window.electronAPI.toggleSidebarWindow(false);
    }
  }, [isMaximized]);

  const toggleSidebar = useCallback(async () => {
    if (isToggling) return; // Prevent multiple rapid clicks
    
    setIsToggling(true);
    try {
      const newState = !sidebarOpen;
      setSidebarOpen(newState);
      
      if (isMaximized) {
        // In maximized mode, just toggle the sidebar visibility (no window changes)
        // Sidebar is handled by CSS within the same window
      } else {
        // In windowed mode, create/close external sidebar window
        if (window.electronAPI?.handlePopup) {
          window.electronAPI.handlePopup(newState);
        }
      }
      
    } catch (error) {
      console.error('Error toggling sidebar:', error);
    } finally {
      // Longer delay to prevent double-click issues
      setTimeout(() => setIsToggling(false), 300);
    }
  }, [isToggling, isMaximized, sidebarOpen]);

  // Cleanup effect for sidebar resize
  useEffect(() => {
    const cleanup = () => {
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };

    // Cleanup when sidebar closes
    if (!sidebarOpen) {
      cleanup();
    }

    // Cleanup on unmount
    return cleanup;
  }, [sidebarOpen]);

  // Special render for sidebar window
  if (isSidebarWindow) {
    // Optimized loading for sidebar window - render immediately
    useEffect(() => {
      // Show cached data immediately if available
      if (activityLogsCache && Date.now() - lastCacheTime < 300000) { // 5 minutes cache
        setActivityLogs(activityLogsCache);
      }
      
      // Load fresh data in background without blocking render
      setTimeout(async () => {
        try {
          if (!firebaseConfigured && !isFirebaseInitialized()) {
            const config = await getFirebaseConfig();
            if (config && Object.keys(config).length > 0) {
              await initializeFirebase(config);
              await initializeAuth();
            }
          }
          
          // Load fresh activity logs
          await loadActivityLogs();
        } catch (error) {
          console.error('Background loading error:', error);
        }
      }, 100); // Delay to allow UI to render first
    }, []);
    
    // Initialize theme for sidebar window immediately (synchronous)
    useEffect(() => {
      const savedTheme = localStorage.getItem('theme') || 'dark';
      document.documentElement.setAttribute('data-theme', savedTheme === 'system' ? 'dark' : savedTheme);
      
      // Listen for theme changes from main process
      const handleThemeChange = (newTheme) => {
        document.documentElement.setAttribute('data-theme', newTheme);
      };
      
      if (window.electronAPI?.onThemeChanged) {
        window.electronAPI.onThemeChanged(handleThemeChange);
      }
    }, []);
    
    return (
      <div className="sidebar-window">
        <div className="sidebar-content">
          <ActivityLogContent />
        </div>
      </div>
    );
  }

  // Show loading screen while Firebase is initializing
  if (firebaseLoading) {
    return (
      <div className={`container ${isMaximized ? 'maximized' : ''}`}>
        <WindowControls />
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center', 
          height: '100vh',
          padding: '20px',
          textAlign: 'center'
        }}>
          <h2>Loading...</h2>
          <p>Initializing Firebase connection...</p>
        </div>
      </div>
    );
  }

  // Show Firebase configuration dialog if not configured
  if (!firebaseConfigured) {
    return (
      <>
        <div className={`container ${isMaximized ? 'maximized' : ''}`}>
          <WindowControls />
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            height: '100vh',
            padding: '20px',
            textAlign: 'center'
          }}>
            <img src={iconPath} alt="Office or Home Office" className="app-icon welcome-icon" />
            <h2>Welcome to Office or Home Office</h2>
            <p>To get started, please configure your Firebase connection.</p>
            {firebaseError && (
              <p style={{ color: 'var(--text-error)', margin: '10px 0' }}>
                {firebaseError}
              </p>
            )}
            <button 
              className="primary" 
              onClick={openFirebaseConfig}
              style={{ marginTop: '20px' }}
            >
              Configure Firebase
            </button>
          </div>
        </div>
        
        {/* Firebase Configuration Dialog - Always available */}
        {showFirebaseConfig && (
          <FirebaseConfig
            onConfigSaved={handleFirebaseConfigSave}
            onClose={() => setShowFirebaseConfig(false)}
            currentConfig={currentFirebaseConfig}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div className={`container ${isMaximized ? 'maximized' : ''}`}>
      <WindowControls />
      {/* Sidebar toggle arrow */}
      <button 
        className={`sidebar-toggle ${isMaximized ? 'maximized' : 'normal'} ${sidebarOpen && isMaximized ? 'open' : ''}`}
        onClick={toggleSidebar}
        title="Toggle Activity Log"
      >
        {sidebarOpen ? '▶' : '◀'}
      </button>

      {/* Settings icon */}
      <button 
        className="settings-icon"
        onClick={() => setShowSettings(!showSettings)}
        title="Settings"
      >
        ⚙️
      </button>

      {/* Sidebar for maximized mode */}
      {isMaximized && (
        <div 
          className="sidebar-maximized" 
          style={{ 
            width: sidebarOpen ? `${sidebarWidth}px` : '0px'
          }}
        >
          {sidebarOpen && (
            <>
              <div className="sidebar-content">
                <ActivityLogContent />
              </div>
              <div 
                className="sidebar-resize-handle" 
                onMouseDown={(e) => {
                  const startX = e.clientX;
                  const startWidth = sidebarWidth;
                  const defaultWidth = 650; // Updated to match new default
                  const minWidth = Math.floor(defaultWidth * 0.6); // 60% of default (390px)
                  const maxWidth = Math.floor(defaultWidth * 2.2); // More generous maximum (1430px)

                  // Add dragging class
                  const handle = e.target;
                  handle.classList.add('dragging');
                  document.body.classList.add('dragging');

                  const onMouseMove = (e) => {
                    const newWidth = startWidth + (e.clientX - startX);
                    
                    // Apply the same constraints as the main app: ensure main content has minimum width
                    const screenWidth = window.innerWidth;
                    const minMainContentWidth = 600; // Same constraint as main app
                    const maxAllowedSidebarWidth = screenWidth - minMainContentWidth;
                    
                    // Also respect maximum percentage constraint 
                    const maxSidebarPercentage = screenWidth * 0.7; // 70% max
                    
                    // Use the most restrictive constraint (same logic as main app)
                    const finalWidth = Math.min(
                      Math.max(minWidth, newWidth), // Respect minimum width
                      maxAllowedSidebarWidth,        // Respect main content minimum
                      maxSidebarPercentage,          // Respect percentage limit
                      maxWidth                       // Respect maximum width
                    );
                    
                    setSidebarWidth(finalWidth);
                    localStorage.setItem('sidebarWidth', finalWidth);
                  };

                  const onMouseUp = () => {
                    // Remove dragging classes
                    handle.classList.remove('dragging');
                    document.body.classList.remove('dragging');
                    
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                    document.body.style.cursor = '';
                    document.body.style.userSelect = '';
                  };

                  document.addEventListener('mousemove', onMouseMove);
                  document.addEventListener('mouseup', onMouseUp);
                  document.body.style.cursor = 'col-resize';
                  document.body.style.userSelect = 'none';
                }}
              ></div>
            </>
          )}
        </div>
      )}

      {/* Update notification */}
      {showUpdateNotification && updateInfo && (
        <UpdateNotification 
          updateInfo={updateInfo} 
          onDismiss={handleUpdateDismiss}
          onPostpone={handleUpdatePostpone}
          onUpdateNow={handleUpdateNow}
          updateProgress={updateProgress}
          onCancelUpdate={handleCancelUpdate}
          onRestartNow={async () => {
            if (window.electronAPI?.restartApp && window.electronAPI?.markUpdateCompleted) {
              try {
                // Mark that the update was completed before restarting
                const currentVersion = await window.electronAPI.getAppVersion();
                await window.electronAPI.markUpdateCompleted(currentVersion);
                window.electronAPI.restartApp();
              } catch (error) {
                console.error('Error during restart process:', error);
              }
            }
          }}
          onRestartLater={() => {
            // Hide the notification but keep the staged update
            setShowUpdateNotification(false);
            // Note: We don't clear updateInfo or updateProgress here
            // The staged update should still be applied on next restart
          }}
        />
      )}

      {/* Post-update notification */}
      {showPostUpdateNotification && postUpdateState && (
        <PostUpdateNotification 
          updateState={postUpdateState}
          onDismiss={handlePostUpdateDismiss}
          onRetryUpdate={handlePostUpdateRetry}
          onManualUpdate={handlePostUpdateManual}
        />
      )}

      {/* Settings popup */}
      {showSettings && (
        <div className="settings-overlay" onClick={() => setShowSettings(false)}>
          <div className="settings-popup" onClick={(e) => e.stopPropagation()}>
            <div className="settings-header">
              <h3>⚙️ Settings</h3>
              <button className="settings-close" onClick={() => setShowSettings(false)}>❌</button>
            </div>
            <div className="settings-content">
              <div className="setting-item">
                <div className="setting-label" title="Start the app when Windows starts">
                  <span className="setting-title">Launch at startup</span>
                  <label className="toggle-switch">
                    <input 
                      type="checkbox" 
                      checked={launchAtStartup} 
                      onChange={handleStartupToggle}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
              </div>

              <div className="setting-item">
                <div className="setting-label" title="Start minimized to system tray">
                  <span className="setting-title">Launch in tray directly</span>
                  <label className="toggle-switch">
                    <input 
                      type="checkbox" 
                      checked={launchInTray} 
                      onChange={handleLaunchInTrayToggle}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
              </div>

              <div className="setting-item">
                <div className="setting-label" title="How the app opens on startup">
                  <span className="setting-title">Default launch option</span>
                  <select 
                    className="setting-select"
                    value={defaultLaunchOption} 
                    onChange={handleDefaultLaunchOptionChange}
                    title="How the app opens on startup"
                  >
                    <option value="window">Window</option>
                    <option value="maximized">Full screen</option>
                  </select>
                </div>
              </div>

              <div className="setting-item">
                <div className="setting-label" title="App appearance and colors">
                  <span className="setting-title">Theme</span>
                  <select 
                    className="setting-select"
                    value={themeSetting} 
                    onChange={handleThemeChange}
                    title="App appearance and colors"
                  >
                    <option value="dark">Dark</option>
                    <option value="light">Light</option>
                    <option value="system">System</option>
                  </select>
                </div>
              </div>

              <div className="setting-item">
                <div className="setting-label" title="Sound played when notification popup appears">
                  <span className="setting-title">Notification sound</span>
                  <div className="sound-setting-controls">
                    <select 
                      className="setting-select"
                      value={notificationSound} 
                      onChange={handleNotificationSoundChange}
                      title="Sound played when notification popup appears"
                    >
                      <option value="none">None</option>
                      <option value="alien-sound">Alien Sound</option>
                      <option value="bong-chime">Bong Chime</option>
                      <option value="cartoon-dash">Cartoon Dash</option>
                      <option value="drip-echo">Drip Echo</option>
                      <option value="glass-ding">Glass Ding</option>
                      <option value="light-min">Light Minimal</option>
                      <option value="notification-chime">Notification Chime</option>
                      <option value="notification-sound-soft">Soft Notification</option>
                      <option value="oh-yeah">Oh Yeah</option>
                      <option value="sci-fi-bubble">Sci-Fi Bubble</option>
                      <option value="thai-bird">Thai Bird</option>
                      <option value="three-note-doorbell">Three Note Doorbell</option>
                      <option value="woohoo">Woohoo</option>
                    </select>
                    {notificationSound !== 'none' && (
                      <button 
                        className="play-sound-button"
                        onClick={() => previewNotificationSound()}
                        title="Preview selected sound"
                      >
                        🔊
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Firebase Configuration */}
              <div className="setting-item">
                <div className="setting-label" title="Configure Firebase database connection">
                  <span className="setting-title">Firebase Configuration</span>
                  <button 
                    className="firebase-config-button"
                    onClick={openFirebaseConfig}
                    title="Edit Firebase database configuration"
                  >
                    🔧 Edit Config
                  </button>
                </div>
              </div>

              {/* App Updates - moved to last position */}
              <div className="setting-item">
                <div className="setting-label" title="Check for app updates">
                  <span className="setting-title">App Updates</span>
                  <div className="update-setting-controls">
                    <button 
                      className="update-check-button"
                      onClick={handleManualUpdateCheck}
                      disabled={manualUpdateCheck.isChecking}
                      title="Check for new app version"
                    >
                      {manualUpdateCheck.isChecking ? (
                        <>
                          <span className="loading-spinner">⏳</span>
                          Checking...
                        </>
                      ) : (
                        <>
                          🔄 Check for Updates
                        </>
                      )}
                    </button>
                    {manualUpdateCheck.result && (
                      <div className="update-check-result">
                        {manualUpdateCheck.result.hasUpdate ? (
                          <span className="update-available">✅ Update available!</span>
                        ) : manualUpdateCheck.result.error ? (
                          <span className="update-error">❌ Check failed</span>
                        ) : (
                          <span className="update-latest">✅ You have the latest version</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Version display as last item in settings content */}
              <div className="settings-version-content">
                Current Version: v{appVersion}
              </div>
            </div>
          </div>
        </div>
      )}
      
      <div 
        className={`header-area ${isMaximized && sidebarOpen ? 'sidebar-active' : ''}`}
        style={{
          '--header-margin-left': isMaximized ? (sidebarOpen ? `${Math.min(sidebarWidth, 1200)}px` : '0px') : '0px',
          '--header-width': isMaximized ? (sidebarOpen ? `calc(100% - ${Math.min(sidebarWidth, 1200)}px)` : '100%') : '100%'
        }}
      >
        <h1 className={`title-draggable ${showSettings ? 'settings-open' : ''}`}>
          <img src={iconPath} alt="Office or Home Office" className="app-icon" />
          <span className="title-text">Office or Home Office</span>
        </h1>
      </div>

      <div 
        className={`content-area ${isMaximized && sidebarOpen ? 'sidebar-active' : ''}`}
        style={{
          '--content-margin-left': isMaximized ? (sidebarOpen ? `${Math.min(sidebarWidth, 1200)}px` : '0px') : '0px',
          '--content-width': isMaximized ? (sidebarOpen ? `calc(100% - ${Math.min(sidebarWidth, 1200)}px)` : '100%') : '100%'
        }}
      >
        {!isNameSaved ? (
          <div className="name-input-container" style={{ marginBottom: "1rem" }}>
            <div className="name-input-section">
              <input
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <button className="primary" onClick={handleSaveName}>
                Save name
              </button>
            </div>
          </div>
        ) : (
          <div className="name-section-container" style={{ marginBottom: "1rem" }}>
            <div className="name-display-row">
              <p><strong>Name:</strong> {name}</p>
              <button className="secondary" onClick={handleEditName}>Edit Name</button>
            </div>
          </div>
        )}

        <div className="action-buttons" style={{ marginBottom: "2rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
          <div className="button-row-container" style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
            <button 
              className="primary" 
              style={{ 
                backgroundColor: "green", 
                minWidth: "140px", 
                height: "40px",
                padding: "0.6rem 1rem",
                whiteSpace: "nowrap"
              }} 
              onClick={() => saveStatus('yes')}
            >
              Office
            </button>
            <button 
              className="primary" 
              style={{ 
                backgroundColor: "red", 
                minWidth: "140px", 
                height: "40px",
                padding: "0.6rem 1rem",
                whiteSpace: "nowrap"
              }} 
              onClick={() => saveStatus('no')}
            >
              Home Office
            </button>
          </div>
          <div className="button-row-container" style={{ display: "flex", justifyContent: "center" }}>
            <button 
              className="primary" 
              style={{ 
                backgroundColor: "orange", 
                minWidth: "140px", 
                height: "40px",
                padding: "0.6rem 1rem"
              }} 
              onClick={() => saveStatus('undecided')}
            >
              Not Sure Yet
            </button>
          </div>
        </div>

        {notificationSummary && (
          <div className="notification-summary" style={{ whiteSpace: "pre-line", color: "#2e7d32", textAlign: "center" }}>
            {notificationSummary}
          </div>
        )}

        <div style={{ marginBottom: "2rem" }}>
          <div className="accordion-header" onClick={() => setShowNotifications(!showNotifications)}>
            Push-up Notifications {showNotifications ? "▲" : "▼"}
          </div>

          {showNotifications && (
            <div className="notifications-container">
              {notifications.map((n, index) => (
                <div key={index} className="notification-card">
                  <div className="notification-row">
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <span style={{ fontSize: "0.85rem", fontWeight: "bold", color: 'var(--text-color)', minWidth: "45px" }}>HH:MM</span>
                      <div style={{ display: 'flex', gap: '0.2rem', alignItems: 'center' }}>
                        <select
                          value={n.time ? n.time.split(':')[0] : ''}
                          onChange={(e) => {
                            const newNotifications = [...notifications];
                            const currentMinutes = n.time ? n.time.split(':')[1] || '00' : '00';
                            newNotifications[index].time = e.target.value ? `${e.target.value}:${currentMinutes}` : '';
                            setNotifications(newNotifications);
                          }}
                          style={{
                            padding: '0.4rem',
                            borderRadius: '4px',
                            border: '1px solid var(--border-color)',
                            backgroundColor: 'var(--input-bg)',
                            color: 'var(--text-color)',
                            fontSize: '0.9rem',
                            minWidth: '50px'
                          }}
                        >
                          <option value="">HH</option>
                          {Array.from({ length: 24 }, (_, hour) => {
                            const hourStr = hour.toString().padStart(2, '0');
                            return (
                              <option key={hourStr} value={hourStr}>
                                {hourStr}
                              </option>
                            );
                          })}
                        </select>
                        <span style={{ color: 'var(--text-color)', fontWeight: 'bold' }}>:</span>
                        <select
                          value={n.time ? n.time.split(':')[1] || '' : ''}
                          onChange={(e) => {
                            const newNotifications = [...notifications];
                            const currentHour = n.time ? n.time.split(':')[0] || '00' : '00';
                            newNotifications[index].time = e.target.value !== '' ? `${currentHour}:${e.target.value}` : (currentHour !== '00' ? `${currentHour}:00` : '');
                            setNotifications(newNotifications);
                          }}
                          style={{
                            padding: '0.4rem',
                            borderRadius: '4px',
                            border: '1px solid var(--border-color)',
                            backgroundColor: 'var(--input-bg)',
                            color: 'var(--text-color)',
                            fontSize: '0.9rem',
                            minWidth: '50px'
                          }}
                        >
                          <option value="">MM</option>
                          {Array.from({ length: 60 }, (_, minute) => {
                            const minuteStr = minute.toString().padStart(2, '0');
                            return (
                              <option key={minuteStr} value={minuteStr}>
                                {minuteStr}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    </div>
                    <span style={{ fontSize: "0.85rem", minWidth: "30px" }}>Zile:</span>
                    <div className="checkbox-group">
                      {["L", "Ma", "Mi", "J", "V"].map((day, i) => (
                        <label key={i}>
                          <input
                            type="checkbox"
                            checked={n.days.includes(day)}
                            onChange={(e) => {
                              const newNotifications = [...notifications];
                              if (e.target.checked) {
                                newNotifications[index].days.push(day);
                              } else {
                                newNotifications[index].days = newNotifications[index].days.filter(d => d !== day);
                              }
                              setNotifications(newNotifications);
                            }}
                          />
                          {day}
                        </label>
                      ))}
                    </div>
                    <button
                      className="danger"
                      onClick={() => deleteNotification(index)}
                      title="Delete notification"
                      style={{ fontSize: "1rem", minWidth: "30px" }}
                    >
                      ❌
                    </button>
                  </div>
                </div>
              ))}
              <div style={{ textAlign: "center", marginTop: "1rem" }}>
                <button className="primary" onClick={addNotification}>
                  + Add notification
                </button>
              </div>
            </div>
          )}
        </div>

        {statusMessage && (
          <div className="status-message" style={{ color: statusColor, marginTop: '10px', textAlign: 'center' }}>
            {statusMessage}
          </div>
        )}

        <StatusGrid 
          statuses={statuses}
          tomorrowDate={tomorrow}
          nextWorkingDayName={nextWorkDay}
        />

        {/* Version display in bottom left corner of main app */}
        <div className="app-version">
          v{appVersion}
        </div>
      </div>
      
      {/* Firebase Configuration Dialog - OUTSIDE all conditionals for production builds */}
      {showFirebaseConfig && (
        <FirebaseConfig
          onConfigSaved={handleFirebaseConfigSave}
          onClose={() => setShowFirebaseConfig(false)}
          currentConfig={currentFirebaseConfig}
        />
      )}
      </div>
    </>
  );
}

export default App;
