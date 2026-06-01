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

  // Yönetim kararı
  if (['yönetim kararı', 'yönetim onaylı', 'üst yönetim', 'admin kararı'].some((k) => reason.includes(k))) {
    return { valid: true, score: 1.0, message: 'Yönetim inisiyatifi, kural onaylandı.', categoryMatched: 'Yönetim' };
  }

  // Discord ToS
  if (['tos', 'discord terms', 'kural dışı', '13 yaş', 'terör'].some((k) => reason.includes(k))) {
    return { valid: true, score: 1.0, message: 'Discord ToS ihlali, kalıcı işlem onaylandı.', categoryMatched: 'Discord ToS' };
  }

  // Dini / Milli Değerler
  if (['dini değer', 'milli değer', 'kutsal', 'atatürk', 'din', 'milli', 'kutsala'].some((k) => {
    if (k === 'din' && (reason.includes('dinamik') || reason.includes('dinamig') || reason.includes('dinamiğ'))) {
      return false;
    }
    return reason.includes(k);
  })) {
    if (mins === 10080 || mins === 0 || mins >= 10080) {
      return { valid: true, score: 1.0, message: 'Süre ve tür kurallarla uyumlu.', categoryMatched: 'Dini/Milli Değerler' };
    }
    return { valid: false, score: 0, message: 'Geçersiz süre. Dini/Milli değerlere hakaret min 7 Gün olmalıdır.', categoryMatched: 'Dini/Milli Değerler' };
  }

  // Reklam
  if (['reklam', 'davet linki', 'discord.gg', 'youtube.com', 'üye çekme'].some((k) => reason.includes(k))) {
    if (mins === 1440 || mins === 0 || mins >= 1440) {
      return { valid: true, score: 1.0, message: 'Süre ve tür kurallarla uyumlu.', categoryMatched: 'Reklam' };
    }
    return { valid: false, score: 0, message: 'Geçersiz süre. Reklam için min 24 Saat olmalıdır.', categoryMatched: 'Reklam' };
  }

  // Destek Talebi
  if (['destek', 'bilet', 'ticket', 'tekrarlı', 'troll'].some((k) => reason.includes(k))) {
    if ([60, 1440, 0].includes(mins) || mins >= 60) {
      return { valid: true, score: 1.0, message: 'Süre ve tür kurallarla uyumlu.', categoryMatched: 'Destek Talebi' };
    }
    return { valid: false, score: 0, message: 'Geçersiz süre. Destek talebi ihlali min 1 Saat olmalıdır.', categoryMatched: 'Destek Talebi' };
  }

  // Yetkililere Saygısızlık
  if (['yetkili', 'adal', 'doğukan', 'admin', 'mod', 'üst yönetim', 'ekip', 'ismini kötüleme', 'aşağılama', 'iftira'].some((k) => reason.includes(k))) {
    const allowed = [720, 1440, 2880, 0];
    if (allowed.includes(mins) || mins >= 720) {
      return { valid: true, score: 1.0, message: 'Süre ve tür kurallarla uyumlu.', categoryMatched: 'Yetkililere Saygısızlık' };
    }
    return { valid: false, score: 0, message: 'Geçersiz süre. Yetkililere saygısızlık için süre min 12 Saat olmalıdır.', categoryMatched: 'Yetkililere Saygısızlık' };
  }

  // Oyunculara Saygısızlık
  if (['oyuncu', 'şahsa', 'kişiye', 'üyeye', 'saygısızlık', 'hakaret'].some((k) => reason.includes(k))) {
    const allowed = [360, 720, 1440, 2880, 0];
    if (allowed.includes(mins) || mins >= 360) {
      return { valid: true, score: 1.0, message: 'Süre ve tür kurallarla uyumlu.', categoryMatched: 'Oyunculara Saygısızlık' };
    }
    return { valid: false, score: 0, message: 'Geçersiz süre. Oyunculara saygısızlık için süre min 6 Saat olmalıdır.', categoryMatched: 'Oyunculara Saygısızlık' };
  }

  // Küfür / Hakaret
  if (['küfür', 'argo', 'uygunsuz', 'kelime', 'mesaj', 'içerik'].some((k) => reason.includes(k))) {
    const allowed = [15, 30, 60, 120, 240, 480, 720, 960, 1440, 1920, 2880, 0];
    if (allowed.includes(mins) || mins >= 15) {
      return { valid: true, score: 1.0, message: 'Süre ve tür kurallarla uyumlu.', categoryMatched: 'Küfür/Hakaret' };
    }
    return { valid: false, score: 0, message: 'Geçersiz süre. Küfür/Hakaret için süre belirlenen kademelerde olmalıdır.', categoryMatched: 'Küfür/Hakaret' };
  }

  // Sunucu Dinamiği
  if (['sunucu dinamiği', 'dinamik', 'sunucu düzeni', 'kanalın amacı', 'ekran', 'flood', 'spam', 'polemik'].some((k) => reason.includes(k))) {
    const allowed = [15, 30, 60, 120, 180, 240, 360, 480, 720, 960, 1440, 1920, 2880, 5760, 0];
    if (allowed.includes(mins) || mins >= 15) {
      return { valid: true, score: 1.0, message: 'Süre ve tür kurallarla uyumlu.', categoryMatched: 'Sunucu Dinamiği' };
    }
    return { valid: false, score: 0, message: 'Geçersiz süre eşleşmesi (Sunucu Dinamiği)', categoryMatched: 'Sunucu Dinamiği' };
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
