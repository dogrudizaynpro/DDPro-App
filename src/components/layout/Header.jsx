import SearchBar from "../common/SearchBar.jsx";
import SystemStatus from "../common/SystemStatus.jsx";

export default function Header({
  currentModule,
  commandQuery,
  onCommandChange,
  onCommandSubmit,
  filteredCount,
  totalCount,
  systemStatusItems,
  logoSrc,
}) {
  return (
    <header className="workspace-header">
      <div className="header-top">
        <div className="brand-area">
          <div className="brand-logo" aria-hidden="true">
            {logoSrc ? <img src={logoSrc} alt="" /> : <span>DD</span>}
          </div>

          <div className="brand-content">
            <strong>DOĞRU DİZAYN PRO</strong>
            <span>MASTER DDPRO Kurumsal Kontrol Arayüzü</span>
          </div>
        </div>

        <div className="header-module-meta">
          <span className={`availability-badge ${currentModule.statusTone}`}>
            {currentModule.availabilityLabel}
          </span>
          <strong>{currentModule.title}</strong>
        </div>
      </div>

      <div className="header-bottom">
        <SearchBar
          value={commandQuery}
          onChange={onCommandChange}
          onSubmit={onCommandSubmit}
          filteredCount={filteredCount}
          totalCount={totalCount}
        />

        <SystemStatus items={systemStatusItems} compact />
      </div>
    </header>
  );
}
