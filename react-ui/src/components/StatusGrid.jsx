import StatusCard from './StatusCard';
import './StatusGrid.css';

function StatusGrid({ statuses, tomorrowDate, nextWorkingDayName }) {
  const tomorrowStatuses = Object.entries(statuses).filter(([_, v]) => v.date === tomorrowDate);

  return (
    <div className="status-section">
      <h2 className="status-title-draggable">
        <span className="status-title-text">Status for {nextWorkingDayName} ({tomorrowDate})</span>
      </h2>
      <div className="status-grid">
        {tomorrowStatuses.map(([user, data]) => (
          <StatusCard 
            key={user} 
            user={user} 
            status={data.status} 
          />
        ))}
      </div>
    </div>
  );
}

export default StatusGrid;
