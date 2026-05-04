# Haftalık/Aylık Ceza Arama ve Point Train (PT) Mimarisi

## 1. Veri Modeli ve İndeksleme (Firestore)
Ceza logları (Audit Logs veya Moderation Logs), tarih bazlı sorguları hızlı yapabilmek için indekslenmelidir.
`cases` koleksiyonu şeması:
```typescript
interface ModerationCase {
  id: string;
  moderatorId: string; // Cezayı kesen yetkili
  userId: string; // Ceza alan kullanıcı
  ruleId: string; // İhlal edilen kural (Örn: A1)
  duration: number; // Uygulanan ceza süresi
  timestamp: FirebaseFirestore.Timestamp; // İşlem tarihi
  points: number; // Bu cezanın Point Train (PT) sistemindeki puan değeri
}
```

## 2. Point Train (PT) Puanlama Mantığı
PT, yetkililerin haftalık veya aylık performansını ölçmek için her ceza işlemine ağırlık veren bir sistemdir.
Örnek Puanlama (Konfigüre edilebilir):
- MUTE (A, B, C Kategorisi): 1 Puan
- KISITLAMA (DIRECT_RESTRICTION): 1 Puan
- BAN (DIRECT_BAN): 1 Puan

Bu hesaplama `calculatePT(cases)` adında bir utils fonksiyonunda veya Cloud Functions üzerinde periyodik (cron job) olarak hesaplanabilir.

## 3. Tarih Bazlı Arama ve Filtreleme UI
Arayüzde (Dashboard) "PT İnceleme Sayfası" yer alacaktır:
- **Tarih Seçici (Date Range Picker):** Shadcn `DatePickerWithRange` componenti kullanılarak (Örn: "Bu Hafta", "Geçen Ay", "Özel Tarih") moderatörün işlemleri filtrelenir.
- **Moderatör Seçici (Select):** Tüm moderatörler veya spesifik bir moderatör seçilebilir.
- **Metrik Kartları:** 
  - Toplam Kesilen Ceza
  - Toplam Kazanılan PT (Point Train)
  - En Çok İhlal Edilen Kategori

## 4. Backend (Firebase) Sorgusu
```javascript
// Örnek Firestore Query'si
const getPTData = async (moderatorId, startDate, endDate) => {
  const q = query(
    collection(db, "cases"),
    where("moderatorId", "==", moderatorId),
    where("timestamp", ">=", startDate),
    where("timestamp", "<=", endDate)
  );
  const snapshot = await getDocs(q);
  // Snapshot üzerinden puan toplamı hesaplanır
}
```

Bu yapı sayesinde yetkililerin performansı şeffaf, ölçülebilir ve tarih bazlı olarak raporlanabilir hale gelecektir.
