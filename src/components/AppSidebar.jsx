function AppSidebar({
  sidebarItems,
  activeModule,
  onNavigate,
  isSidebarOpen,
  setIsSidebarOpen,
}) {
  return (
    <>
      <aside className={`sidebar premium-sidebar ${isSidebarOpen ? "open" : ""}`}>
        <div className="sidebar-title">ANA MODÜLLER</div>

        <nav className="module-nav">
          {sidebarItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`module-button ${activeModule === item.moduleId ? "active" : ""}`}
              onClick={() => onNavigate(item.moduleId)}
            >
              <span className="module-icon">{item.icon}</span>
              <span className="module-text">
                <strong>{item.title}</strong>
                <small>{item.moduleId}</small>
              </span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-system">
            <span className="status-dot"></span>
            DDPro Core v1.1
          </div>
        </div>
      </aside>

      {isSidebarOpen ? (
        <button
          type="button"
          className="sidebar-overlay"
          aria-label="Menüyü kapat"
          onClick={() => setIsSidebarOpen(false)}
        />
      ) : null}
    </>
  );
}

export default AppSidebar;
