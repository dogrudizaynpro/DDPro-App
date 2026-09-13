export default function SummaryCard({ label, value, caption }) {
  return (
    <div className="workflow-summary-card">
      <span>{label}</span>
      <strong>{value}</strong>
      {caption ? <small>{caption}</small> : null}
    </div>
  );
}
