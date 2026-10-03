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
            name="title"
            placeholder="Tedarik başlığı"
            value={procurementName}
            onChange={(event) => setProcurementName(event.target.value)}
          />

          <textarea
            name="description"
            placeholder="Tedarik notu"
            value={procurementNote}
            onChange={(event) => setProcurementNote(event.target.value)}
          />

          <input name="source" type="text" placeholder="Kaynak" />
          <input name="product" type="text" placeholder="Ürün" />
          <input name="manufacturer" type="text" placeholder="Üretici" />
          <textarea name="technicalInfo" placeholder="Teknik bilgi" />
          <input name="price" type="text" placeholder="Kaynakta görünen fiyat (opsiyonel)" />
          <select name="priceVerification" defaultValue="Doğrulanmadı">
            <option>Doğrulanmadı</option>
            <option>Kullanıcı kaynağı kontrol etti</option>
          </select>
          <input name="url" type="url" placeholder="Kaynak bağlantısı (https://...)" />
          <select name="status" defaultValue="Taslak">
            <option>Taslak</option>
            <option>Araştırılıyor</option>
            <option>Tamamlandı</option>
          </select>

          <button type="submit">Kaydet</button>
        </form>
      )}

      {procurementError && (
        <p className="status-banner warning">⚠ {procurementError}</p>
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
                <p>{[item.product, item.manufacturer, item.source].filter(Boolean).join(" · ")}</p>
                {item.technicalInfo ? <p>{item.technicalInfo}</p> : null}
                {item.price ? <p>Kaynak fiyatı: {item.price} · {item.priceVerification || "Doğrulama durumu bilinmiyor"}</p> : null}
                {/^https?:\/\//i.test(item.url || "") ? <p><a href={item.url} target="_blank" rel="noopener noreferrer">Kaynağı aç ↗</a></p> : null}
                <small>{item.date} · {item.status || "Durum belirtilmedi"}</small>
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
