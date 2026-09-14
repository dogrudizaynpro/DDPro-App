import AppSidebar from "./AppSidebar.jsx";
import AppTopHeader from "./AppTopHeader.jsx";

function AppShell({
  activeModule,
  currentModule,
  headerStatusTone,
  headerStatusLabel,
  notificationCount,
  globalSearch,
  onGlobalSearchChange,
  sidebarItems,
  onNavigate,
  isSidebarOpen,
  setIsSidebarOpen,
  children,
}) {
  return (
    <div className="ddpro-app premium-shell">
      <AppTopHeader
        headerStatusTone={headerStatusTone}
        headerStatusLabel={headerStatusLabel}
        notificationCount={notificationCount}
        globalSearch={globalSearch}
        onGlobalSearchChange={onGlobalSearchChange}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
      />

      <div className="app-layout">
        <AppSidebar
          sidebarItems={sidebarItems}
          activeModule={activeModule}
          onNavigate={onNavigate}
          isSidebarOpen={isSidebarOpen}
          setIsSidebarOpen={setIsSidebarOpen}
        />

        <main className="main-content">
          <section className="content-header premium-content-header">
            <div>
              <h1>{currentModule.title}</h1>
              <p>{currentModule.description}</p>
            </div>
          </section>

          <section className="content-body">{children}</section>
        </main>
      </div>
    </div>
  );
}

export default AppShell;
