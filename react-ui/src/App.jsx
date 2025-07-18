import { useEffect, useState } from "react";
import { database } from "./firebase";
import { ref, set, onValue, remove, get } from "firebase/database";
import "./styles.css";

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
  const [launchAtStartup, setLaunchAtStartup] = useState(false); // ✅ nou

  const tomorrowDate = new Date(Date.now() + 86400000).toISOString().split("T")[0];

  useEffect(() => {
    const savedName = localStorage.getItem("username");
    if (savedName) {
      setName(savedName);
      setOldName(savedName);
      setIsNameSaved(true);
    }

    const savedStartup = localStorage.getItem("launchAtStartup") === "true";
    setLaunchAtStartup(savedStartup);
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
          return `🕘 ${n.time} în zilele: ${zile}`;
        }).join("\n");
        setNotificationSummary(`${name}, ai setat notificări pentru:\n${descrieri}`);
      } else {
        setNotificationSummary('');
      }
    }
  }, [notifications, name]);

  useEffect(() => {
    const interval = setInterval(() => {
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
    }, 60000);

    return () => clearInterval(interval);
  }, [notifications]);

  useEffect(() => {
    if (!window.electronAPI?.onPopupStatus) return;

    const handlePopup = (status) => {
      if (!name) return;
      saveStatus(status);
    };

    window.electronAPI.onPopupStatus(handlePopup);
    return () => {
      window.electronAPI.removePopupStatus?.(handlePopup);
    };
  }, [name]);

  const saveNotificationSettings = (username, settings) => {
    const current = JSON.parse(localStorage.getItem("notificationSettings")) || {};
    current[username] = settings;
    localStorage.setItem("notificationSettings", JSON.stringify(current));
  };

  const loadNotificationSettings = (username) => {
    const current = JSON.parse(localStorage.getItem("notificationSettings")) || {};
    return current[username] || [];
  };

  const updateNotificationSettingsName = (oldUsername, newUsername) => {
    const settings = JSON.parse(localStorage.getItem("notificationSettings")) || {};
    if (settings[oldUsername]) {
      settings[newUsername] = settings[oldUsername];
      delete settings[oldUsername];
      localStorage.setItem("notificationSettings", JSON.stringify(settings));
    }
  };

  const saveStatus = (status) => {
    if (!name) {
      alert("Te rog completează numele înainte de a confirma statusul.");
      return;
    }

    const userRef = ref(database, `statuses/${name}`);
    set(userRef, {
      date: tomorrowDate,
      status,
      updatedAt: Date.now()
    })
      .then(() => {
        setStatusMessage(
          status
            ? `${name} a confirmat că vine mâine la birou.`
            : `${name} a confirmat că NU vine mâine la birou.`
        );
        setStatusColor(status ? 'green' : 'red');
      })
      .catch((error) => {
        console.error("Eroare la salvare:", error);
        setStatusMessage("A apărut o eroare la salvarea statusului.");
        setStatusColor('gray');
      });
  };

  const handleSaveName = async () => {
    if (!name) {
      alert("Completează un nume.");
      return;
    }

    if (oldName && oldName !== name) {
      try {
        const oldUserRef = ref(database, `statuses/${oldName}`);
        const snapshot = await get(oldUserRef);
        if (snapshot.exists()) {
          const oldData = snapshot.val();
          const newUserRef = ref(database, `statuses/${name}`);
          await set(newUserRef, oldData);
          await remove(oldUserRef);
          setStatusMessage(`${name} a preluat statusul de la ${oldName}.`);
          setStatusColor('blue');
        }
        updateNotificationSettingsName(oldName, name);
      } catch (err) {
        console.error("Eroare la mutarea statusului:", err);
        setStatusMessage("A apărut o eroare la mutarea statusului vechi.");
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

  const handleStartupToggle = (e) => {
    const isChecked = e.target.checked;
    setLaunchAtStartup(isChecked);
    localStorage.setItem("launchAtStartup", isChecked);
    if (window?.electronAPI?.setStartup) {
      window.electronAPI.setStartup(isChecked);
    }
  };

  const addNotification = () => {
    setNotifications([...notifications, { time: "", days: [] }]);
  };

  const deleteNotification = (index) => {
    const updated = [...notifications];
    updated.splice(index, 1);
    setNotifications(updated);
  };

  return (
    <div className="container" style={{ display: "flex", justifyContent: "center" }}>
      <div className="window-controls">
        <button onClick={() => window.electronAPI.minimize()}>➖</button>
        <button onClick={() => window.electronAPI.close()} className="close">❌</button>
      </div>

      <div style={{ maxWidth: "700px", width: "100%" }}>
        <h1>Office or Home Office</h1>

        {!isNameSaved ? (
          <div style={{ marginBottom: "1rem" }}>
            <input
              type="text"
              placeholder="Numele tău"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button className="primary" onClick={handleSaveName} style={{ marginLeft: "1rem" }}>
              Salvează numele
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", marginBottom: "1rem", gap: "1rem" }}>
            <p><strong>Nume:</strong> {name}</p>
            <button className="secondary" onClick={handleEditName}>Edit Name</button>
            {/* ✅ checkbox startup */}
            <label style={{ display: "flex", alignItems: "center", gap: "0.3rem", color: "#fff" }}>
              <input type="checkbox" checked={launchAtStartup} onChange={handleStartupToggle} />
              Pornește la startup
            </label>
          </div>
        )}

        <div className="action-buttons" style={{ marginBottom: "2rem" }}>
          <button className="primary" style={{ backgroundColor: "green", marginRight: "1rem" }} onClick={() => saveStatus(true)}>Vin mâine</button>
          <button className="primary" style={{ backgroundColor: "red" }} onClick={() => saveStatus(false)}>Nu vin mâine</button>
        </div>

        {notificationSummary && (
          <div className="notification-card" style={{ whiteSpace: "pre-line", color: "#2e7d32" }}>
            {notificationSummary}
          </div>
        )}

        <div style={{ marginBottom: "2rem" }}>
          <div className="accordion-header" onClick={() => setShowNotifications(!showNotifications)}>
            Push-up notifications {showNotifications ? "▲" : "▼"}
          </div>

          {showNotifications && (
            <div style={{ marginTop: "1rem" }}>
              {notifications.map((n, index) => (
                <div key={index} className="notification-card" style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                  <input
                    type="time"
                    value={n.time}
                    onChange={(e) => {
                      const newNotifications = [...notifications];
                      newNotifications[index].time = e.target.value;
                      setNotifications(newNotifications);
                    }}
                  />
                  <span>Zile:</span>
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
                    title="Șterge notificarea"
                    style={{ fontSize: "1.2rem", marginLeft: "auto" }}
                  >
                    ❌
                  </button>
                </div>
              ))}
              <button className="primary" onClick={addNotification} style={{ marginTop: "1rem" }}>
                + Adaugă notificare
              </button>
            </div>
          )}
        </div>

        {statusMessage && (
          <div style={{ color: statusColor, marginTop: '10px' }}>
            {statusMessage}
          </div>
        )}

        <h2>Status pentru {tomorrowDate}</h2>
        <ul style={{ listStyle: "none", padding: 0 }}>
          {Object.entries(statuses)
            .filter(([_, v]) => v.date === tomorrowDate)
            .map(([user, data]) => (
              <li
                key={user}
                className={`status-card ${data.status ? "status-true" : "status-false"}`}
              >
                <strong>{user}</strong>
                <span>{data.status ? "Vine" : "Nu vine"}</span>
              </li>
            ))}
        </ul>
      </div>
    </div>
  );
}

export default App;
