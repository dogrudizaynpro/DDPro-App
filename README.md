# DDPro-App

## DOĞRU DİZAYN PRO

Yapı, mimari, tasarım, tedarik ve dijital iş süreçlerini tek bir ekosistemde birleştiren mobil uygulama ve dijital yönetim platformu.

### Ana Modüller

- Genel Bakış
- Projeler
- Tedarik & Araştırma
- Teklifler
- Belgeler
- AI Asistan
- Müşteri & İş Takibi
- Finans & Maliyet
- Raporlama

### Sistem Vizyonu

DOĞRU ÇİZGİ • DOĞRU ÇÖZÜM • DOĞRU SİSTEM

DDPro-App; gerçek veriler, gerçek projeler ve kontrollü entegrasyonlar üzerine kurulan, aşamalı olarak geliştirilen yaşayan bir dijital ekosistemdir.

### Gelişim Sırası

1. Çalışan temel arayüz
2. Gerçek veri altyapısı
3. API ve sistem entegrasyonları
4. AI destekli otomasyonlar
5. Gelişmiş dijital ekosistem

### Production API Bağlantısı

- Frontend build sırasında production API origin'i `VITE_API_URL` repository variable'ından alınır.
- Repository içinde doğrulanmış bir production backend URL'si bulunmamaktadır; URL tahmin edilmemelidir.
- GitHub Pages deploy'u artık `VITE_API_URL` tanımlı değilse veya `/health` endpoint'i `200 OK` dönmüyorsa başarısız olur.
- Backend deployment şablonu `render.yaml` dosyasında tanımlanmıştır. Backend ayağa kaldırıldıktan sonra gerçek origin değeri GitHub repository variable `VITE_API_URL` olarak girilmelidir.
- Backend health endpoint'i `/health` yolunda çalışır ve veritabanı hazır değilse deploy smoke testi başarısız olacak şekilde kullanılır.

### Backend Notları

- Backend kodu `/backend` altında Node.js + Express + Supabase yapısındadır.
- API rotaları: `/api/projects`, `/api/research`, `/api/offers`, `/api/crm`, `/api/ai`, `/api/integrations`
- Production `FRONTEND_URL` ve `ALLOWED_ORIGINS` yalnızca gerçek yayınlanan frontend origin'lerini içermelidir; localhost production'da kabul edilmez.

### Entegrasyon Kurulumu

