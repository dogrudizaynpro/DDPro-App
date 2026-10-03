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
- Production CORS origin'i `https://dogrudizaynpro.github.io` olacak şekilde yapılandırılmalıdır.

### Entegrasyon Kurulumu

- `backend/.env.example` dosyasını backend `.env` dosyasına kopyalayın. Secret/token değerlerini frontend `VITE_*` değişkenlerine veya kaynak koda koymayın.
- Supabase SQL Editor'da `backend/database/migrations/004_operations_integrations.sql` migration'ını, önceki proje/araştırma migration'larından sonra çalıştırın.
- Google Cloud OAuth callback URI'sini backend'in `/api/integrations/google/callback` adresine ayarlayın. `GOOGLE_ALLOWED_EMAILS` yalnızca yetkili e-posta adreslerini içermelidir.
- Google token'ları Supabase `integration_tokens` tablosunda AES-256-GCM ile şifrelenir. OAuth için `SUPABASE_SERVICE_ROLE_KEY`, 32-byte hex `INTEGRATION_TOKEN_ENCRYPTION_KEY`, `INTEGRATION_SESSION_SECRET`, Google OAuth credentials ve allowlist gereklidir. Service-role anahtarı yalnızca backend'de tutulur.
- Cookie tabanlı entegrasyon oturumlarının tarayıcı kısıtlamalarına takılmaması için production frontend ve backend aynı site altında reverse proxy/custom domain ile sunulmalıdır; GitHub Pages ile farklı origin arasında third-party cookie desteği garanti edilmez.
- WhatsApp Business webhook adresi `/webhooks/whatsapp`, web form lead endpoint'i `/webhooks/website/leads` yoludur. Her iki sağlayıcı da imza doğrulamasıyla korunur; web sitesinin bu endpoint'e HMAC `x-ddpro-signature` eklemesi gerekir.
- Web CMS adapter'ı yalnızca `pages`, `products` ve `references` içerik yollarını ve HTTPS provider URL'sini kabul eder.
- AI, Gmail/Google Calendar, WhatsApp, web araştırması, CMS ve Supabase bağlantı durumları Ayarlar > Entegrasyonlar'da görüntülenir. Kimlik bilgileri tanımlı olması tek başına provider bağlantı testi yerine geçmez.
- Google bağlantısı Gmail salt-okunur ve Calendar etkinlik erişim kapsamlarını ister. OAuth grant'i uygulandığında gelen e-postalar CRM'e kullanıcı tarafından aktarılır; WhatsApp ve web form lead'leri imzalı webhook ile CRM'e alınır.
