import { calculateOfferItemTotal, calculatePriceItemTotal, formatCurrency } from '../services/core-data.service.js';

const variants = {
  offer: {
    title: 'Teklif Kalemleri',
    addLabel: '+ Kalem Ekle',
  },
  price: {
    title: 'Analiz Kalemleri',
    addLabel: '+ Analiz Kalemi',
  },
};

export default function LineItemsEditor({
  items,
  variant = 'offer',
  onAddItem,
  onRemoveItem,
  onItemChange,
}) {
  const config = variants[variant] || variants.offer;

  return (
    <div className="line-items-editor">
      <div className="line-items-header">
        <strong>{config.title}</strong>
        <button type="button" className="secondary-button" onClick={onAddItem}>
          {config.addLabel}
        </button>
      </div>

      {items.length === 0 ? (
        <div className="line-items-empty">Henüz kalem eklenmedi.</div>
      ) : (
        <div className="line-items-table">
          {items.map((item, index) => {
            const total =
              variant === 'price'
                ? calculatePriceItemTotal(item)
                : calculateOfferItemTotal(item);

            return (
              <div className="line-item-row" key={item.id}>
                <input
                  type="text"
                  placeholder={variant === 'price' ? 'Hizmet kalemi' : 'Kalem açıklaması'}
                  value={item.description}
                  onChange={(event) => onItemChange(item.id, 'description', event.target.value)}
                />
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
                  placeholder="Birim fiyat"
                  value={item.unitPrice}
                  onChange={(event) => onItemChange(item.id, 'unitPrice', event.target.value)}
                />
                {variant === 'price' ? (
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Katsayı"
                    value={item.coefficient}
                    onChange={(event) => onItemChange(item.id, 'coefficient', event.target.value)}
                  />
                ) : null}
                <div className="line-item-total">
                  <span>{index + 1}. Kalem Toplamı</span>
                  <strong>{formatCurrency(total)}</strong>
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
