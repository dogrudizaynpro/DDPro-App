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
- Aktif API rotaları: `/api/projects`, `/api/research`, `/api/offers`
- Production CORS origin'i `https://dogrudizaynpro.github.io` olacak şekilde yapılandırılmalıdır.
