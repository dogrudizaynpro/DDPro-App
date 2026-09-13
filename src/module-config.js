export const MODULES = [
  {
    id: "dashboard",
    route: "#/dashboard",
    icon: "◉",
    title: "Genel Bakış",
    short: "Sistem Merkezi",
    description:
      "DDPro ana operasyon ekranı; ürün, sistem, analiz, teklif ve CRM akışlarını tek merkezden takip et.",
  },
  {
    id: "products",
    route: "#/products",
    icon: "□",
    title: "Ürünler",
    short: "Katalog Modülü",
    description:
      "Ürün listesi, arama/filtreleme, ürün kodu, sistem ilişkisi, birim ve durum yönetimi.",
  },
  {
    id: "systems",
    route: "#/systems",
    icon: "⚙",
    title: "Sistemler",
    short: "Sistem Kataloğu",
    description:
      "Sistem listesi, detay görünümü, sistem kategorisi ve sisteme bağlı ürün akışları.",
  },
  {
    id: "price-analysis",
    route: "#/price-analysis",
    icon: "₺",
    title: "Fiyat Analizi",
    short: "Hizmet Kalemleri",
    description:
      "Bağımsız hizmet kalemleri için miktar, birim fiyat, katsayı ve toplam hesaplayan fiyat analizi iskeleti.",
  },
  {
    id: "material-analysis",
    route: "#/material-analysis",
    icon: "⎇",
    title: "Malzeme Analizi",
    short: "Malzeme Ağacı",
    description:
      "Ayrı veri modeliyle malzeme ağacı, miktar, birim maliyet ve toplam malzeme maliyeti takibi.",
  },
  {
    id: "offers",
    route: "#/offers",
    icon: "€",
    title: "Teklifler",
    short: "Teklif Merkezi",
    description:
      "Müşteri, proje ve analiz kalemleri ile teklif listesi ve yeni teklif taslak akışları.",
  },
  {
    id: "projects",
    route: "#/projects",
    icon: "▣",
    title: "Projeler",
    short: "Proje Yönetimi",
    description:
      "Proje listesi, yeni proje, proje detayları ve projeye bağlı sistem/teklif görünümü.",
  },
  {
    id: "crm",
    route: "#/crm",
    icon: "◎",
    title: "CRM",
    short: "Müşteri Yönetimi",
    description:
      "Müşteri listesi, firma ve iletişim bilgileri ile proje/teklif ilişkilerini yöneten CRM ekranı.",
  },
  {
    id: "research",
    route: "#/research",
    icon: "⌕",
    title: "Tedarik & Araştırma",
    short: "Araştırma Merkezi",
    description:
      "Ürün, malzeme ve fiyat araştırmalarını mevcut API bağlantılarını koruyarak izleyin.",
  },
  {
    id: "ai",
    route: "#/ai",
    icon: "✦",
    title: "DDPro AI",
    short: "Yapay Zeka Sistemi",
    description:
      "Operasyon ve analiz süreçleri için not alan AI çalışma alanı.",
  },
];

export const MODULE_ROUTE_MAP = Object.fromEntries(
  MODULES.map((module) => [module.id, module.route])
);

const normalizeHash = (hash = "") => {
  const trimmed = String(hash || "").trim();
  return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
};

export const getModuleIdFromHash = (hash) => {
  const normalizedHash = normalizeHash(hash || "#/dashboard");
  const matchedModule = MODULES.find((module) => module.route === normalizedHash);
  return matchedModule?.id || "dashboard";
};
