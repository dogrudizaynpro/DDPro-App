import { useEffect, useState } from "react";
import { getProjects } from "../services/projects.service.js";
import { getCrmContacts } from "../services/operations-integrations.service.js";
import DDProIcon from "../components/DDProIcon.jsx";
import DDProActionButton from "../components/DDProActionButton.jsx";
import {
  createConversation,
  createMessage,
  deleteConversation,
  deleteMessage,
  getConversations,
  getMessages,
  markMessageRead,
  updateConversation,
} from "../services/messages.service.js";

export default function MessagesModule() {
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [projects, setProjects] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = async (preferredId = selectedId) => {
    setLoading(true);
    setError("");
    try {
      const records = await getConversations();
      setConversations(records);
      const nextId = records.some((record) => record.id === preferredId) ? preferredId : records[0]?.id || "";
      setSelectedId(nextId);
      setMessages(nextId ? await getMessages(nextId) : []);
    } catch (loadError) {
      setConversations([]);
      setMessages([]);
      setError(loadError.message || "Mesajlar backend'den alınamadı.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    Promise.allSettled([getProjects(), getCrmContacts()]).then(([projectsResult, contactsResult]) => {
      if (!active) return;
      if (projectsResult.status === "fulfilled") setProjects(projectsResult.value);
      if (contactsResult.status === "fulfilled") setContacts(contactsResult.value.data || []);
    });
    refresh();
    return () => { active = false; };
  }, []);

  const selectConversation = async (id) => {
    setSelectedId(id);
    setError("");
    try {
      setMessages(await getMessages(id));
    } catch (loadError) {
      setMessages([]);
      setError(loadError.message || "Konuşma yüklenemedi.");
    }
  };

  const saveConversation = async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    setBusy(true);
    setError("");
    try {
      const payload = {
        title: values.title,
        project_id: values.project_id || null,
        crm_contact_id: values.crm_contact_id || null,
      };
      const saved = editing
        ? await updateConversation(editing.id, payload)
        : await createConversation(payload);
      setEditing(null);
      event.currentTarget.reset();
      setNotice(editing ? "Konuşma güncellendi." : "Konuşma kalıcı olarak oluşturuldu.");
      await refresh(saved.id);
    } catch (saveError) {
      setError(saveError.message || "Konuşma kaydedilemedi.");
    } finally {
      setBusy(false);
    }
  };

  const sendMessage = async (event) => {
    event.preventDefault();
    if (!selectedId) return;
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    setBusy(true);
    setError("");
    try {
      await createMessage(selectedId, { content: values.content, direction: values.direction });
      form.reset();
      setMessages(await getMessages(selectedId));
      setNotice("Mesaj kaydedildi. Harici kanala gönderildiği varsayılmaz.");
    } catch (sendError) {
      setError(sendError.message || "Mesaj kaydedilemedi.");
    } finally {
      setBusy(false);
    }
  };

  const removeConversation = async (id) => {
    setBusy(true);
    setError("");
    try {
      await deleteConversation(id);
      setNotice("Konuşma ve bağlı mesajları silindi.");
      await refresh("");
    } catch (removeError) {
      setError(removeError.message || "Konuşma silinemedi.");
    } finally {
      setBusy(false);
    }
  };

  const toggleRead = async (message) => {
    try {
      if (message.read_at) {
        await deleteMessage(selectedId, message.id);
        setMessages((items) => items.filter((item) => item.id !== message.id));
      } else {
        const updated = await markMessageRead(selectedId, message.id);
        setMessages((items) => items.map((item) => item.id === updated.id ? updated : item));
      }
    } catch (actionError) {
      setError(actionError.message || "Mesaj durumu güncellenemedi.");
    }
  };

  const selected = conversations.find((conversation) => conversation.id === selectedId);
  const unreadCount = messages.filter((message) => message.direction === "INBOUND" && !message.read_at).length;

  return (
    <div className="module-page">
      <p className="status-banner info">Konuşmalar ve mesajlar authenticated backend'de kalıcıdır. Mesaj kaydı harici e-posta/WhatsApp gönderildiği anlamına gelmez.</p>
      {error ? <p className="status-banner warning" role="alert">{error}</p> : null}
      {notice ? <p className="status-banner success" role="status">{notice}</p> : null}
      <div className="panel">
        <h2>{editing ? "Konuşmayı düzenle" : "Yeni konuşma"}</h2>
        <form key={editing?.id || "new-conversation"} className="data-form" onSubmit={saveConversation}>
          <label>Başlık<input name="title" required maxLength={200} defaultValue={editing?.title || ""} /></label>
          <label>Proje
            <select name="project_id" defaultValue={editing?.project_id || ""}>
              <option value="">Proje ilişkilendirme</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
          </label>
          <label>Müşteri
            <select name="crm_contact_id" defaultValue={editing?.crm_contact_id || ""}>
              <option value="">Müşteri ilişkilendirme</option>
              {contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name}</option>)}
            </select>
          </label>
          <div className="module-toolbar">
            <button type="submit" disabled={busy}><DDProIcon name="save" />{busy ? "Kaydediliyor…" : editing ? "Konuşmayı güncelle" : "Konuşma oluştur"}</button>
            {editing ? <button type="button" onClick={() => setEditing(null)}>İptal</button> : null}
          </div>
        </form>
      </div>
      <div className="operations-grid">
        <section className="panel">
          <div className="panel-header"><h2>Konuşmalar</h2><button type="button" disabled={loading} onClick={() => refresh()}>Yenile</button></div>
          {loading ? <p className="empty-state">Yükleniyor…</p> : conversations.length ? conversations.map((conversation) => (
            <article className="data-card" key={conversation.id}>
              <button type="button" onClick={() => selectConversation(conversation.id)}>{conversation.title}</button>
              <div className="module-toolbar">
                <DDProActionButton icon="edit" label={`${conversation.title} konuşmasını düzenle`} onClick={() => setEditing(conversation)} />
                <DDProActionButton icon="delete" label={`${conversation.title} konuşmasını sil`} disabled={busy} onClick={() => removeConversation(conversation.id)} />
              </div>
            </article>
          )) : <p className="empty-state">Henüz kalıcı konuşma yok.</p>}
        </section>
        <section className="panel">
          <div className="panel-header">
            <div><h2>{selected?.title || "Mesajlar"}</h2><small>{unreadCount} okunmamış gelen mesaj</small></div>
          </div>
          {selected ? <>
            <div className="data-list">
              {messages.length ? messages.map((message) => (
                <article className="data-card" key={message.id}>
                  <div><p>{message.content}</p><small>{message.direction === "INBOUND" ? `Gelen · ${message.read_at ? "Okundu" : "Okunmadı"}` : "Giden"} · {new Date(message.created_at).toLocaleString("tr-TR")}</small></div>
                  <div className="module-toolbar">
                    {message.direction === "INBOUND" && !message.read_at ? <button type="button" onClick={() => toggleRead(message)}>Okundu işaretle</button> : null}
                    <DDProActionButton icon="delete" label="Mesajı sil" onClick={() => deleteMessage(selectedId, message.id).then(() => setMessages((items) => items.filter((item) => item.id !== message.id))).catch((actionError) => setError(actionError.message))} />
                  </div>
                </article>
              )) : <p className="empty-state">Bu konuşmada henüz mesaj yok.</p>}
            </div>
            <form className="data-form" onSubmit={sendMessage}>
              <label>Yön<select name="direction"><option value="OUTBOUND">Giden kayıt</option><option value="INBOUND">Gelen kayıt</option></select></label>
              <label>Mesaj<textarea name="content" rows={3} required maxLength={10000} /></label>
              <button type="submit" disabled={busy}><DDProIcon name="save" />{busy ? "Kaydediliyor…" : "Mesajı kaydet"}</button>
            </form>
          </> : <p className="empty-state">Mesajları görüntülemek için bir konuşma seçin.</p>}
        </section>
      </div>
    </div>
  );
}
