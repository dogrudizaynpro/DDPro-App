function AIModule({ aiMessages, sendAiMessage, aiInput, setAiInput }) {
  return (
    <div className="module-page ai-module">
      <div className="ai-chat">
        {aiMessages.map((message) => (
          <div
            key={message.id}
            className={`ai-message ${message.role}`}
          >
            <strong>
              {message.role === "assistant"
                ? "DDPro AI"
                : "Sen"}
            </strong>
            <p>{message.text}</p>
            <small>{message.date}</small>
          </div>
        ))}
      </div>

      <form className="ai-form" onSubmit={sendAiMessage}>
        <textarea
          placeholder="DDPro AI için mesajını yaz..."
          value={aiInput}
          onChange={(event) => setAiInput(event.target.value)}
        />

        <button type="submit">Gönder</button>
      </form>
    </div>
  );
}

export default AIModule;
