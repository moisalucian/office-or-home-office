// Application constants
export const DAYS = {
  LONG: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  SHORT: ['D', 'L', 'Ma', 'Mi', 'J', 'V', 'S'],
  WORK: ['L', 'Ma', 'Mi', 'J', 'V']
};

export const STATUS_TYPES = {
  YES: 'yes',
  NO: 'no',
  UNDECIDED: 'undecided'
};

export const THEME_OPTIONS = {
  DARK: 'dark',
  LIGHT: 'light',
  SYSTEM: 'system'
};

export const LAUNCH_OPTIONS = {
  WINDOW: 'window',
  MAXIMIZED: 'maximized'
};

export const NOTIFICATION_SOUNDS = [
  { value: 'none', label: 'None' },
  { value: 'alien-sound', label: 'Alien Sound' },
  { value: 'bong-chime', label: 'Bong Chime' },
  { value: 'cartoon-dash', label: 'Cartoon Dash' },
  { value: 'drip-echo', label: 'Drip Echo' },
  { value: 'glass-ding', label: 'Glass Ding' },
  { value: 'light-min', label: 'Light Minimal' },
  { value: 'notification-chime', label: 'Notification Chime' },
  { value: 'notification-sound-soft', label: 'Soft Notification' },
  { value: 'oh-yeah', label: 'Oh Yeah' },
  { value: 'sci-fi-bubble', label: 'Sci-Fi Bubble' },
  { value: 'thai-bird', label: 'Thai Bird' },
  { value: 'three-note-doorbell', label: 'Three Note Doorbell' },
  { value: 'woohoo', label: 'Woohoo' }
];

export const CACHE_DURATION = 30000; // 30 seconds
export const UPDATE_CHECK_INTERVAL = 60 * 60 * 1000; // 1 hour
export const UPDATE_INSTALL_TIMEOUT = 3 * 60 * 1000; // 3 minutes
