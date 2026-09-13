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
}) {
  return (
    <div className="module-page">
      <div className="module-toolbar">
        <div className="offers-toolbar-actions">
          <span className={`offers-status-pill ${offersFetchState}`}>
            {offersFetchState === "loading" && "API yükleniyor"}
            {offersFetchState === "success" && "API bağlı"}
            {offersFetchState === "empty" && "API boş veri döndü"}
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
            onClick={() => setShowOfferForm((value) => !value)}
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
          {offers.some((offer) => offer.source === "local")
            ? ", kayıtlı yerel taslaklar listeleniyor."
            : "."}
        </p>
      )}

      {showOfferForm && (
        <form className="data-form" onSubmit={createOffer}>
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

          <select
            value={offerStatus}
            onChange={(event) => setOfferStatus(event.target.value)}
          >
            <option>Hazırlanıyor</option>
            <option>Gönderildi</option>
            <option>Onaylandı</option>
            <option>Reddedildi</option>
          </select>

          <button type="submit">Teklifi Kaydet</button>

          <p className="form-hint">
            Yeni kayıtlar bu sürümde yerel taslak olarak eklenir.
          </p>
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
                      {selectedOfferDetail.projectId || "Atanmadı"}
                    </strong>
                  </div>
                </div>

                <div className="offer-detail-note">
                  <strong>Detay görünümü hazır</strong>
                  <p>
                    Teklif seçildiğinde temel alanlar ve API detay sorgusu bu
                    panelde yönetilir.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default OffersModule;
