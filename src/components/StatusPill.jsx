export default function StatusPill({ tone = 'neutral', children, className = '' }) {
  return (
    <span className={`workflow-status-pill ${tone}${className ? ` ${className}` : ''}`}>
      {children}
    </span>
  );
}
