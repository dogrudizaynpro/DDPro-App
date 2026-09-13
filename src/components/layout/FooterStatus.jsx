const TONE_PREFIX = {
  success: "●",
  warning: "▲",
  info: "◌",
  neutral: "—",
  muted: "○",
  silver: "◈",
  emerald: "●",
};

export default function FooterStatus({ items }) {
  return (
    <footer className="status-footer">
      {items.map((item) => (
        <div className="status-footer-item" key={item.label}>
          <span>{item.label}</span>
          <strong className={`tone-${item.tone}`}>
            <b aria-hidden="true">{TONE_PREFIX[item.tone] || "•"}</b>
            {item.value}
          </strong>
        </div>
      ))}
    </footer>
  );
}
