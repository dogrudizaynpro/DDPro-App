function SkeletonModule({ title, description, sections, statusNote }) {
  return (
    <div className="module-page">
      <div className="panel">
        <div className="panel-header">
          <h2>{title}</h2>
        </div>
        <div className="panel-content">
          <p className="module-intro">{description}</p>
          {statusNote ? (
            <p className={`status-banner ${statusNote.tone || "info"}`}>
              {statusNote.message}
            </p>
          ) : null}
        </div>
      </div>

      <div className="skeleton-grid">
        {sections.map((section) => (
          <article className="skeleton-card" key={section.id}>
            <h3>{section.title}</h3>
            <p>{section.description}</p>
            {section.status === "loading" ? (
              <p className="empty-state compact">Veriler yükleniyor…</p>
            ) : section.status === "error" ? (
              <p className="status-banner warning">Veriler yüklenemedi; kayıt sayısı doğrulanamadı.</p>
            ) : section.count > 0 ? (
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
