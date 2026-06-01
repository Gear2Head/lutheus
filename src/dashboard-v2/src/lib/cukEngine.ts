/**
 * Deterministic CUK (Ceza Uygulama Kitapçığı) Engine v2
 * Exact port from public/auth/rolePolicy.js + src/lib/cukEngine.js
 */

export const ROLE_HIERARCHY: Record<string, number> = {
  kurucu: 100,
  admin: 100,
  yonetici: 100,
  genel_sorumlu: 100,
  discord_yoneticisi: 100,
  kidemli_discord_moderatoru: 100,
  senior_moderator: 100,
  discord_moderatoru: 50,
  discord_destek_ekibi: 25,
};

const INVALID_KEYWORDS = [
  'hatalı ceza', 'ceza değiştirildi', 'yanlış ceza', 'iptal edildi', 'ceza iptali',
];

export interface CUKResult {
  valid: boolean;
  score: number;
  message: string;
  categoryMatched: string | null;
}

export function validateCase(reasonRaw: string, durationMinutes?: number | null): CUKResult {
  const reason = (reasonRaw || '').toLowerCase().trim();
  const mins = durationMinutes || 0;

  if (!reason) {
    return { valid: false, score: 0, message: 'Ceza sebebi girilmemiş.', categoryMatched: 'Yok' };
  }

  for (const kw of INVALID_KEYWORDS) {
    if (reason.includes(kw)) {
      return { valid: false, score: 0, message: `İptal kelimesi içeriyor: ${kw}`, categoryMatched: 'İptal' };
    }
  }

  // 1. Yönetim kararı
  if (['yönetim kararı', 'yönetim onaylı', 'üst yönetim', 'admin kararı'].some((k) => reason.includes(k))) {
    return { valid: true, score: 1.0, message: 'Yönetim inisiyatifi, kural onaylandı.', categoryMatched: 'Yönetim' };
  }

  // 2. Discord ToS
  if (['tos', 'discord terms', 'kural dışı', '13 yaş', 'terör', '3. parti', 'doxx', 'nsfw'].some((k) => reason.includes(k))) {
    return { valid: true, score: 1.0, message: 'Discord ToS ihlali, kalıcı işlem onaylandı.', categoryMatched: 'Discord ToS' };
  }

  // 3. Dini / Milli Değerler
  if (['dini', 'milli', 'kutsal', 'atatürk', 'kutsala', 'allah', 'peygamber', 'bayrak'].some((k) => {
    if (k === 'din' && (reason.includes('dinamik') || reason.includes('dinamig') || reason.includes('dinamiğ'))) {
      return false;
    }
    return reason.includes(k);
  })) {
    if (mins === 10080 || mins === 0 || mins >= 10080) {
      return { valid: true, score: 1.0, message: 'Süre ve tür kurallarla uyumlu.', categoryMatched: 'Dini/Milli Değerler' };
    }
    return { valid: false, score: 0, message: 'Geçersiz süre. Dini/Milli değerlere hakaret min 7 Gün (10080 dakika) veya süresiz olmalıdır.', categoryMatched: 'Dini/Milli Değerler' };
  }

  // 4. Reklam
  if (['reklam', 'davet linki', 'discord.gg', 'üye çekme'].some((k) => reason.includes(k))) {
    if (mins === 1440 || mins === 0 || mins >= 1440) {
      return { valid: true, score: 1.0, message: 'Süre ve tür kurallarla uyumlu.', categoryMatched: 'Reklam' };
    }
    return { valid: false, score: 0, message: 'Geçersiz süre. Reklam için süre 24 Saat (1440 dakika) veya süresiz olmalıdır.', categoryMatched: 'Reklam' };
  }

  // 5. Destek Talebi
  if (['destek talebi', 'bilet', 'ticket'].some((k) => reason.includes(k))) {
    if (['üslup', 'uygunsuz', 'troll'].some((k) => reason.includes(k))) {
      if (mins === 1440 || mins === 0) {
        return { valid: true, score: 1.0, message: 'Süre ve tür kurallarla uyumlu.', categoryMatched: 'Destek Talebi' };
      }
      return { valid: false, score: 0, message: 'Geçersiz süre. Bilet troll/uygunsuz üslup ihlali 24 Saat (1440 dakika) olmalıdır.', categoryMatched: 'Destek Talebi' };
    }
    if (['tekrarlı', 'aynı konu', 'bilet açımı'].some((k) => reason.includes(k))) {
      if (mins === 60 || mins === 0) {
        return { valid: true, score: 1.0, message: 'Süre ve tür kurallarla uyumlu.', categoryMatched: 'Destek Talebi' };
      }
      return { valid: false, score: 0, message: 'Geçersiz süre. Tekrarlı bilet ihlali 1 Saat (60 dakika) olmalıdır.', categoryMatched: 'Destek Talebi' };
    }
    if (mins === 60 || mins === 1440 || mins === 0) {
      return { valid: true, score: 1.0, message: 'Süre ve tür kurallarla uyumlu.', categoryMatched: 'Destek Talebi' };
    }
    return { valid: false, score: 0, message: 'Geçersiz süre. Destek talebi ihlali için izin verilen süreler 1 saat veya 24 saattir.', categoryMatched: 'Destek Talebi' };
  }

  // 6. Yetkililere Saygısızlık
  if (['yetkili', 'adal', 'doğukan', 'admin', 'mod', 'ekip', 'ismini kötüleme', 'aşağılama', 'iftira'].some((k) => reason.includes(k))) {
    const allowed = [720, 1440, 2880, 0];
    if (allowed.includes(mins)) {
      return { valid: true, score: 1.0, message: 'Süre ve tür kurallarla uyumlu.', categoryMatched: 'Yetkililere Saygısızlık' };
    }
    return { valid: false, score: 0, message: 'Geçersiz süre. Yetkililere saygısızlık için süre 12 Saat (720 dk), 24 Saat (1440 dk), 48 Saat (2880 dk) veya süresiz olmalıdır.', categoryMatched: 'Yetkililere Saygısızlık' };
  }

  // 7. Oyunculara Saygısızlık
  if (['oyuncu', 'şahsa', 'kişiye', 'üyeye', 'saygısızlık', 'hakaret', 'aptal', 'mal', 'salak', 'beyin yok', 'geri zekâlı', 'aile', 'ailevi', 'anne', 'baba', 'ananı', 'anneniz', 'orospu', 'troll', 'toxic', 'toksik', 'rahatsız', 'kitle', 'topluluk', 'herkes'].some((k) => reason.includes(k))) {
    if (['aile', 'ailevi', 'anne', 'baba', 'ananı', 'anneniz', 'orospu'].some((k) => reason.includes(k))) {
      const allowed = [360, 720, 1440, 0];
      if (allowed.includes(mins)) {
        return { valid: true, score: 1.0, message: 'Süre ve tür kurallarla uyumlu (Ailevi Değerlere Hakaret).', categoryMatched: 'Oyunculara Saygısızlık' };
      }
      return { valid: false, score: 0, message: 'Geçersiz süre. Ailevi değerlere hakaret için süre 6 Saat (360 dk), 12 Saat (720 dk), 24 Saat (1440 dk) veya süresiz olmalıdır.', categoryMatched: 'Oyunculara Saygısızlık' };
    }
    if (['troll', 'toxic', 'toksik', 'rahatsız'].some((k) => reason.includes(k))) {
      const allowed = [360, 720, 1440, 0];
      if (allowed.includes(mins)) {
        return { valid: true, score: 1.0, message: 'Süre ve tür kurallarla uyumlu (Rahatsız Edici Davranış/Troll).', categoryMatched: 'Oyunculara Saygısızlık' };
      }
      return { valid: false, score: 0, message: 'Geçersiz süre. Rahatsız edici davranış için süre 6 Saat (360 dk), 12 Saat (720 dk), 24 Saat (1440 dk) veya süresiz olmalıdır.', categoryMatched: 'Oyunculara Saygısızlık' };
    }
    if (['kitle', 'topluluk', 'herkes'].some((k) => reason.includes(k))) {
      const allowed = [720, 1440, 2880, 0];
      if (allowed.includes(mins)) {
        return { valid: true, score: 1.0, message: 'Süre ve tür kurallarla uyumlu (Kitleye Hakaret).', categoryMatched: 'Oyunculara Saygısızlık' };
      }
      return { valid: false, score: 0, message: 'Geçersiz süre. Kitleye hakaret için süre 12 Saat (720 dk), 24 Saat (1440 dk), 48 Saat (2880 dk) veya süresiz olmalıdır.', categoryMatched: 'Oyunculara Saygısızlık' };
    }
    // Default Şahsa Edilmiş Hakaret
    const allowed = [180, 360, 720, 0];
    if (allowed.includes(mins)) {
      return { valid: true, score: 1.0, message: 'Süre ve tür kurallarla uyumlu.', categoryMatched: 'Oyunculara Saygısızlık' };
    }
    return { valid: false, score: 0, message: 'Geçersiz süre. Oyunculara saygısızlık için süre 3 Saat (180 dk), 6 Saat (360 dk), 12 Saat (720 dk) veya süresiz olmalıdır.', categoryMatched: 'Oyunculara Saygısızlık' };
  }

  // 8. Küfür / Hakaret
  if (['küfür', 'argo', 'uygunsuz', 'kelime', 'mesaj', 'içerik', 'amk', 'amınakoyum', 'hassiktir', 'vay amk', 'cinsellik', 'cinsel', 'fantezi', 'sikerim', 'götünü', 'amını', 'şişe'].some((k) => reason.includes(k))) {
    if (['cinsellik', 'cinsel', 'fantezi', 'sikerim', 'götünü', 'amını', 'şişe'].some((k) => reason.includes(k))) {
      const allowed = [720, 1440, 2880, 0];
      if (allowed.includes(mins)) {
        return { valid: true, score: 1.0, message: 'Süre ve tür kurallarla uyumlu (Cinsellik).', categoryMatched: 'Küfür/Hakaret' };
      }
      return { valid: false, score: 0, message: 'Geçersiz süre. Cinsellik için süre 12 Saat (720 dk), 24 Saat (1440 dk), 48 Saat (2880 dk) veya süresiz olmalıdır.', categoryMatched: 'Küfür/Hakaret' };
    }
    const allowed = [15, 30, 60, 120, 240, 480, 720, 960, 1440, 1920, 2880, 0];
    if (allowed.includes(mins)) {
      return { valid: true, score: 1.0, message: 'Süre ve tür kurallarla uyumlu.', categoryMatched: 'Küfür/Hakaret' };
    }
    return { valid: false, score: 0, message: 'Geçersiz süre. Küfür/Hakaret için süre belirlenen kademelerde (15 dk - 48 saat) veya süresiz olmalıdır.', categoryMatched: 'Küfür/Hakaret' };
  }

  // 9. Sunucu Dinamiği
  if (['sunucu dinamiği', 'dinamik', 'sunucu düzeni', 'kanalın amacı', 'ekran', 'flood', 'spam', 'polemik', 'bütünlüğünü boz', 'harf uzatma', 'sohbet bütünlüğü', 'sohbetin bütünlüğü', 'sohbet boz', 'bütünlük', 'kanal dışı', 'amacı dışında', 'protesto', 'yönetimistifa', 'istifa', 'etiket', 'etiketleme', 'kampanya', 'yalan', 'yanlış bilgi', 'yanıltıcı', 'marka', 'zarar'].some((k) => reason.includes(k))) {
    if (['zarar', 'itibar', 'marka'].some((k) => reason.includes(k))) {
      const allowed = [1440, 2880, 5760, 0];
      if (allowed.includes(mins)) {
        return { valid: true, score: 1.0, message: 'Süre ve tür kurallarla uyumlu (Sunucuya/Markaya Zarar).', categoryMatched: 'Sunucu Dinamiği' };
      }
      return { valid: false, score: 0, message: 'Geçersiz süre. Sunucuya/Markaya zarar verebilecek konuşma için süre 24 Saat (1440 dk), 48 Saat (2880 dk), 96 Saat (5760 dk) veya süresiz olmalıdır.', categoryMatched: 'Sunucu Dinamiği' };
    }
    if (['yalan', 'yanlış bilgi', 'yanıltıcı', 'kapanacak'].some((k) => reason.includes(k))) {
      const allowed = [360, 720, 1440, 0];
      if (allowed.includes(mins)) {
        return { valid: true, score: 1.0, message: 'Süre ve tür kurallarla uyumlu (Yanlış/Yanıltıcı Bilgi).', categoryMatched: 'Sunucu Dinamiği' };
      }
      return { valid: false, score: 0, message: 'Geçersiz süre. Yanlış/Yanıltıcı bilgi yayımı için süre 6 Saat (360 dk), 12 Saat (720 dk), 24 Saat (1440 dk) veya süresiz olmalıdır.', categoryMatched: 'Sunucu Dinamiği' };
    }
    if (['polemik', 'siyasi', 'politika', 'siyaset'].some((k) => reason.includes(k))) {
      const allowed = [360, 720, 1440, 0];
      if (allowed.includes(mins)) {
        return { valid: true, score: 1.0, message: 'Süre ve tür kurallarla uyumlu (Siyasi/Polemik).', categoryMatched: 'Sunucu Dinamiği' };
      }
      return { valid: false, score: 0, message: 'Geçersiz süre. Polemiğe sebep olabilecek konuşmalar için süre 6 Saat (360 dk), 12 Saat (720 dk), 24 Saat (1440 dk) veya süresiz olmalıdır.', categoryMatched: 'Sunucu Dinamiği' };
    }
    if (['kampanya', 'protesto', 'istifa', 'yönetimistifa'].some((k) => reason.includes(k))) {
      const allowed = [360, 720, 1440, 0];
      if (allowed.includes(mins)) {
        return { valid: true, score: 1.0, message: 'Süre ve tür kurallarla uyumlu (Kampanya Başlatmak).', categoryMatched: 'Sunucu Dinamiği' };
      }
      return { valid: false, score: 0, message: 'Geçersiz süre. Kampanya başlatmak için süre 6 Saat (360 dk), 12 Saat (720 dk), 24 Saat (1440 dk) veya süresiz olmalıdır.', categoryMatched: 'Sunucu Dinamiği' };
    }
    if (['etiket', 'etiketleme'].some((k) => reason.includes(k))) {
      const allowed = [180, 360, 720, 0];
      if (allowed.includes(mins)) {
        return { valid: true, score: 1.0, message: 'Süre ve tür kurallarla uyumlu (Yönetime Tekrarlı Etiket).', categoryMatched: 'Sunucu Dinamiği' };
      }
      return { valid: false, score: 0, message: 'Geçersiz süre. Yönetime tekrarlı etiket için süre 3 Saat (180 dk), 6 Saat (360 dk), 12 Saat (720 dk) veya süresiz olmalıdır.', categoryMatched: 'Sunucu Dinamiği' };
    }
    const allowed = [15, 30, 60, 120, 240, 480, 960, 1920, 0];
    if (allowed.includes(mins)) {
      return { valid: true, score: 1.0, message: 'Süre ve tür kurallarla uyumlu.', categoryMatched: 'Sunucu Dinamiği' };
    }
    return { valid: false, score: 0, message: 'Geçersiz süre. Sunucu Dinamiği için süre belirlenen kademelerde (15 dk - 32 saat) veya süresiz olmalıdır.', categoryMatched: 'Sunucu Dinamiği' };
  }

  const norm = reason.toLowerCase().trim();
  const placeholders = new Set([
    'ada', 'de', 'denem', 'deneme', 'test', 'tst', 'placeholder', 'bos', 'boslar', 'yok',
    'abc', 'denemeler', 'asdasd', 'qwerty', 'denemee', 'deneme123', '/', '...', '.', '..', '-', '_'
  ]);
  const isPlaceholder = placeholders.has(norm) || 
    /^[^a-z0-9ğışçöü]*$/i.test(norm) || 
    (norm.length <= 3);

  if (isPlaceholder) {
    return { valid: false, score: 0, message: 'Geçersiz veya placeholder ceza sebebi. CUK kitapçığına uygun açıklama girilmelidir.', categoryMatched: 'Diğer' };
  }

  return { valid: true, score: 0.8, message: 'Tanımlanamayan ceza kategorisi. Olası manuel işlem.', categoryMatched: 'Diğer' };
}

export function calculatePerformanceScore(validCount: number, invalidCount: number, pendingCount: number): number {
  return validCount * 2 - invalidCount * 3 - pendingCount;
}

export function getReliabilityStatus(validCount: number, invalidCount: number): string {
  const total = validCount + invalidCount;
  if (total === 0) return 'Bekleyen';
  const acc = (validCount / total) * 100;
  if (acc >= 95) return 'Guvenilir';
  if (acc >= 80) return 'Izlemede';
  return 'Riskli';
}
