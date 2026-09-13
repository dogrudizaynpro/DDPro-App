export default function ProjectCard({
  title,
  subtitle,
  meta,
  badge,
  onDelete,
  actionLabel = "Sil",
}) {
  return (
    <article className="entity-card">
      <div className="entity-card-content">
        <div className="entity-card-top">
          <h3>{title}</h3>
          {badge ? <span className="entity-badge">{badge}</span> : null}
        </div>
        <p>{subtitle}</p>
        <small>{meta}</small>
      </div>

      <button type="button" onClick={onDelete}>
        {actionLabel}
      </button>
    </article>
  );
}
