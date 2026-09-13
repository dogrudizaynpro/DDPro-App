export default function EmptyState({ children, className = '' }) {
  return <div className={`empty-state-block${className ? ` ${className}` : ''}`}>{children}</div>;
}
