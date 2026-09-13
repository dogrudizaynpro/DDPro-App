import { calculateMaterialItemTotal, formatCurrency } from '../services/core-data.service.js';

const collectDescendantIds = (items, itemId) => {
  const children = items.filter((candidate) => candidate.parentId === itemId);
  return children.flatMap((child) => [child.id, ...collectDescendantIds(items, child.id)]);
};

export default function HierarchyItemsEditor({ items, onAddItem, onRemoveItem, onItemChange }) {
  return (
    <div className="line-items-editor">
      <div className="line-items-header">
        <strong>Malzeme Ağacı</strong>
        <button type="button" className="secondary-button" onClick={onAddItem}>
          + Malzeme Ekle
        </button>
      </div>

      {items.length === 0 ? (
        <div className="line-items-empty">Henüz malzeme eklenmedi.</div>
      ) : (
        <div className="line-items-table">
          {items.map((item, index) => {
            const descendantIds = new Set(collectDescendantIds(items, item.id));

            return (
            <div className="line-item-row material-row" key={item.id}>
              <input
                type="text"
                placeholder="Malzeme adı"
                value={item.name}
                onChange={(event) => onItemChange(item.id, 'name', event.target.value)}
              />
              <select
                value={item.parentId}
                onChange={(event) => onItemChange(item.id, 'parentId', event.target.value)}
              >
                <option value="">Ana düğüm</option>
                {items
                  .filter((candidate) => candidate.id !== item.id && !descendantIds.has(candidate.id))
                  .map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.name || `Malzeme ${index + 1}`}
                    </option>
                  ))}
              </select>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Miktar"
                value={item.quantity}
                onChange={(event) => onItemChange(item.id, 'quantity', event.target.value)}
              />
              <input
                type="text"
                placeholder="Birim"
                value={item.unit}
                onChange={(event) => onItemChange(item.id, 'unit', event.target.value)}
              />
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Birim maliyet"
                value={item.unitCost}
                onChange={(event) => onItemChange(item.id, 'unitCost', event.target.value)}
              />
              <div className="line-item-total">
                <span>{index + 1}. Toplam Maliyet</span>
                <strong>{formatCurrency(calculateMaterialItemTotal(item))}</strong>
              </div>
              <button type="button" className="danger-button" onClick={() => onRemoveItem(item.id)}>
                Kaldır
              </button>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
