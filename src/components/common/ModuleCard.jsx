export default function ModuleCard({ module, onSelect }) {
  return (
    <article className="module-card">
      <div className="module-card-top">
        <span className="module-card-icon">{module.icon}</span>
        <span className={`availability-badge ${module.statusTone}`}>
          {module.availabilityLabel}
        </span>
      </div>

      <h3>{module.title}</h3>
      <p>{module.description}</p>

      <button type="button" onClick={() => onSelect(module.id)}>
        Modülü Aç
      </button>
    </article>
  );
}
