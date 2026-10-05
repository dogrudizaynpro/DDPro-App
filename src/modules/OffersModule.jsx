import { useEffect, useState } from "react";
import { getCrmContacts } from "../services/operations-integrations.service.js";
import { getCatalogRecords } from "../services/catalog.service.js";

function OffersModule({
  offersFetchState,
  offersLoading,
  onOffersReload,
  showOfferForm,
  setShowOfferForm,
  offersError,
  offers,
  createOffer,
  offerName,
  setOfferName,
  offerAmount,
  setOfferAmount,
  offerStatus,
  setOfferStatus,
  selectedOfferId,
  setSelectedOfferId,
  deleteOffer,
  selectedOfferDetail,
  offerDetailLoading,
  offerDetailError,
  getOfferStatusTone,
  canUseLocalFallback,
  projects = [],
}) {
  const [crmContacts, setCrmContacts] = useState([]);
  const [catalogOptions, setCatalogOptions] = useState({ systems: [], products: [], material: [] });
  const [editingOfferId, setEditingOfferId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [crmContactId, setCrmContactId] = useState("");
  const [systemId, setSystemId] = useState("");
  const [productId, setProductId] = useState("");
  const [materialAnalysisId, setMaterialAnalysisId] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let active = true;
    getCrmContacts()
      .then((response) => {
        if (active) setCrmContacts(response.data || []);
      })
      .catch(() => {
        if (active) setCrmContacts([]);
      });
    Promise.allSettled([
      getCatalogRecords("systems"),
      getCatalogRecords("products"),
      getCatalogRecords("material-analysis"),
    ]).then(([systems, products, material]) => {
      if (active) {
        setCatalogOptions({
          systems: systems.status === "fulfilled" ? systems.value : [],
          products: products.status === "fulfilled" ? products.value : [],
          material: material.status === "fulfilled" ? material.value : [],
        });
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const startEditing = (offer) => {
    if (!offer || offer.source !== "api") return;
    setEditingOfferId(offer.id);
    setOfferName(offer.title || "");
    setOfferAmount(offer.amount === "Tutar belirtilmedi" ? "" : String(offer.amount ?? ""));
    setOfferStatus(offer.statusRaw || offer.status || "Hazırlanıyor");
    setProjectId(offer.projectId || "");
    setCrmContactId(offer.crmContactId || "");
    setSystemId(offer.systemId || "");
    setProductId(offer.productId || "");
    setMaterialAnalysisId(offer.materialAnalysisId || "");
    setShowOfferForm(true);
  };
  const handleOfferSubmit = async (event) => {
    setSaving(true);
    try {
      await createOffer(event);
      setEditingOfferId("");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="module-page">
      <div className="module-toolbar">
        <div className="offers-toolbar-actions">
          <span className={`offers-status-pill ${offersFetchState}`}>
            {offersFetchState === "loading" && "API yükleniyor"}
            {offersFetchState === "success" && "API bağlı"}
            {offersFetchState === "empty" && "API boş veri döndü"}
            {offersFetchState === "warning" && "Yerel fallback"}
            {offersFetchState === "error" && "API bağlantı hatası"}
          </span>

          <button
            type="button"
            className="secondary-button"
            disabled={offersLoading}
            onClick={onOffersReload}
          >
            {offersLoading ? "Yenileniyor..." : "Yenile"}
          </button>

          <button
            type="button"
            onClick={() => {
              setEditingOfferId("");
              setOfferName("");
              setOfferAmount("");
              setOfferStatus("Hazırlanıyor");
              setProjectId("");
              setCrmContactId("");
              setSystemId("");
              setProductId("");
              setMaterialAnalysisId("");
              setShowOfferForm((value) => !value);
            }}
          >
            {showOfferForm ? "Formu Kapat" : "+ Yeni Teklif"}
          </button>
        </div>
      </div>

      {offersError && (
        <p className="status-banner warning">
          ⚠ {offersError}
        </p>
      )}

      {!offersError && offersFetchState === "empty" && (
        <p className="status-banner info">
          ℹ API üzerinde henüz teklif bulunmuyor
          {canUseLocalFallback && offers.some((offer) => offer.source === "local")
            ? ", kayıtlı yerel taslaklar listeleniyor."
            : "."}
        </p>
      )}

      {showOfferForm && (
        <form className="data-form" onSubmit={handleOfferSubmit}>
          {editingOfferId ? <input type="hidden" name="offerId" value={editingOfferId} readOnly /> : null}
          <h2>{editingOfferId ? "Teklifi düzenle" : "Yeni teklif"}</h2>
          <input
            type="text"
            placeholder="Teklif adı"
            value={offerName}
            onChange={(event) => setOfferName(event.target.value)}
          />

          <input
            type="text"
            placeholder="Teklif tutarı"
            value={offerAmount}
            onChange={(event) => setOfferAmount(event.target.value)}
          />
          <label>İlgili proje
            <select name="projectId" value={projectId} onChange={(event) => setProjectId(event.target.value)}>
              <option value="">Proje seçin</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
          </label>
          <label>İlgili CRM müşterisi
            <select name="crmContactId" value={crmContactId} onChange={(event) => setCrmContactId(event.target.value)}>
              <option value="">Müşteri seçin</option>
              {crmContacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name}</option>)}
            </select>
          </label>
          <label>Sistem
            <select name="systemId" value={systemId} onChange={(event) => setSystemId(event.target.value)}>
              <option value="">Sistem seçin</option>
              {catalogOptions.systems.map((system) => <option key={system.id} value={system.id}>{system.name}</option>)}
            </select>
          </label>
          <label>Ürün
            <select name="productId" value={productId} onChange={(event) => setProductId(event.target.value)}>
              <option value="">Ürün seçin</option>
              {catalogOptions.products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
            </select>
          </label>
          <label>Malzeme maliyet snapshot'ı
            <select name="materialAnalysisId" value={materialAnalysisId} onChange={(event) => setMaterialAnalysisId(event.target.value)}>
              <option value="">Malzeme analizi seçin</option>
              {catalogOptions.material.map((record) => (
                <option key={record.id} value={record.id}>
                  {record.name} · {record.verification_status}{record.total_cost == null ? "" : ` · ${record.currency} ${record.total_cost}`}
                </option>
              ))}
            </select>
          </label>
          {!crmContacts.length ? <small>CRM müşteri seçimi için Google yetkili oturumu gerekir.</small> : null}

          <select
            value={offerStatus}
            onChange={(event) => setOfferStatus(event.target.value)}
            disabled={!editingOfferId}
          >
            <option>Hazırlanıyor</option>
            <option>Gönderildi</option>
            <option>Onaylandı</option>
            <option>Reddedildi</option>
          </select>

          <button type="submit" disabled={saving}>{saving ? "Kaydediliyor…" : editingOfferId ? "Teklif değişikliklerini kaydet" : "Teklifi Kaydet"}</button>

          {canUseLocalFallback ? (
            <p className="form-hint">
              API hata verirse geliştirme ortamında yerel taslak korunur.
            </p>
          ) : null}
        </form>
      )}

      <div className="offers-summary-grid">
        <div className="offer-summary-card">
          <span>Toplam Teklif</span>
          <strong>{offers.length}</strong>
        </div>

        <div className="offer-summary-card">
          <span>API Kayıtları</span>
          <strong>
            {offers.filter((offer) => offer.source === "api").length}
          </strong>
        </div>

        <div className="offer-summary-card">
          <span>Onaylanan</span>
          <strong>
            {offers.filter((offer) => offer.status === "Onaylandı").length}
          </strong>
        </div>

        <div className="offer-summary-card">
          <span>Yerel Taslak</span>
          <strong>
            {offers.filter((offer) => offer.source === "local").length}
          </strong>
        </div>
      </div>

      <div className="offers-layout">
        <div className="panel">
          <div className="panel-header">
            <h2>Teklif Listesi</h2>
            <span className="panel-meta">{offers.length} kayıt</span>
          </div>

          <div className="panel-content">
            {offersLoading ? (
              <p className="empty-state">Teklifler yükleniyor…</p>
            ) : offers.length === 0 ? (
              <p className="empty-state">Henüz veri bulunmuyor.</p>
            ) : (
              <div className="offers-list">
                {offers.map((offer) => (
                  <article
                    className={`offer-card${
                      offer.id === selectedOfferId ? " selected" : ""
                    }`}
                    key={offer.id}
                  >
                    <div className="offer-card-top">
                      <div>
                        <h3>{offer.title}</h3>
                        <p className="offer-amount">{offer.amountDisplay}</p>
                      </div>

                      <span
                        className={`offer-status-badge ${getOfferStatusTone(
                          offer.status
                        )}`}
                      >
                        {offer.status}
                      </span>
                    </div>

                    <div className="offer-meta-row">
                      <span>{offer.date}</span>
                      <span>
                        {offer.source === "api"
                          ? "Canlı API"
                          : "Yerel taslak"}
                      </span>
                    </div>

                    <div className="offer-card-actions">
                      <button
                        type="button"
                        className="offer-secondary-button"
                        onClick={() => setSelectedOfferId(offer.id)}
                      >
                        Detay
                      </button>

                      <button
                        type="button"
                        onClick={() => deleteOffer(offer.id)}
                      >
                        {offer.source === "local" ? "Sil" : "Listeden Kaldır"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="panel offer-detail-panel">
          <div className="panel-header">
            <h2>Teklif Detayı</h2>
            {selectedOfferDetail && (
              <span className="panel-meta">
                {selectedOfferDetail.source === "api"
                  ? "API detayı"
                  : "Taslak detay"}
              </span>
            )}
          </div>

          <div className="panel-content">
            {offersLoading ? (
              <p className="empty-state">Detay alanı hazırlanıyor…</p>
            ) : !selectedOfferDetail ? (
              <p className="empty-state">
                Detayları görmek için bir teklif seç.
              </p>
            ) : offerDetailLoading ? (
              <p className="empty-state">Teklif detayı yükleniyor…</p>
            ) : (
              <div className="offer-detail-content">
                <div className="offer-detail-header">
                  <div>
                    <h3>{selectedOfferDetail.title}</h3>
                    <p>{selectedOfferDetail.amountDisplay}</p>
                  </div>

                  <span
                    className={`offer-status-badge ${getOfferStatusTone(
                      selectedOfferDetail.status
                    )}`}
                  >
                    {selectedOfferDetail.status}
                  </span>
                </div>

                {offerDetailError && (
                  <p className="status-banner warning">{offerDetailError}</p>
                )}

                <div className="offer-detail-grid">
                  <div className="offer-detail-item">
                    <span>Kaynak</span>
                    <strong>
                      {selectedOfferDetail.source === "api"
                        ? "Teklifler API"
                        : "Yerel taslak"}
                    </strong>
                  </div>

                  <div className="offer-detail-item">
                    <span>Teklif Tarihi</span>
                    <strong>{selectedOfferDetail.date}</strong>
                  </div>

                  <div className="offer-detail-item">
                    <span>Para Birimi</span>
                    <strong>
                      {selectedOfferDetail.currency || "Belirtilmedi"}
                    </strong>
                  </div>

                  <div className="offer-detail-item">
                    <span>Proje Bağlantısı</span>
                    <strong>
                      {projects.find((project) => project.id === selectedOfferDetail.projectId)?.name || selectedOfferDetail.projectId || "Atanmadı"}
                    </strong>
                  </div>
                  <div className="offer-detail-item">
                    <span>CRM Müşteri</span>
                    <strong>{crmContacts.find((contact) => contact.id === selectedOfferDetail.crmContactId)?.name || selectedOfferDetail.crmContactId || "Atanmadı"}</strong>
                  </div>
                </div>

                <div className="offer-detail-note">
                  <strong>Detay görünümü hazır</strong>
                  <p>
                    Teklif seçildiğinde temel alanlar ve API detay sorgusu bu
                    panelde yönetilir.
                  </p>
                </div>
                {selectedOfferDetail.source === "api" ? (
                  <button type="button" onClick={() => startEditing(selectedOfferDetail)}>Teklifi düzenle</button>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default OffersModule;
