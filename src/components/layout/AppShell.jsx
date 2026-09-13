export default function AppShell({ sidebar, header, footer, children }) {
  return (
    <div className="ddpro-app">
      <div className="app-layout">
        {sidebar}
        <div className="workspace">
          {header}
          <main className="main-content">{children}</main>
          {footer}
        </div>
      </div>
    </div>
  );
}
