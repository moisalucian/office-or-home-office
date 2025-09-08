import React, { useState } from 'react';

const FirebaseConfigSimple = ({ onConfigSaved, onClose }) => {
  const [config, setConfig] = useState({
    apiKey: '',
    authDomain: '',
    databaseURL: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: ''
  });

  const [bulkConfig, setBulkConfig] = useState('');
  const [showBulkInput, setShowBulkInput] = useState(true); // Start with bulk input by default

  const handleBulkPaste = () => {
    try {
      const lines = bulkConfig.split('\n');
      const newConfig = { ...config };
      
      lines.forEach(line => {
        const trimmed = line.trim();
        if (trimmed.includes('=')) {
          const [key, value] = trimmed.split('=');
          const cleanKey = key.trim().replace('VITE_FIREBASE_', '');
          const cleanValue = value.trim();
          
          switch (cleanKey) {
            case 'API_KEY':
              newConfig.apiKey = cleanValue;
              break;
            case 'AUTH_DOMAIN':
              newConfig.authDomain = cleanValue;
              break;
            case 'DATABASE_URL':
              newConfig.databaseURL = cleanValue;
              break;
            case 'PROJECT_ID':
              newConfig.projectId = cleanValue;
              break;
            case 'STORAGE_BUCKET':
              newConfig.storageBucket = cleanValue;
              break;
            case 'MESSAGING_SENDER_ID':
              newConfig.messagingSenderId = cleanValue;
              break;
            case 'APP_ID':
              newConfig.appId = cleanValue;
              break;
          }
        }
      });
      
      setConfig(newConfig);
      setBulkConfig('');
      setShowBulkInput(false); // Switch to individual view after parsing
    } catch (error) {
      alert('Error parsing configuration. Please check the format.');
    }
  };

  const isConfigValid = () => {
    const required = ['apiKey', 'authDomain', 'databaseURL', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
    return required.every(field => config[field].trim());
  };

  const handleSave = () => {
    if (!isConfigValid()) {
      alert('Please fill in all required fields.');
      return;
    }
    console.log('Saving config:', config);
    onConfigSaved(config);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 9999
    }}>
      <div style={{
        background: 'var(--bg-primary, #1a1a1a)',
        padding: '20px',
        borderRadius: '8px',
        color: 'var(--text-primary, white)',
        maxWidth: '500px',
        width: '90%',
        maxHeight: '80vh',
        overflow: 'auto',
        boxSizing: 'border-box'
      }}>
        <h3>Firebase Configuration</h3>
        
        <div style={{ marginBottom: '20px', textAlign: 'center' }}>
          <button 
            onClick={() => setShowBulkInput(!showBulkInput)}
            style={{
              padding: '10px 20px',
              background: 'var(--accent-blue, #3b82f6)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            {showBulkInput ? 'Switch to Individual Fields' : 'Paste All Configuration'}
          </button>
        </div>

        {showBulkInput ? (
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
              Paste your Firebase configuration (from .env file):
            </label>
            <textarea
              value={bulkConfig}
              onChange={(e) => setBulkConfig(e.target.value)}
              placeholder={`VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdefghijklmnop`}
              rows={7}
              style={{
                width: '100%',
                padding: '12px',
                background: 'var(--bg-secondary, #2a2a2a)',
                border: '2px solid var(--border-color, #444)',
                color: 'var(--text-primary, white)',
                borderRadius: '6px',
                boxSizing: 'border-box',
                fontFamily: 'Consolas, Monaco, monospace',
                fontSize: '14px',
                resize: 'vertical'
              }}
            />
            <button 
              onClick={handleBulkPaste}
              style={{
                marginTop: '10px',
                padding: '10px 20px',
                background: 'var(--accent-green, #22c55e)',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Apply Configuration
            </button>
          </div>
        ) : (
          <div>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>API Key:</label>
              <input
                type="text"
                value={config.apiKey}
                onChange={(e) => setConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '8px',
                  background: 'var(--bg-secondary, #2a2a2a)',
                  border: '1px solid var(--border-color, #444)',
                  color: 'var(--text-primary, white)',
                  borderRadius: '4px',
                  boxSizing: 'border-box'
                }}
                placeholder="AIzaSy..."
              />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Auth Domain:</label>
              <input
                type="text"
                value={config.authDomain}
                onChange={(e) => setConfig(prev => ({ ...prev, authDomain: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '8px',
                  background: 'var(--bg-secondary, #2a2a2a)',
                  border: '1px solid var(--border-color, #444)',
                  color: 'var(--text-primary, white)',
                  borderRadius: '4px',
                  boxSizing: 'border-box'
                }}
                placeholder="your-project.firebaseapp.com"
              />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Database URL:</label>
              <input
                type="text"
                value={config.databaseURL}
                onChange={(e) => setConfig(prev => ({ ...prev, databaseURL: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '8px',
                  background: 'var(--bg-secondary, #2a2a2a)',
                  border: '1px solid var(--border-color, #444)',
                  color: 'var(--text-primary, white)',
                  borderRadius: '4px',
                  boxSizing: 'border-box'
                }}
                placeholder="https://your-project-default-rtdb.firebaseio.com"
              />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Project ID:</label>
              <input
                type="text"
                value={config.projectId}
                onChange={(e) => setConfig(prev => ({ ...prev, projectId: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '8px',
                  background: 'var(--bg-secondary, #2a2a2a)',
                  border: '1px solid var(--border-color, #444)',
                  color: 'var(--text-primary, white)',
                  borderRadius: '4px',
                  boxSizing: 'border-box'
                }}
                placeholder="your-project-id"
              />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Storage Bucket:</label>
              <input
                type="text"
                value={config.storageBucket}
                onChange={(e) => setConfig(prev => ({ ...prev, storageBucket: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '8px',
                  background: 'var(--bg-secondary, #2a2a2a)',
                  border: '1px solid var(--border-color, #444)',
                  color: 'var(--text-primary, white)',
                  borderRadius: '4px',
                  boxSizing: 'border-box'
                }}
                placeholder="your-project.appspot.com"
              />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Messaging Sender ID:</label>
              <input
                type="text"
                value={config.messagingSenderId}
                onChange={(e) => setConfig(prev => ({ ...prev, messagingSenderId: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '8px',
                  background: 'var(--bg-secondary, #2a2a2a)',
                  border: '1px solid var(--border-color, #444)',
                  color: 'var(--text-primary, white)',
                  borderRadius: '4px',
                  boxSizing: 'border-box'
                }}
                placeholder="123456789"
              />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>App ID:</label>
              <input
                type="text"
                value={config.appId}
                onChange={(e) => setConfig(prev => ({ ...prev, appId: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '8px',
                  background: 'var(--bg-secondary, #2a2a2a)',
                  border: '1px solid var(--border-color, #444)',
                  color: 'var(--text-primary, white)',
                  borderRadius: '4px',
                  boxSizing: 'border-box'
                }}
                placeholder="1:123456789:web:abcdefghijklmnop"
              />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Measurement ID (optional):</label>
              <input
                type="text"
                value={config.measurementId || ''}
                onChange={(e) => setConfig(prev => ({ ...prev, measurementId: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '8px',
                  background: 'var(--bg-secondary, #2a2a2a)',
                  border: '1px solid var(--border-color, #444)',
                  color: 'var(--text-primary, white)',
                  borderRadius: '4px',
                  boxSizing: 'border-box'
                }}
                placeholder="G-XXXXXXXXXX"
              />
            </div>
          </div>
        )}

        <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button 
            onClick={onClose}
            style={{
              padding: '10px 20px',
              background: 'transparent',
              border: '1px solid var(--border-color, #444)',
              color: 'var(--text-secondary, #ccc)',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            style={{
              padding: '10px 20px',
              background: 'var(--accent-green, #22c55e)',
              border: 'none',
              color: 'white',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
};

export default FirebaseConfigSimple;