- `backend/.env.example` dosyasını backend `.env` dosyasına kopyalayın. Secret/token değerlerini frontend `VITE_*` değişkenlerine veya kaynak koda koymayın.
- Frontend için repository kökündeki `.env.example` yalnızca `VITE_API_URL` değişkenini içerir. Yerel geliştirmede bu değişken boş bırakılabilir; uygulamanın mevcut localhost fallback'i korunur. Production deploy için GitHub repository variable veya Vercel build environment içine gerçek backend origin'i tanımlayın. Secret/API key'leri `VITE_*` değişkenlerine koymayın.
- Supabase SQL Editor'da `backend/database/migrations/004_operations_integrations.sql` migration'ını, önceki proje/araştırma migration'larından sonra çalıştırın.
- Core projects, offers, and research API operations use the backend-only `SUPABASE_SERVICE_ROLE_KEY`; migration `005_core_data_access.sql` enables RLS and removes direct `anon`/`authenticated` table access. It expects the existing base tables and migrations 002–004 to be applied first. CRM table access is secured by migration 004.
- Apply `backend/database/migrations/006_catalog_costing.sql` after migration 005. It creates protected product, system, price-analysis, and material-analysis tables, seeds the six canonical DDPro systems without overwriting edited records, and grants table access only to the backend `service_role`. Their `/api/products`, `/api/systems`, `/api/price-analysis`, and `/api/material-analysis` routes require the existing Google browser session. Material costs are snapshotted only from a price-analysis row with `VERIFIED` status; labor, VAT, and transport are not included.
- Apply `backend/database/migrations/007_offer_relationships.sql` after migration 006 to add offer system/product/material links and a frozen offer snapshot. Offers begin in `Hazırlanıyor` and may progress to `Gönderildi`, then `Onaylandı` or `Reddedildi`; terminal offers cannot be reopened through the API.
- Apply migrations `008`–`014` in numeric order after migration 007. Render applies migration `015_ai_tool_confirmations.sql` transactionally before starting the backend; it creates a service-role-only, account-bound, five-minute confirmation record for AI-proposed writes. Configure the backend-only `DATABASE_URL` with the PostgreSQL connection URL for the same Supabase project in Render. Startup fails closed if the migration cannot be applied or its schema/RLS/grants cannot be verified. Migration 015 is additive and idempotent, and is serialized across simultaneous backend starts; earlier migrations are not replayed.
- Authenticated AI chat can read current records through existing backend controllers. Create/update/delete operations are staged server-side and execute only after the account-bound confirmation is consumed once; Google access/refresh tokens and secrets are not included in AI tools or browser requests.
- `/api/projects`, `/api/offers`, `/api/research`, and `/api/crm` require the existing allowlisted Google OAuth session. Configure `GOOGLE_ALLOWED_EMAILS`, OAuth credentials, `INTEGRATION_SESSION_SECRET`, and secure token storage before using these operations.
- Set Render `FRONTEND_URL` and comma-separated `ALLOWED_ORIGINS` to the deployed frontend origin(s), and set GitHub repository variable / Vercel build environment `VITE_API_URL` to the backend origin only. Production deploy rejects a missing `VITE_API_URL`; production CORS excludes localhost origins.
- GitHub Pages ile Render ayrı origin olduğunda OAuth callback, iki dakika geçerli tek kullanımlık bir kodu URL fragment'ında döndürür; frontend aynı sekmedeki gizli doğrulayıcıyla backend üzerinde kodu tüketir. Exchange başarılı olduğunda backend, frontend'in site partition'ında 30 gün mutlak süreli `ddpro_session_restore` cookie'sini oluşturur. Sekme içinde kullanılan kısa ömürlü DDPro bearer session `sessionStorage` içinde kalır; kalıcı kimlik kanıtı bu storage değildir. Google access/refresh token'ları frontend'e aktarılmaz; yalnızca backend'deki AES-256-GCM şifreli `integration_tokens` tablosunda kalır.
- Uygulama yeniden açıldığında bütün `/api/` istekleri OAuth handoff ve gerekiyorsa tek paylaşılan `POST /api/integrations/google/restore` isteğini bekler. Backend HttpOnly cookie imzasını, süresini, allowlist hesabını ve kayıtlı Google bağlantısının session version'ını doğrular; yeni kısa ömürlü DDPro bearer session döndürür. Geçerli bearer doğrudan kullanılır; gerçek DDPro `401` için yalnızca bir restore/retry yapılır. Restore Google API health testi çalıştırmaz; upstream `401`/`403`/`429` Google bağlantısını silmez.
- Restore cookie host-only, `HttpOnly`, `Secure`, `Path=/api/integrations/google`, production'da `SameSite=None; Partitioned` ve `Max-Age=2592000` kullanır. Restore yalnızca tam `FRONTEND_URL` origin'inden JSON POST kabul eder, rate limit ve `Cache-Control: no-store` uygular; email parametresi veya backend'de rastgele bulunan bir Google hesabı kimlik kanıtı sayılmaz. Disconnect provider revocation başarılı/önceden tamamlanmış ise token'ı siler ve cookie'leri temizler; eski restore cookie yeniden bağlantı sonrasında da version kontrolünden geçemez.
- Token refresh ve eski cookie'nin session-version yükseltmesi, okunan şifreli token kaydı hâlâ değişmemişse atomik conditional update yapar; silinmiş bağlantıyı yeniden oluşturmaz ve eşzamanlı OAuth reconnect'in yeni version'ını eski token ile ezmez. Version'sız eski session yalnızca version'sız eski token ile kabul edilir.
- Google Cloud OAuth callback URI'sini backend'in `/api/integrations/google/callback` adresine ayarlayın. `GOOGLE_ALLOWED_EMAILS` yalnızca yetkili e-posta adreslerini içermelidir.
- Google token'ları Supabase `integration_tokens` tablosunda AES-256-GCM ile şifrelenir. OAuth için `SUPABASE_SERVICE_ROLE_KEY`, 32-byte hex `INTEGRATION_TOKEN_ENCRYPTION_KEY`, `INTEGRATION_SESSION_SECRET`, Google OAuth credentials ve allowlist gereklidir. Service-role anahtarı yalnızca backend'de tutulur.
- Google OAuth başlangıcı 503 dönerse Render loglarındaki `Google OAuth start unavailable` satırı eksik/geçersiz değişken adlarını, `OAuth token table probe failed` satırı ise Supabase sorgusunun hata kodunu gösterir; secret değerleri loglanmaz. `GOOGLE_REDIRECT_URI` Google Cloud'da kayıtlı HTTPS callback URL'siyle birebir aynı olmalıdır. Frontend bağlantı düğmesi yapılandırma hatası olsa bile backend başlangıç endpointine gider.
- `backend/.env.example` içindeki `APPLE_ISSUER_ID`, `APPLE_KEY_ID` ve `APPLE_PRIVATE_KEY` App Store Connect API testinde kullanılır; `.p8` anahtarını yalnızca backend secret store/environment içine koyun. Bu altyapı uygulamayı App Store'a göndermiyor.
- GitHub Pages → Render restore cookie'si OAuth callback'te değil frontend-origin exchange yanıtında oluşturulur; böylece CHIPS destekleyen tarayıcılarda doğru partition'a kaydedilir. Partitioned cookie desteklemeyen ve third-party cookie'leri engelleyen tarayıcılarda veya cookie/storage temizlendiğinde otomatik restore garanti edilemez. Tüm tarayıcılarda kalıcılık için frontend/backend aynı site altında reverse proxy/custom domain ile yayınlanmalıdır. Cookie kanıtı yoksa `BROWSER_SESSION_REQUIRED`; doğrulanmış hesaba ait Google token yoksa `GOOGLE_CONNECTION_REQUIRED` döner. 30 günlük mutlak süre dolunca yeni güvenilir browser authorization gerekir; backend'de token bulunması tek başına oturum oluşturmaz.
- WhatsApp Business webhook adresi `/webhooks/whatsapp`, web form lead endpoint'i `/webhooks/website/leads` yoludur. Her iki sağlayıcı da imza doğrulamasıyla korunur; web sitesinin bu endpoint'e HMAC `x-ddpro-signature` eklemesi gerekir.
- Web CMS adapter'ı yalnızca `pages`, `products` ve `references` içerik yollarını ve HTTPS provider URL'sini kabul eder.
- AI, Gmail/Google Calendar, WhatsApp, CRM, Web/CMS, Apple, Supabase ve web araştırması bağlantı durumları Ayarlar > Entegrasyon Merkezi'nde görüntülenip gerçek provider istekleriyle sınanır. Kimlik bilgileri tanımlı olması tek başına provider bağlantı testi yerine geçmez. Environment ile yönetilen servislerin bağlantısını kesmek için ilgili sunucu değişkenlerini kaldırıp backend'i yeniden başlatın; Google OAuth oturumu uygulamadan kapatılabilir.
- Google bağlantısı Gmail salt-okunur ve Calendar etkinlik erişim kapsamlarını ister. OAuth grant'i uygulandığında gelen e-postalar CRM'e kullanıcı tarafından aktarılır; WhatsApp ve web form lead'leri imzalı webhook ile CRM'e alınır.
- Google Workspace upstream `401` hataları DDPro API'de `502` ve `GOOGLE_API_AUTH_ERROR` olarak döner; `provider`, `upstreamStatus` ve mevcut `googleApiError` alanları güvenli Google hata bilgisini korur. Google `403`/`429` hataları sırasıyla `GOOGLE_API_ACCESS_DENIED`/`GOOGLE_API_RATE_LIMIT` ile ayrılır. Gerçek DDPro session `401` yanıtları değişmez. Gmail/Calendar health testi başarısızlığı OAuth token'larını veya browser session'ı silmez; bağlı durumu ile son test sonucu ayrı tutulur.
- Doğrulama: frontend build için `npm run build`, frontend API regresyonları için `node --test test/api.test.js`, backend testleri için `npm --prefix backend test`.

