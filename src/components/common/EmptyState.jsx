export default function EmptyState({
  title,
  description,
  badge,
  actionLabel,
  onAction,
}) {
  return (
    <div className="empty-state-card">
      {badge ? <span className="empty-state-badge">{badge}</span> : null}
      <strong>{title}</strong>
      <p>{description}</p>
      {actionLabel && onAction ? (
        <button type="button" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
