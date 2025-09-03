import { useEffect, useState, useCallback, useRef } from "react";
import { database } from "./firebase";
import { ref, set, onValue, remove, get } from "firebase/database";
import "./styles/theme.css";
import "./styles/layout.css";
import "./styles.css";
import UpdateNotification from "./UpdateNotification";
import PostUpdateNotification from "./PostUpdateNotification";
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
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationSummary, setNotificationSummary] = useState('');
  const [updateInfo, setUpdateInfo] = useState(null);
  const [showUpdateNotification, setShowUpdateNotification] = useState(false);
  const [postUpdateState, setPostUpdateState] = useState(null);
  const [showPostUpdateNotification, setShowPostUpdateNotification] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
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
    return saved ? parseInt(saved) : 300;
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
  
  // Use custom hooks
  const { theme, themeSetting, handleThemeChange } = useTheme();
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

  // Load activity logs when sidebar opens or app starts
  useEffect(() => {
    if (sidebarOpen) {
      loadActivityLogs();
    }
  }, [sidebarOpen, loadActivityLogs]);
  
  // Preload activity logs on app start for faster satellite window
  useEffect(() => {
    const preloadLogs = async () => {
      await loadActivityLogs();
    };
    preloadLogs();
  }, [loadActivityLogs]);

  // Check if this is the sidebar window
  const isSidebarWindow = window.location.hash === '#sidebar';
  
  // Shared activity log content component
  const ActivityLogContent = () => (
    <>
      <h3>Activity Log</h3>
      <div className="activity-log-container">
        {activityLogs.length === 0 ? (
          <p style={{ color: '#888', textAlign: 'center', marginTop: '2rem' }}>
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
    </>
  );
  
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
    if (window.electronAPI?.resizeWindow && !isMaximized) {
      const optimalHeight = calculateOptimalHeightCallback();
      console.log('Resizing window to:', 940, optimalHeight);
      window.electronAPI.resizeWindow(940, optimalHeight);
    }
  }, [statuses, isMaximized, calculateOptimalHeightCallback]);

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
    const statusesRef = ref(database, "statuses");
    onValue(statusesRef, (snapshot) => {
      const data = snapshot.val() || {};
      setStatuses(data);
    });
  }, []);

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
      if (!currentName || !currentName.trim()) return; // Ensure name exists and is not empty
      
      // Convert boolean values to string for backward compatibility
      let normalizedStatus = status;
      if (typeof status === 'boolean') {
        normalizedStatus = status ? 'yes' : 'no';
      }
      
      // Use the current name for saving status
      const userRef = ref(database, `statuses/${currentName}`);
      
      try {
        await set(userRef, {
          date: tomorrow,
          status: normalizedStatus,
          updatedAt: getHumanReadableTimestamp()
        });

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
      }
    };

    window.electronAPI.onPopupStatus(handlePopup);
    return () => {
      window.electronAPI.removePopupStatus?.(handlePopup);
    };
  }, []); // Remove name dependency to prevent multiple handlers

  useEffect(() => {
    if (!window.electronAPI?.onWindowStateChanged) return;

    const handleWindowStateChange = (state) => {
      setIsMaximized(state.maximized);
      
      // Close sidebar window if switching to maximized mode
      if (state.maximized && sidebarOpen && !isMaximized) {
        if (window.electronAPI?.toggleSidebarWindow) {
          window.electronAPI.toggleSidebarWindow(false);
        }
      }
    };

    window.electronAPI.onWindowStateChanged(handleWindowStateChange);
  }, [sidebarOpen, isMaximized]);

  // Listen for sidebar window being closed externally
  useEffect(() => {
    if (!window.electronAPI?.onSidebarWindowClosed) return;

    const handleSidebarClosed = () => {
      setSidebarOpen(false);
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
      
      setStatusMessage(message);
      setStatusColor(color);
      
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
      setStatusMessage("An error occurred while saving status.");
      setStatusColor('gray');
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
          setStatusMessage(`${name} took over status from ${oldName}.`);
          setStatusColor('blue');
        }
        updateNotificationSettingsName(oldName, name);
      } catch (err) {
        console.error("Error transferring status:", err);
        setStatusMessage("An error occurred while transferring the old status.");
        setStatusColor('gray');
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

  const [isToggling, setIsToggling] = useState(false);

  const toggleSidebar = async () => {
    if (isToggling) return; // Prevent multiple rapid clicks
    
    setIsToggling(true);
    try {
      if (isMaximized) {
        setSidebarOpen(!sidebarOpen);
      } else {
        // For normal mode, toggle satellite window
        const newState = !sidebarOpen;
        setSidebarOpen(newState);
        if (window.electronAPI?.toggleSidebarWindow) {
          await window.electronAPI.toggleSidebarWindow(newState);
        }
      }
    } catch (error) {
      console.error('Error toggling sidebar:', error);
    } finally {
      // Add a small delay to prevent rapid clicking issues
      setTimeout(() => setIsToggling(false), 200);
    }
  };

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
    const [isLoading, setIsLoading] = useState(true);
    
    // Initialize theme for sidebar window
    useEffect(() => {
      const initSidebarTheme = async () => {
        const savedTheme = localStorage.getItem('theme') || 'dark';
        
        if (savedTheme === 'system') {
          try {
            const systemTheme = await window.electronAPI.getSystemTheme();
            document.documentElement.setAttribute('data-theme', systemTheme);
          } catch (error) {
            console.log('Could not get system theme for sidebar, defaulting to dark');
            document.documentElement.setAttribute('data-theme', 'dark');
          }
        } else {
          document.documentElement.setAttribute('data-theme', savedTheme);
        }
      };
      
      // Listen for theme changes from main process
      const handleThemeChange = (newTheme) => {
        document.documentElement.setAttribute('data-theme', newTheme);
      };
      
      if (window.electronAPI?.onThemeChanged) {
        window.electronAPI.onThemeChanged(handleThemeChange);
      }
      
      initSidebarTheme();
    }, []);
    
    // Load activity logs when satellite window opens
    useEffect(() => {
      const loadData = async () => {
        // Show window immediately, load data in background
        setIsLoading(false); // Show content immediately
        await loadActivityLogs();
      };
      loadData();
      
      // Listen for refresh events from main window
      const handleRefresh = async () => {
        await loadActivityLogs();
      };
      
      if (window.electronAPI?.onRefreshActivityLogs) {
        window.electronAPI.onRefreshActivityLogs(handleRefresh);
      }
    }, [loadActivityLogs]);

    // Initialize theme for sidebar window
    useEffect(() => {
      const initSidebarTheme = async () => {
        const savedTheme = localStorage.getItem('theme') || 'dark';
        if (savedTheme === 'system') {
          try {
            const systemTheme = await window.electronAPI.getSystemTheme();
            document.documentElement.setAttribute('data-theme', systemTheme);
          } catch (error) {
            document.documentElement.setAttribute('data-theme', 'dark');
          }
        } else {
          document.documentElement.setAttribute('data-theme', savedTheme);
        }
      };
      
      initSidebarTheme();
      
      // Listen for theme changes
      if (window.electronAPI?.onThemeChanged) {
        window.electronAPI.onThemeChanged((newTheme) => {
          document.documentElement.setAttribute('data-theme', newTheme);
        });
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

  return (
    <div className={`container ${isMaximized ? 'maximized' : ''}`}>
      <WindowControls />
      {/* Sidebar toggle arrow */}
      <button 
        className={`sidebar-toggle ${isMaximized ? 'maximized' : 'normal'} ${sidebarOpen && isMaximized ? 'open' : ''}`}
        onClick={toggleSidebar}
        title="Toggle Activity Log"
      >
        {isMaximized ? (sidebarOpen ? '◀' : '▶') : '◀'}
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

                  const onMouseMove = (e) => {
                    const newWidth = startWidth + (e.clientX - startX);
                    const clampedWidth = Math.max(200, Math.min(600, newWidth));
                    setSidebarWidth(clampedWidth);
                    localStorage.setItem('sidebarWidth', clampedWidth);
                  };

                  const onMouseUp = () => {
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                  };

                  document.addEventListener('mousemove', onMouseMove);
                  document.addEventListener('mouseup', onMouseUp);
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
          '--header-margin-left': isMaximized ? (sidebarOpen ? `${sidebarWidth}px` : '0px') : '0px',
          '--header-width': isMaximized ? (sidebarOpen ? `calc(100% - ${sidebarWidth}px)` : '100%') : '100%'
        }}
      >
        <h1 className="title-draggable">
          <span className="title-text">Office or Home Office</span>
        </h1>
      </div>

      <div 
        className={`content-area ${isMaximized && sidebarOpen ? 'sidebar-active' : ''}`}
        style={{
          '--content-margin-left': isMaximized ? (sidebarOpen ? `${sidebarWidth}px` : '0px') : '0px',
          '--content-width': isMaximized ? (sidebarOpen ? `calc(100% - ${sidebarWidth}px)` : '100%') : '100%'
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
          <div className="button-row-container" style={{ display: "flex", justifyContent: "center", marginTop: "10px" }}>
            <button 
              className="primary" 
              style={{ 
                backgroundColor: "hotpink", 
                minWidth: "140px", 
                height: "40px",
                padding: "0.6rem 1rem",
                border: "2px solid #ff1493",
                fontWeight: "bold"
              }} 
              onClick={() => {
                console.log('TEST BUTTON CLICKED - Version 1.0.144!');
                alert('TEST Button from v1.0.144 clicked!');
              }}
            >
              TEST BUTTON
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
                    <input
                      type="time"
                      value={n.time}
                      onChange={(e) => {
                        const newNotifications = [...notifications];
                        newNotifications[index].time = e.target.value;
                        setNotifications(newNotifications);
                      }}
                    />
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
    </div>
  );
}

export default App;