### Canlı Session Restore Kabul Testi

- Backend ve GitHub Pages frontend birlikte bu değişikliğe deploy edilmelidir; `FRONTEND_URL=https://dogrudizaynpro.github.io/DDPro-App/`, CORS origin'i `https://dogrudizaynpro.github.io` ve mevcut backend `VITE_API_URL` doğru olmalıdır. Yeni environment değişkeni veya migration gerekmez; migration 015 ve AI güvenlik akışı değiştirilmez.
- Daha önce kaydedilmiş Google token tek başına yeni cookie üretmez. Eski geçerli HttpOnly session cookie restore üzerinden güvenli şekilde yükseltilebilir; cookie artık yok/expired ise kullanıcı yeni deployment sonrasında bir defa Google bağlantısı yapmalıdır. Bundan sonraki açılışlarda geçerli restore cookie ile OAuth tekrarlanmaz.
- `https://dogrudizaynpro.github.io/DDPro-App/` üzerinde Google bağlantısını kurun; exchange yanıtındaki restore cookie güvenlik alanlarını ve partition'ını DevTools'ta kontrol edin. Sekmeyi kapatın, tarayıcıyı kapatıp yeniden açın, Projeler'e gidin. Network'te tek başarılı restore ve ardından gerçek backend verisini döndüren `/api/projects` isteği görülmelidir; Google OAuth yönlendirmesi olmamalıdır.
- Aynı oturumla CRM, Teklifler, Tedarik, Gmail ve Calendar işlemlerini kontrol edin. Gmail/Calendar API `401`/`403`/`429` test hataları bağlantıyı korumalıdır. Disconnect sonrasında tekrar açılış erişimi engellemeli; expire/tamper cookie ve yetkisiz origin restore edememelidir.
- Bu kabul testi gerçek allowlisted Google hesabı ve deploy edilmiş backend ile yapılmalıdır. Otomatik testler provider/Supabase yanıtlarını mock eder; canlı cookie kabulü ve gerçek backend verisi için production testi yerine geçmez.
