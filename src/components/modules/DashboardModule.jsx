import EmptyState from "../common/EmptyState.jsx";
import ModuleCard from "../common/ModuleCard.jsx";
import StatCard from "../common/StatCard.jsx";
import SystemStatus from "../common/SystemStatus.jsx";

export default function DashboardModule({
  stats,
  systemStatusItems,
  recentLogs,
  recentActivities,
  modules,
  quickActions,
  onSelectModule,
}) {
  return (
    <div className="dashboard-module">
      <div className="stats-grid">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      <div className="dashboard-grid">
        <section className="panel panel-span-2">
          <div className="panel-header">
            <div>
              <p className="eyebrow-label">KONTROL KARTLARI</p>
              <h2>Dashboard / kontrol kartları</h2>
            </div>
          </div>

          <div className="module-card-grid">
            {modules.map((module) => (
              <ModuleCard key={module.id} module={module} onSelect={onSelectModule} />
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow-label">SİSTEM DURUMU</p>
              <h2>Canlı modül özeti</h2>
            </div>
          </div>

          <SystemStatus items={systemStatusItems} />
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow-label">YAKLAŞAN İŞLER</p>
              <h2>Öncelikli takip listesi</h2>
            </div>
          </div>

          {recentActivities.length === 0 ? (
            <EmptyState
              title="Takip kaydı bulunmuyor"
              description="Canlı veya yerel iş kayıtları geldikçe bu alanda öncelikli gündem listelenir."
              badge="Hazır"
            />
          ) : (
            <div className="activity-list">
              {recentActivities.map((item) => (
                <article className="activity-card" key={item.id}>
                  <div className="activity-card-top">
                    <strong>{item.title}</strong>
                    <span>{item.section}</span>
                  </div>
                  <p>{item.meta}</p>
                  <small>
                    {item.status} · {item.date}
                  </small>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow-label">SON HAREKETLER</p>
              <h2>Sistem kayıtları</h2>
            </div>
          </div>

          {recentLogs.length === 0 ? (
            <EmptyState
              title="Henüz sistem kaydı yok"
              description="Modül işlemleri gerçekleştikçe son hareketler bu listede görünür."
              badge="Boş"
            />
          ) : (
            <div className="log-list">
              {recentLogs.map((log) => (
                <div className="log-item" key={log.id}>
                  <strong>{log.message}</strong>
                  <small>{log.date}</small>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow-label">HIZLI İŞLEMLER</p>
              <h2>Modül geçişleri</h2>
            </div>
          </div>

          <div className="quick-actions dashboard-actions">
            {quickActions.map((item) => (
              <button key={item.id} type="button" onClick={item.action}>
                <strong>{item.label}</strong>
                <span>{item.description}</span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
