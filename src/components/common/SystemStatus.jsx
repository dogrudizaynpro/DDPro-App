export default function SystemStatus({ items, compact = false }) {
  return (
    <div className={`system-status ${compact ? "compact" : ""}`}>
      {items.map((item) => (
        <div className={`system-status-item tone-${item.tone}`} key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  );
}
