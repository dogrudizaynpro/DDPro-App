import EmptyState from "../common/EmptyState.jsx";

const OFFER_STATUS_TONES = {
  Hazırlanıyor: "pending",
  Gönderildi: "info",
  Onaylandı: "success",
  Reddedildi: "danger",
};

const getOfferStatusTone = (status) => OFFER_STATUS_TONES[status] || "neutral";

export default function OffersModule({
  offers,
  loading,
  error,
  fetchState,
  showForm,
  onToggleForm,
  onReload,
  onSubmit,
  onDelete,
  offerName,
  onOfferNameChange,
  offerAmount,
  onOfferAmountChange,
  offerStatus,
  onOfferStatusChange,
  selectedOfferId,
  onSelectOffer,
  selectedOfferDetail,
  offerDetailLoading,
  offerDetailError,
}) {
  return (
    <div className="module-page">
      <div className="module-toolbar">
        <div className="offers-toolbar-actions">
          <span className={`offers-status-pill ${fetchState}`}>
            {fetchState === "loading" && "API yükleniyor"}
            {fetchState === "success" && "API bağlı"}
            {fetchState === "empty" && "API boş veri döndü"}
            {fetchState === "error" && "API bağlantı hatası"}
          </span>

          <button
            type="button"
            className="secondary-button"
            disabled={loading}
            onClick={onReload}
          >
            {loading ? "Yenileniyor..." : "Yenile"}
          </button>

          <button type="button" onClick={onToggleForm}>
            {showForm ? "Formu Kapat" : "+ Yeni Teklif"}
          </button>
        </div>
      </div>

      {error ? <p className="status-banner warning">⚠ {error}</p> : null}

      {!error && fetchState === "empty" ? (
        <p className="status-banner info">
          ℹ API üzerinde henüz teklif bulunmuyor
          {offers.some((offer) => offer.source === "local")
            ? ", kayıtlı yerel taslaklar listeleniyor."
            : "."}
        </p>
      ) : null}

      {showForm ? (
        <form className="data-form" onSubmit={onSubmit}>
          <input
            type="text"
            placeholder="Teklif adı"
            value={offerName}
            onChange={(event) => onOfferNameChange(event.target.value)}
          />

          <input
            type="text"
            placeholder="Teklif tutarı"
            value={offerAmount}
            onChange={(event) => onOfferAmountChange(event.target.value)}
          />

          <select
            value={offerStatus}
            onChange={(event) => onOfferStatusChange(event.target.value)}
          >
            <option>Hazırlanıyor</option>
            <option>Gönderildi</option>
            <option>Onaylandı</option>
            <option>Reddedildi</option>
          </select>

          <button type="submit">Teklifi Kaydet</button>

          <p className="form-hint">
            Yeni kayıtlar API başarısız olursa yerel taslak olarak korunur.
          </p>
        </form>
      ) : null}

      <div className="offers-summary-grid">
        <div className="offer-summary-card">
          <span>Toplam Teklif</span>
          <strong>{offers.length}</strong>
        </div>
        <div className="offer-summary-card">
          <span>API Kayıtları</span>
          <strong>{offers.filter((offer) => offer.source === "api").length}</strong>
        </div>
        <div className="offer-summary-card">
          <span>Onaylanan</span>
          <strong>{offers.filter((offer) => offer.status === "Onaylandı").length}</strong>
        </div>
        <div className="offer-summary-card">
          <span>Yerel Taslak</span>
          <strong>{offers.filter((offer) => offer.source === "local").length}</strong>
        </div>
      </div>

      <div className="offers-layout">
        <section className="panel">
          <div className="panel-header">
            <h2>Teklif Listesi</h2>
            <span className="panel-meta">{offers.length} kayıt</span>
          </div>

          <div className="panel-content">
            {loading ? (
              <EmptyState
                title="Teklifler yükleniyor"
                description="Teklif listesi ve kaynak durumu hazırlanıyor."
                badge="Canlı modül"
              />
            ) : offers.length === 0 ? (
              <EmptyState
                title="Henüz teklif kaydı bulunmuyor"
                description="API veya yerel taslaklar geldiğinde teklif kartları burada listelenir."
                badge="Hazır"
              />
            ) : (
              <div className="offers-list">
                {offers.map((offer) => (
                  <article
                    className={`offer-card${offer.id === selectedOfferId ? " selected" : ""}`}
                    key={offer.id}
                  >
                    <div className="offer-card-top">
                      <div>
                        <h3>{offer.title}</h3>
                        <p className="offer-amount">{offer.amountDisplay}</p>
                      </div>

                      <span
                        className={`offer-status-badge ${getOfferStatusTone(offer.status)}`}
                      >
                        {offer.status}
                      </span>
                    </div>

                    <div className="offer-meta-row">
                      <span>{offer.date}</span>
                      <span>{offer.source === "api" ? "Canlı API" : "Yerel taslak"}</span>
                    </div>

                    <div className="offer-card-actions">
                      <button
                        type="button"
                        className="offer-secondary-button"
                        onClick={() => onSelectOffer(offer.id)}
                      >
                        Detay
                      </button>

                      <button type="button" onClick={() => onDelete(offer.id)}>
                        {offer.source === "local" ? "Sil" : "Listeden Kaldır"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="panel offer-detail-panel">
          <div className="panel-header">
            <h2>Teklif Detayı</h2>
            {selectedOfferDetail ? (
              <span className="panel-meta">
                {selectedOfferDetail.source === "api" ? "API detayı" : "Taslak detay"}
              </span>
            ) : null}
          </div>

          <div className="panel-content">
            {!selectedOfferDetail && loading ? (
              <EmptyState
                title="Detay alanı hazırlanıyor"
                description="Teklif verileri geldikten sonra detay paneli aktif olur."
                badge="Bekleniyor"
              />
            ) : !selectedOfferDetail ? (
              <EmptyState
                title="Detay seçilmedi"
                description="Detayları görmek için listeden bir teklif seç."
                badge="Seçim gerekli"
              />
            ) : offerDetailLoading ? (
              <EmptyState
                title="Teklif detayı yükleniyor"
                description="Seçili teklifin ayrıntıları sorgulanıyor."
                badge="İstek sürüyor"
              />
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

                {offerDetailError ? (
                  <p className="status-banner warning">{offerDetailError}</p>
                ) : null}

                <div className="offer-detail-grid">
                  <div className="offer-detail-item">
                    <span>Kaynak</span>
                    <strong>
                      {selectedOfferDetail.source === "api" ? "Teklifler API" : "Yerel taslak"}
                    </strong>
                  </div>

                  <div className="offer-detail-item">
                    <span>Teklif Tarihi</span>
                    <strong>{selectedOfferDetail.date}</strong>
                  </div>

                  <div className="offer-detail-item">
                    <span>Para Birimi</span>
                    <strong>{selectedOfferDetail.currency || "Belirtilmedi"}</strong>
                  </div>

                  <div className="offer-detail-item">
                    <span>Proje Bağlantısı</span>
                    <strong>{selectedOfferDetail.projectId || "Atanmadı"}</strong>
                  </div>
                </div>

                <div className="offer-detail-note">
                  <strong>Detay paneli aktif</strong>
                  <p>
                    Canlı veya yerel tekliflerin temel alanları bu panelde izlenir; eksik servisler
                    tamamlanmış gibi sunulmaz.
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
