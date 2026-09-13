export default function SearchBar({
  value,
  onChange,
  onSubmit,
  filteredCount,
  totalCount,
}) {
  return (
    <form className="search-form" onSubmit={onSubmit}>
      <label className="search-field">
        <span>Arama / Komut</span>
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Modül ara veya komut yaz"
        />
      </label>

      <div className="search-meta">
        <small>
          {filteredCount}/{totalCount} modül görünür
        </small>
        <button type="submit">Aç</button>
      </div>
    </form>
  );
}
