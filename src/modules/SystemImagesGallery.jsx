import { useEffect, useRef, useState } from "react";
import {
  deleteSystemImage,
  getSystemImages,
  replaceSystemImage,
  uploadSystemImage,
} from "../services/system-images.service.js";
import DDProActionButton from "../components/DDProActionButton.jsx";

function SystemImagesGallery({ systemId, systemName, refreshToken }) {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const addInput = useRef(null);
  const replacementInputs = useRef(new Map());

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    getSystemImages(systemId)
      .then((data) => { if (active) setImages(data); })
      .catch((loadError) => {
        if (active) {
          setImages([]);
          setError(loadError.message || "Sistem görselleri yüklenemedi.");
        }
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [systemId, refreshToken]);

  const addImages = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      for (let index = 0; index < files.length; index += 1) {
        setProgress(`Görsel yükleniyor (${index + 1}/${files.length})…`);
        await uploadSystemImage(systemId, files[index]);
      }
      setNotice(`${files.length} görsel kalıcı olarak yüklendi.`);
      setImages(await getSystemImages(systemId));
    } catch (uploadError) {
      setError(uploadError.message || "Görsel yüklenemedi.");
      try { setImages(await getSystemImages(systemId)); } catch { /* Keep the last visible gallery. */ }
    } finally {
      setBusy(false);
      setProgress("");
      if (addInput.current) addInput.current.value = "";
    }
  };

  const changeImage = async (image, file) => {
    if (!file) return;
    setBusy(true);
    setError("");
    setNotice("");
    setProgress("Görsel değiştiriliyor…");
    try {
      await replaceSystemImage(systemId, image.id, file);
      setImages(await getSystemImages(systemId));
      setNotice("Görsel değiştirildi.");
    } catch (replaceError) {
      setError(replaceError.message || "Görsel değiştirilemedi.");
      try { setImages(await getSystemImages(systemId)); } catch { /* Keep the last visible gallery. */ }
    } finally {
      setBusy(false);
      setProgress("");
      const input = replacementInputs.current.get(image.id);
      if (input) input.value = "";
    }
  };

  const removeImage = async (image) => {
    setBusy(true);
    setError("");
    setNotice("");
    setProgress("Görsel siliniyor…");
    try {
      await deleteSystemImage(systemId, image.id);
      setImages((current) => current.filter((item) => item.id !== image.id));
      setNotice("Görsel silindi.");
    } catch (deleteError) {
      setError(deleteError.message || "Görsel silinemedi.");
    } finally {
      setBusy(false);
      setProgress("");
    }
  };

  return (
    <section className="system-image-gallery" aria-label={`${systemName} görselleri`}>
      <div className="system-image-toolbar">
        <h4>Sistem görselleri</h4>
        <button className="system-image-add-button" type="button" disabled={busy || loading} onClick={() => addInput.current?.click()}>
          Görsel ekle
        </button>
        <input
          ref={addInput}
          className="system-image-input"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          aria-label={`${systemName} için görsel seç`}
          onChange={(event) => addImages(event.target.files)}
        />
      </div>
      <p className="system-image-hint">JPEG, PNG veya WebP · en fazla 10 MB/görsel</p>
      {loading ? <p className="system-image-message" role="status">Görseller yükleniyor…</p> : null}
      {progress ? <p className="system-image-message" role="status" aria-live="polite">{progress}</p> : null}
      {error ? <p className="system-image-message warning" role="alert">{error}</p> : null}
      {notice ? <p className="system-image-message success" role="status">{notice}</p> : null}
      {!loading && !images.length ? <p className="system-image-message">Bu sisteme henüz görsel eklenmedi.</p> : null}
      {images.length ? (
        <div className="system-image-list">
          {images.map((image) => (
            <figure className="system-image-item" key={image.id}>
              <img src={image.preview_url} alt={`${systemName} — ${image.original_name}`} loading="lazy" />
              <figcaption>{image.original_name}</figcaption>
              <div className="system-image-actions">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => replacementInputs.current.get(image.id)?.click()}
                >
                  Değiştir
                </button>
                <input
                  ref={(element) => {
                    if (element) replacementInputs.current.set(image.id, element);
                    else replacementInputs.current.delete(image.id);
                  }}
                  className="system-image-input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  aria-label={`${image.original_name} dosyasını değiştir`}
                  onChange={(event) => changeImage(image, event.target.files?.[0])}
                />
                <DDProActionButton
                  icon="delete"
                  label={`${image.original_name} görselini sil`}
                  disabled={busy}
                  onClick={() => removeImage(image)}
                />
              </div>
            </figure>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export default SystemImagesGallery;
