export const modules = [
  {
    id: "dashboard",
    path: "#/dashboard",
    icon: "◉",
    title: "Dashboard",
    short: "Sistem Merkezi",
    description:
      "Tüm DDPro operasyonlarını, kayıtları ve sistem durumunu tek merkezden takip et.",
  },
  {
    id: "projects",
    path: "#/projeler",
    icon: "▣",
    title: "Projeler",
    short: "Proje Yönetimi",
    description:
      "Aktif projelerini oluştur, yönet ve süreçlerini DDPro içinde merkezi olarak takip et.",
  },
  {
    id: "products",
    path: "#/urunler",
    icon: "◫",
    title: "Ürünler",
    short: "Ürün Yönetimi",
    description:
      "Ürün veri modeli için ayrılmış modül alanını bağımsız olarak yönet.",
  },
  {
    id: "systems",
    path: "#/sistemler",
    icon: "⚙",
    title: "Sistemler",
    short: "Sistem Yönetimi",
    description:
      "DDPro sistem bileşenlerini, merkezi hafızayı ve entegrasyon durumunu takip et.",
  },
  {
    id: "price-analysis",
    path: "#/fiyat-analizi",
    icon: "₺",
    title: "Fiyat Analizi",
    short: "Fiyat İnceleme",
    description:
      "Fiyat analiz süreçleri için ayrılmış çalışma alanını ayrı modül yapısında yönet.",
  },
  {
    id: "material-analysis",
    path: "#/malzeme-analizi",
    icon: "⬢",
    title: "Malzeme Analizi",
    short: "Malzeme İnceleme",
    description:
      "Malzeme analiz süreçlerini fiyat analizinden bağımsız modül yapısında takip et.",
  },
  {
    id: "offers",
    path: "#/teklifler",
    icon: "€",
    title: "Teklifler",
    short: "Teklif Yönetimi",
    description:
      "Tekliflerini oluştur, kayıt altına al, takip et ve proje süreçleriyle ilişkilendir.",
  },
  {
    id: "customers",
    path: "#/musteriler-crm",
    icon: "☰",
    title: "Müşteriler / CRM",
    short: "İlişki Yönetimi",
    description:
      "Müşteri ilişkileri ve CRM süreçleri için ayrılmış modül alanını yönet.",
  },
  {
    id: "procurement",
    path: "#/tedarik",
    icon: "⌕",
    title: "Tedarik",
    short: "Araştırma Merkezi",
    description:
      "Tedarik ve araştırma kayıtlarını merkezi havuzda topla ve yönet.",
  },
  {
    id: "documents",
    path: "#/belgeler",
    icon: "⎙",
    title: "Belgeler",
    short: "Doküman Yönetimi",
    description:
      "Doküman akışı için ayrılmış belge modülünü ortak DDPro layout içinde kullan.",
  },
  {
    id: "ai",
    path: "#/ai-asistan",
    icon: "✦",
    title: "AI Asistan",
    short: "Yapay Zeka",
    description:
      "Araştırma, analiz ve operasyon süreçlerinde yapay zeka destekli çalışma alanını kullan.",
  },
  {
    id: "finance",
    path: "#/finans-maliyet",
    icon: "◌",
    title: "Finans / Maliyet",
    short: "Finans Yönetimi",
    description:
      "Finans ve maliyet süreçleri için ayrılmış modül iskeletini yönet.",
  },
  {
    id: "reports",
    path: "#/raporlar",
    icon: "▤",
    title: "Raporlar",
    short: "Raporlama",
    description:
      "Operasyon, teklif ve yönetim raporları için ayrılmış raporlama alanını kullan.",
  },
  {
    id: "settings",
    path: "#/ayarlar",
    icon: "⋯",
    title: "Ayarlar",
    short: "Yapılandırma",
    description:
      "Uygulama ayarlarını, entegrasyonları ve merkezi yapılandırmaları tek ekranda yönet.",
  },
];

export const defaultModuleId = "dashboard";

export const getModuleById = (moduleId) =>
  modules.find((module) => module.id === moduleId) || modules[0];

