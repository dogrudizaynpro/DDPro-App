import { useState } from "react";
import { runResearchAgent } from "../services/research.service.js";

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
  saveResearchResult,
  projects = [],
}) {
  const [researchQuery, setResearchQuery] = useState("");
  const [researchResults, setResearchResults] = useState([]);
  const [researchError, setResearchError] = useState("");
  const [researchLoading, setResearchLoading] = useState(false);
  const [researchProjectId, setResearchProjectId] = useState("");

  const searchResearch = async (event) => {
    event.preventDefault();
    if (!researchQuery.trim()) return;
    setResearchLoading(true);
    setResearchError("");
    setResearchResults([]);
    try {
      setResearchResults(await runResearchAgent(researchQuery.trim()));
    } catch (error) {
      setResearchError(error.message || "Araştırma sağlayıcısına erişilemedi.");
    } finally {
      setResearchLoading(false);
    }
  };

  return (
    <div className="module-page">
      <form className="data-form" onSubmit={searchResearch}>
        <h2>Harici web araştırması</h2>
        <p className="status-banner info">Sağlayıcı bağlı değilse sonuç üretilmez. Dönen fiyatlar kullanıcı tarafından doğrulanana kadar doğrulanmamış kabul edilir.</p>
        <input
          type="search"
          value={researchQuery}
          onChange={(event) => setResearchQuery(event.target.value)}
          placeholder="Ürün, üretici veya teknik özellik ara"
          maxLength={500}
          required
        />
        <label>İlgili proje<select value={researchProjectId} onChange={(event) => setResearchProjectId(event.target.value)}><option value="">Proje bağla (isteğe bağlı)</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
        <button type="submit" disabled={researchLoading}>
          {researchLoading ? "Araştırılıyor…" : "Gerçek sağlayıcıda ara"}
        </button>
      </form>
      {researchError ? <p className="status-banner warning">Araştırma başlatılamadı: {researchError}</p> : null}
      {researchResults.map((result, index) => (
        <article className="data-card" key={`${result.url}-${index}`}>
          <div>
            <h3>{result.product || "Adsız ürün"}</h3>
            <p>{[result.manufacturer, result.source].filter(Boolean).join(" · ")}</p>
            {result.technicalInfo ? <p>{result.technicalInfo}</p> : null}
            {result.price ? <p>Kaynakta görünen fiyat: {result.price} · Doğrulanmadı</p> : null}
            {/^https?:\/\//i.test(result.url || "") ? <p><a href={result.url} target="_blank" rel="noopener noreferrer">Kaynağı aç ↗</a></p> : null}
            <small>{result.date} · {result.status}</small>
          </div>
          <button type="button" onClick={() => saveResearchResult({ ...result, projectId: researchProjectId })}>Araştırma kaydına ekle</button>
        </article>
      ))}

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
          <label>İlgili proje<select name="projectId" defaultValue=""><option value="">Proje seçin</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
          <input name="productId" type="text" placeholder="Ürün UUID (varsa)" />
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
