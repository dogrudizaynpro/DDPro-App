const resourceAgents = [
  {
    id: "project",
    name: "Proje ve saha",
    resources: ["projects"],
    pattern: /\b(proje|project|saha|şantiye|imalat|iş kalemi)[\p{L}]*/iu,
  },
  {
    id: "crm",
    name: "Müşteri ve CRM",
    resources: ["customers"],
    pattern: /\b(müşteri|müşteriler|crm|kişi|contact|contacts)[\p{L}]*/iu,
  },
  {
    id: "pricing",
    name: "Fiyatlandırma ve maliyet",
    resources: ["price-analysis", "material-analysis", "products", "systems"],
    pattern: /\b(fiyat|fiyatlandırma|maliyet|bütçe|ürün|product|sistem|system)[\p{L}]*/iu,
  },
  {
    id: "offers",
    name: "Teklif",
    resources: ["offers"],
    pattern: /\b(teklif|teklifler|offer|offers)[\p{L}]*/iu,
  },
  {
    id: "procurement",
    name: "Tedarik ve araştırma",
    resources: ["procurement"],
    pattern: /\b(tedarik|satın\s*alma|supplier|tedarikçi|araştır|research)[\p{L}]*/iu,
  },
  {
    id: "reporting",
    name: "Raporlama ve analiz",
    resources: ["reports"],
    pattern: /\b(rapor|raporlama|analiz|report|reports)[\p{L}]*/iu,
  },
  {
    id: "calendar",
    name: "Takvim ve koordinasyon",
    resources: ["calendar"],
    pattern: /\b(takvim|etkinlik|toplantı|randevu|calendar|event|meeting)[\p{L}]*/iu,
  },
];

const RESEARCH_AGENT = Object.freeze({
  id: "research",
  name: "Araştırma",
  resources: [],
});

export const AI_AGENT_REGISTRY = Object.freeze(
  resourceAgents.map(({ pattern: _pattern, ...agent }) =>
    Object.freeze({ ...agent, resources: Object.freeze(agent.resources) })
  )
);

const getSupportedAgents = (message) =>
  resourceAgents
    .filter(({ pattern }) => pattern.test(message))
    .map(({ id, name, resources }) => ({ id, name, resources: [...resources] }));

export const planAiAgents = ({ message = "", intent } = {}) => {
  if (intent === "web_research" || intent === "site_research") {
    return [{ ...RESEARCH_AGENT, resources: [] }];
  }

  const agents = getSupportedAgents(message);
  if (agents.length) return agents;

  return [{ id: "assistant", name: "DDPro AI Asistanı", resources: [] }];
};

export const getAiAgentIdForResource = (resource) =>
  AI_AGENT_REGISTRY.find((agent) => agent.resources.includes(resource))?.id || null;

const unavailableOperations = [
  {
    capability: "rendering",
    label: "gerçek görsel/render üretimi",
    pattern: /\b(render(?:ing)?|3d\s*(?:görsel|model|render)|görselleştir(?:me|mek)?|görsel(?:i|ler)?\s+(?:oluştur|üret|hazırla)|image\s+generation)\b/iu,
  },
  {
    capability: "technical_drawing",
    label: "uygulamaya hazır teknik çizim üretimi",
    pattern: /\b(teknik\s+çizim|mimari\s+çizim|plan(?:ı|ını)?\s+çiz|kesit(?:i|ini)?\s+çiz|draw(?:ing)?\s+(?:a|the)?\s*(?:plan|section))\b/iu,
  },
  {
    capability: "quantity_takeoff",
    label: "kaynak ölçülü ve doğrulanmış metraj çıkarımı",
    pattern: /\b(metraj[\p{L}]*|quantity\s+takeoff|miktar\s+hesab\p{L}*|m²\s+hesab\p{L}*)/iu,
  },
  {
    capability: "progress_billing",
    label: "hakediş hesabı ve kurumsal taslak belgesi",
    pattern: /\b(hakediş[\p{L}]*|hak\s*ediş[\p{L}]*|progress\s+billing)/iu,
  },
  {
    capability: "voice_call",
    label: "gerçek telefon araması",
    pattern: /\b(telefon(?:la)?\s+(?:ara|ara(?:ma|yacağım)|görüş)|(?:müşteriyi|kişiyi|beni)\s+ara|telefon\s+et|arama\s+başlat|place\s+a\s+call)\b/iu,
  },
  {
    capability: "video_call",
    label: "uygulama içi görüntülü görüşme",
    pattern: /\b(görüntülü\s+(?:görüşme|arama)|video\s+(?:call|meeting)|video\s+görüşmesi)\b/iu,
  },
  {
    capability: "digital_card",
    label: "dijital kart oluşturma ve kişi eşleştirme",
    pattern: /\b(dijital\s+kart|vcard|v-card|qr\s+(?:kart|kişi))\b/iu,
  },
];

export const REQUEST_ACTION_PATTERN =
  /(?<![\p{L}\p{N}_])(?:oluştur|üret|hazırla|çıkar|hesapla|çiz|render(?:la|le)?|görselleştir|başlat|create|generate|prepare|calculate|draw|start)[\p{L}]*(?![\p{L}\p{N}_])|(?<![\p{L}\p{N}_])ara(?![\p{L}\p{N}_])/iu;

export const findUnavailableAiCapability = (message = "") => {
  if (!REQUEST_ACTION_PATTERN.test(message)) return null;
  return unavailableOperations.find(({ pattern }) => pattern.test(message)) || null;
};
