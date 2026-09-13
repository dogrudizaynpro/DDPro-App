export default function StatusPill({ tone = 'neutral', children, className = '', live = false }) {
  return (
    <span
      className={`workflow-status-pill ${tone}${className ? ` ${className}` : ''}`}
      role={live ? 'status' : undefined}
      aria-live={live ? 'polite' : undefined}
    >
      {children}
    </span>
  );
}
