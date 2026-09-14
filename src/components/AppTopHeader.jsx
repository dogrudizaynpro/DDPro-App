function AppTopHeader({
  headerStatusTone,
  headerStatusLabel,
  notificationCount,
  globalSearch,
  onGlobalSearchChange,
  isSidebarOpen,
  setIsSidebarOpen,
}) {
  return (
    <header className="app-header premium-header">
      <div className="header-left">
        <button
          type="button"
          className="sidebar-toggle"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          aria-label="Menüyü aç"
        >
          ☰
        </button>

        <div className="brand-area">
          <div className="brand-logo">DD</div>

          <div className="brand-content">
            <strong>DOĞRU DİZAYN PRO</strong>
            <span>DDPRO AI Premium Yönetim Arayüzü</span>
          </div>
        </div>
      </div>

      <div className="header-center">
        <input
          type="search"
          value={globalSearch}
          onChange={(event) => onGlobalSearchChange(event.target.value)}
          placeholder="Global arama..."
          aria-label="Global arama"
          className="global-search"
        />
      </div>

      <div className="header-right">
        <div className={`header-status ${headerStatusTone}`}>
          <span className={`status-dot ${headerStatusTone}`}></span>
          {headerStatusLabel}
        </div>

        <div className="header-status info">
          <span className="status-dot"></span>
          AI Durumu: Aktif
        </div>

        <button type="button" className="header-icon-button" aria-label="Bildirimler">
          🔔
          {notificationCount > 0 ? <span className="notification-badge">{notificationCount}</span> : null}
        </button>

        <div className="user-chip" aria-label="Kullanıcı alanı">
          <span>DP</span>
          <small>Yönetici</small>
        </div>
      </div>
    </header>
  );
}

export default AppTopHeader;