export const getModuleIdFromHash = (hash) =>
  modules.find((module) => module.path === hash)?.id || defaultModuleId;

export const systemModules = [
  {
    id: "project-system",
    title: "Proje Sistemi",
    description:
      "Projelerin oluşturulması, merkezi takibi ve operasyon kayıtlarının yönetimi.",
  },
  {
    id: "research-system",
    title: "Araştırma Sistemi",
    description:
      "Ürün, malzeme, fiyat ve tedarikçi araştırmalarının merkezi havuzda toplanması.",
  },
  {
    id: "offer-system",
    title: "Teklif Sistemi",
    description:
      "Teklif oluşturma, kayıt, takip ve proje süreçleriyle ilişkilendirme altyapısı.",
  },
  {
    id: "ai-system",
    title: "DDPro AI Sistemi",
    description:
      "Yapay zeka destekli analiz, araştırma ve karar süreçlerinin merkezi çalışma alanı.",
  },
  {
    id: "memory-system",
    title: "Merkezi Hafıza",
    description:
      "Önemli notların, kararların ve sistem bilgisinin kalıcı olarak merkezi hafızada tutulması.",
  },
  {
    id: "integration-system",
    title: "Entegrasyon Sistemi",
    description:
      "Harici servisler ve gelecekteki API bağlantıları için merkezi entegrasyon altyapısı.",
  },
];

