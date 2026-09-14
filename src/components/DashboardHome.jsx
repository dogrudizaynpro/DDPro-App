function DashboardHome({
  apiHealthMessage,
  kpiCards,
  onNavigate,
  activeProjects,
  projectsLoading,
  projectProgressSummary,
  upcomingCalendarItems,
  recentOffers,
  offersLoading,
  procurementItems,
  procurementLoading,
  aiCommandActions,
  getConnectionLabel,
  projectsFetchState,
  offersFetchState,
  procurementFetchState,
}) {
  return (
    <div className="dashboard-module premium-dashboard">
      {apiHealthMessage ? <p className="status-banner warning">{apiHealthMessage}</p> : null}

      <div className="stats-grid kpi-grid">
        {kpiCards.map((card) => (
          <button
            type="button"
            key={card.label}
            className="stat-card kpi-card-button"
            onClick={() => onNavigate(card.moduleId)}
          >
            <span>{card.label}</span>
            <strong>{card.value}</strong>
          </button>
        ))}
      </div>

      <div className="dashboard-grid">
        <div className="panel">
          <div className="panel-header">
            <h2>Aktif Projeler</h2>
          </div>
          <div className="panel-content">
            {projectsLoading ? (
              <p className="empty-state compact">Projeler yükleniyor...</p>
            ) : activeProjects.length === 0 ? (
              <p className="empty-state compact">Aktif proje bulunmuyor.</p>
            ) : (
              <div className="log-list">
                {activeProjects.slice(0, 6).map((project) => (
                  <div className="log-item" key={project.id}>
                    <strong>{project.name}</strong>
                    <small>{project.type || "Proje"} · {project.date || "-"}</small>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h2>Proje İlerleme Durumları</h2>
          </div>
          <div className="panel-content">
            {projectProgressSummary.length === 0 ? (
              <p className="empty-state compact">Henüz durum verisi yok.</p>
            ) : (
              projectProgressSummary.map((item) => (
                <div className="quick-status" key={item.status}>
                  <span>{item.status}</span>
                  <strong>{item.count}</strong>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="panel">
          <div className="panel-header">
            <h2>Yaklaşan Takvim</h2>
          </div>
          <div className="panel-content">
            {upcomingCalendarItems.length === 0 ? (
              <p className="empty-state compact">Yaklaşan kayıt bulunmuyor.</p>
            ) : (
              <div className="log-list">
                {upcomingCalendarItems.map((eventItem) => (
                  <div className="log-item" key={eventItem.id}>
                    <strong>{eventItem.title}</strong>
                    <small>{eventItem.subtitle} · {eventItem.date}</small>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h2>Son Teklifler</h2>
          </div>
          <div className="panel-content">
            {offersLoading ? (
              <p className="empty-state compact">Teklifler yükleniyor...</p>
            ) : recentOffers.length === 0 ? (
              <p className="empty-state compact">Teklif bulunmuyor.</p>
            ) : (
              <div className="log-list">
                {recentOffers.map((offer) => (
                  <div className="log-item" key={offer.id}>
                    <strong>{offer.title || offer.name}</strong>
                    <small>{offer.amountDisplay || offer.amount || "-"} · {offer.status || "-"}</small>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="panel">
          <div className="panel-header">
            <h2>Tedarik / Araştırma Özeti</h2>
          </div>
          <div className="panel-content">
            <div className="quick-status">
              <span>Toplam Kayıt</span>
              <strong>{procurementLoading ? "..." : procurementItems.length}</strong>
            </div>
            {procurementItems.slice(0, 3).map((item) => (
              <div className="quick-status" key={item.id}>
                <span>{item.name}</span>
                <strong>{item.date || "-"}</strong>
              </div>
            ))}
            {!procurementLoading && procurementItems.length === 0 ? (
              <p className="empty-state compact">Kayıt bulunmuyor.</p>
            ) : null}
          </div>
        </div>

        <div className="panel ai-command-panel">
          <div className="panel-header">
            <h2>AI Komuta Merkezi</h2>
          </div>
          <div className="panel-content quick-links-grid">
            {aiCommandActions.map((action) => (
              <button
                key={action.id}
                type="button"
                className="quick-link-card"
                onClick={() => onNavigate(action.moduleId)}
              >
                <strong>{action.label}</strong>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2>Sistem Bağlantı Durumu</h2>
        </div>
        <div className="panel-content">
          <div className="quick-status">
            <span>Projeler API</span>
            <strong>{getConnectionLabel(projectsFetchState)}</strong>
          </div>
          <div className="quick-status">
            <span>Teklifler API</span>
            <strong>{getConnectionLabel(offersFetchState)}</strong>
          </div>
          <div className="quick-status">
            <span>Tedarik API</span>
            <strong>{getConnectionLabel(procurementFetchState)}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardHome;
