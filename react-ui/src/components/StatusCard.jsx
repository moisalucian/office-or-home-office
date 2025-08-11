import './StatusCard.css';

function StatusCard({ user, status }) {
  let statusClass = 'status-false'; // default
  if (status === 'yes' || status === true) {
    statusClass = 'status-true';
  } else if (status === 'undecided') {
    statusClass = 'status-undecided';
  }
  
  return (
    <div className={`status-card ${statusClass}`}>
      <strong>{user}</strong>
    </div>
  );
}

export default StatusCard;
