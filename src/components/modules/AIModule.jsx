export default function AIModule({
  messages,
  aiInput,
  onAiInputChange,
  onSubmit,
}) {
  return (
    <div className="module-page ai-module">
      <div className="status-banner info">
        ℹ DDPro AI çalışma alanı kullanılabilir; gelişmiş servis/API entegrasyonu bu sürümde bağlı
        değildir.
      </div>

      <div className="ai-chat">
        {messages.map((message) => (
          <div key={message.id} className={`ai-message ${message.role}`}>
            <strong>{message.role === "assistant" ? "DDPro AI" : "Sen"}</strong>
            <p>{message.text}</p>
            <small>{message.date}</small>
          </div>
        ))}
      </div>

      <form className="ai-form" onSubmit={onSubmit}>
        <textarea
          placeholder="DDPro AI için mesajını yaz..."
          value={aiInput}
          onChange={(event) => onAiInputChange(event.target.value)}
        />

        <button type="submit">Gönder</button>
      </form>
    </div>
  );
}
