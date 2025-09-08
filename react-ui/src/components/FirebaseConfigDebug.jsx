import React, { useState } from 'react';

const FirebaseConfigDebug = ({ onConfigSaved, onClose }) => {
  console.log('FirebaseConfigDebug component rendering...');

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
      zIndex: 9999  // Much higher than settings popup
    }}>
      <div style={{
        background: '#1a1a1a',
        padding: '20px',
        borderRadius: '8px',
        color: 'white',
        maxWidth: '400px'
      }}>
        <h3>Debug Firebase Config</h3>
        <p>This is a test dialog to see if the crash happens with a simple component.</p>
        <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 16px' }}>
            Close
          </button>
          <button onClick={() => {
            console.log('Test save clicked');
            onConfigSaved({ test: 'config' });
          }} style={{ padding: '8px 16px', background: '#007bff', color: 'white', border: 'none' }}>
            Test Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default FirebaseConfigDebug;
