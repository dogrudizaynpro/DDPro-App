function SkeletonModule({ title, description, sections }) {
  return (
    <div className="module-page">
      <div className="panel">
        <div className="panel-header">
          <h2>{title}</h2>
        </div>
        <div className="panel-content">
          <p className="module-intro">{description}</p>
        </div>
      </div>

      <div className="skeleton-grid">
        {sections.map((section) => (
          <article className="skeleton-card" key={section.id}>
            <h3>{section.title}</h3>
            <p>{section.description}</p>
            {section.count > 0 ? (
              <small>{section.count} kayıt bulundu.</small>
            ) : (
              <p className="empty-state compact">Henüz veri bulunmuyor.</p>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

export default SkeletonModule;
