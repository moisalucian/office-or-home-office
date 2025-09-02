import { useNotificationSound } from '../hooks/useNotificationSound';
import { useWindowState } from '../hooks/useWindowState';
import { useTheme } from '../hooks/useTheme';
import { NOTIFICATION_SOUNDS, THEME_OPTIONS, LAUNCH_OPTIONS } from '../utils/constants';
import './Settings.css';

function Settings({ isOpen, onClose }) {
  const { notificationSound, handleNotificationSoundChange, previewNotificationSound } = useNotificationSound();
  const { 
    launchAtStartup, 
    launchInTray, 
    defaultLaunchOption,
    handleStartupToggle,
    handleLaunchInTrayToggle,
    handleDefaultLaunchOptionChange
  } = useWindowState();
  const { themeSetting, handleThemeChange } = useTheme();

  if (!isOpen) return null;

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-popup" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h3>⚙️ Settings</h3>
          <button 
            className="settings-close" 
            onClick={onClose}
            onMouseDown={(e) => e.stopPropagation()}
            onMouseUp={(e) => e.stopPropagation()}
            type="button"
            tabIndex={0}
            aria-label="Close settings"
            style={{ pointerEvents: 'auto', zIndex: 10 }}
          >
            ✕
          </button>
        </div>
        <div className="settings-content">
          <div className="setting-item">
            <div className="setting-label" title="Start the app when Windows starts">
              <span className="setting-title">Launch at startup</span>
              <label className="toggle-switch">
                <input 
                  type="checkbox" 
                  checked={launchAtStartup} 
                  onChange={(e) => handleStartupToggle(e.target.checked)}
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
                  onChange={(e) => handleLaunchInTrayToggle(e.target.checked)}
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
                onChange={(e) => handleDefaultLaunchOptionChange(e.target.value)}
                title="How the app opens on startup"
              >
                <option value={LAUNCH_OPTIONS.WINDOW}>Window</option>
                <option value={LAUNCH_OPTIONS.MAXIMIZED}>Full screen</option>
              </select>
            </div>
          </div>

          <div className="setting-item">
            <div className="setting-label" title="App appearance and colors">
              <span className="setting-title">Theme</span>
              <select 
                className="setting-select"
                value={themeSetting} 
                onChange={(e) => handleThemeChange(e.target.value)}
                title="App appearance and colors"
              >
                <option value={THEME_OPTIONS.DARK}>Dark</option>
                <option value={THEME_OPTIONS.LIGHT}>Light</option>
                <option value={THEME_OPTIONS.SYSTEM}>System</option>
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
                  onChange={(e) => handleNotificationSoundChange(e.target.value)}
                  title="Sound played when notification popup appears"
                >
                  {NOTIFICATION_SOUNDS.map(sound => (
                    <option key={sound.value} value={sound.value}>
                      {sound.label}
                    </option>
                  ))}
                </select>
                {notificationSound !== 'none' && (
                  <button 
                    className="play-sound-button"
                    onClick={previewNotificationSound}
                    title="Preview selected sound"
                  >
                    🔊
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Settings;
