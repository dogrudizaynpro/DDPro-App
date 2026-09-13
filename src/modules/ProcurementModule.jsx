function ProcurementModule({
  showProcurementForm,
  setShowProcurementForm,
  createProcurement,
  procurementName,
  setProcurementName,
  procurementNote,
  setProcurementNote,
  procurementError,
  procurementLoading,
  procurementItems,
  deleteProcurement,
}) {
  return (
    <div className="module-page">
      <div className="module-toolbar">
        <button
          type="button"
          onClick={() => setShowProcurementForm((value) => !value)}
        >
          {showProcurementForm ? "Formu Kapat" : "+ Yeni Tedarik Kaydı"}
        </button>
      </div>

      {showProcurementForm && (
        <form className="data-form" onSubmit={createProcurement}>
          <input
            type="text"
            placeholder="Tedarik başlığı"
            value={procurementName}
            onChange={(event) => setProcurementName(event.target.value)}
          />

          <textarea
            placeholder="Tedarik notu"
            value={procurementNote}
            onChange={(event) => setProcurementNote(event.target.value)}
          />

          <button type="submit">Kaydet</button>
        </form>
      )}

      {procurementError && (
        <p className="empty-state" style={{ color: "#f59e0b" }}>
          ⚠ {procurementError}
        </p>
      )}

      <div className="data-list">
        {procurementLoading ? (
          <p className="empty-state">Tedarik kayıtları yükleniyor…</p>
        ) : procurementItems.length === 0 ? (
          <p className="empty-state">Henüz veri bulunmuyor.</p>
        ) : (
          procurementItems.map((item) => (
            <div className="data-card" key={item.id}>
              <div>
                <h3>{item.name}</h3>
                <p>{item.note}</p>
                <small>{item.date}</small>
              </div>

              <button
                type="button"
                onClick={() => deleteProcurement(item.id)}
              >
                Sil
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default ProcurementModule;
