export default function FooterStatus({ items }) {
  return (
    <footer className="status-footer">
      {items.map((item) => (
        <div className="status-footer-item" key={item.label}>
          <span>{item.label}</span>
          <strong className={`tone-${item.tone}`}>{item.value}</strong>
        </div>
      ))}
    </footer>
  );
}