export const placeholderModules = {
  products: {
    heading: "Ürün modülü iskeleti hazır",
    badge: "Boş durum",
    summary: [
      {
        title: "Bağımsız veri modeli",
        description:
          "Ürün alanı sistem kayıtlarından bağımsız tutulur ve ayrı veri kaynağına hazırlanır.",
      },
      {
        title: "Liste görünümü",
        description:
          "Ürün listesi bu ekran için hazır; canlı veri bağlanana kadar boş durum korunur.",
      },
      {
        title: "Operasyon sınırı",
        description:
          "Ürün alanı yalnızca ürün kayıtları için ayrılmıştır; sistem kartlarıyla karıştırılmaz.",
      },
    ],
    emptyTitle: "Henüz ürün verisi bağlı değil",
    emptyDescription:
      "Ürün modülü ortak DDPro layout ve gerçek route içinde hazır. Backend veya merkezi veri akışı bağlandığında listeleme alanı bu yapı üzerinde açılacak.",
    relatedModules: ["projects", "systems", "offers"],
  },
  "price-analysis": {
    heading: "Fiyat analizi alanı hazır",
    badge: "Ayrı modül",
    summary: [
      {
        title: "Ayrı süreç",
        description:
          "Fiyat analizi modülü malzeme analizinden bağımsız tutulur ve kendi veri akışını bekler.",
      },
      {
        title: "Karar katmanı",
        description:
          "Bu alan teklif ve tedarik kararlarını destekleyecek analiz çıktıları için ayrılmıştır.",
      },
      {
        title: "Boş durum koruması",
        description:
          "Canlı backend olmadığı için sahte analiz verisi üretilmeden boş durum gösterilir.",
      },
    ],
    emptyTitle: "Fiyat analizi veri kaynağı bekleniyor",
    emptyDescription:
      "Gerçek fiyat verisi bağlanana kadar bu modül yalnızca route ve layout içinde hazır tutulur.",
    relatedModules: ["offers", "procurement", "finance"],
  },
  "material-analysis": {
    heading: "Malzeme analizi alanı hazır",
    badge: "Ayrı modül",
    summary: [
      {
        title: "Malzeme odağı",
        description:
          "Bu modül malzeme seçimi, bileşen notları ve teknik analiz akışı için ayrılmıştır.",
      },
      {
        title: "Fiyat analizinden ayrı",
        description:
          "Malzeme analiz ekranı fiyat analiz ekranından tamamen ayrı route ve sayfa yapısında tutulur.",
      },
      {
        title: "Gerçek veri ilkesi",
        description:
          "Backend bulunmayan alanda sahte malzeme listesi yerine boş durum kullanılır.",
      },
    ],
    emptyTitle: "Malzeme analizi veri kaynağı bekleniyor",
    emptyDescription:
      "Canlı malzeme verisi bağlandığında bu modül bağımsız veri modeliyle doldurulacak.",
    relatedModules: ["products", "procurement", "systems"],
  },
  customers: {
    heading: "CRM modülü iskeleti hazır",
    badge: "Boş durum",
    summary: [
      {
        title: "Müşteri odağı",
        description:
          "Müşteri temasları, hesaplar ve CRM süreçleri için ayrı bir çalışma alanı ayrıldı.",
      },
      {
        title: "Route ve layout hazır",
        description:
          "Modül DDPro ana layout yapısı içinde çalışır ve navigasyondan erişilebilir durumdadır.",
      },
      {
        title: "Merkezi akış koruması",
        description:
          "Mevcut proje, teklif ve tedarik veri akışlarına dokunulmadan modül boş durumda tutulur.",
      },
    ],
    emptyTitle: "CRM verisi henüz bağlı değil",
    emptyDescription:
      "Müşteri ve CRM veri kaynağı bağlanana kadar bu ekran boş durum komponenti ile çalışır.",
    relatedModules: ["projects", "offers", "documents"],
  },
  documents: {
    heading: "Belge modülü iskeleti hazır",
    badge: "Boş durum",
    summary: [
      {
        title: "Doküman akışı",
        description:
          "Sözleşme, teklif eki ve operasyon dosyaları için ayrı belge çalışma alanı ayrıldı.",
      },
      {
        title: "Profesyonel görünüm",
        description:
          "Belge modülü kart tabanlı DDPro yapısı içinde aynı tipografi ve boşluk sistemiyle sunulur.",
      },
      {
        title: "Veri güvenliği",
        description:
          "Backend entegrasyonu hazır olmayınca sahte dosya kayıtları yerine boş durum korunur.",
      },
    ],
    emptyTitle: "Henüz belge kaynağı bağlı değil",
    emptyDescription:
      "Belge servisi bağlandığında bu ekran liste, filtre ve detay alanlarını aynı layout içinde kullanacak.",
    relatedModules: ["offers", "customers", "settings"],
  },
  finance: {
    heading: "Finans / maliyet modülü hazır",
    badge: "Boş durum",
    summary: [
      {
        title: "Finans odağı",
        description:
          "Maliyet ve finans süreçleri için bağımsız modül alanı ayrıldı.",
      },
      {
        title: "Teklif ilişkisi",
        description:
          "Teklif verileriyle ilişki kurulabilecek yapı korunur ancak yeni sahte maliyet verisi üretilmez.",
      },
      {
        title: "Genişleme noktası",
        description:
          "Canlı finans servisleri bağlandığında aynı ekran kartları ve paneller genişletilebilir.",
      },
    ],
    emptyTitle: "Finans verisi henüz bağlı değil",
    emptyDescription:
      "Bu modül canlı maliyet verisi veya backend servisi hazır olana kadar boş durumla çalışır.",
    relatedModules: ["offers", "price-analysis", "reports"],
  },
  reports: {
    heading: "Raporlama modülü hazır",
    badge: "Boş durum",
    summary: [
      {
        title: "Yönetim raporları",
        description:
          "Proje, teklif ve operasyon çıktıları için raporlama alanı bağımsız route olarak açıldı.",
      },
      {
        title: "Ortak layout",
        description:
          "Rapor ekranı mevcut DDPro kart sistemi ve responsive yerleşimiyle aynı arayüzde çalışır.",
      },
      {
        title: "Gerçek veri ilkesi",
        description:
          "Canlı rapor servisleri hazır olana kadar temsili rapor üretmek yerine boş durum korunur.",
      },
    ],
    emptyTitle: "Rapor verisi henüz hazır değil",
    emptyDescription:
      "Gerçek rapor veri kaynağı bağlandığında bu ekran mevcut iskelet üzerinden genişletilecek.",
    relatedModules: ["dashboard", "offers", "finance"],
  },
};
