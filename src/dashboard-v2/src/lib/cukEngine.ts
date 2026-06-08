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

export function snapDurationForValidation(mins: number | null | undefined): number {
  if (mins === null || mins === undefined || !Number.isFinite(mins) || mins <= 0) return mins ?? 0;
  if (mins % 60 === 59) return mins + 1;
  return mins;
}

export function isDurationAllowed(mins: number, allowed: number[]): boolean {
  if (allowed.includes(mins)) return true;
  // Apply 5 minutes tolerance pay for finite non-zero allowed durations
  for (const a of allowed) {
    if (a > 0 && Math.abs(mins - a) <= 5) {
      return true;
    }
  }
  return false;
}

function normalizeTurkishText(value: string | null | undefined): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/I/g, 'ı')
    .replace(/İ/g, 'i')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .trim()
    .replace(/\s+/g, ' ');
}

export function getRuleDetails(reasonRaw: string): {
  category: string | null;
  degree: number | null;
  allowedMinutes: number[];
} {
  const reason = normalizeTurkishText(reasonRaw);
  const match = (kwList: string[]) => kwList.some((k) => reason.includes(normalizeTurkishText(k)));

  // 1. Yönetim kararı
  if (match(['yönetim kararı', 'yönetim onaylı', 'üst yönetim', 'admin kararı'])) {
    return { category: 'Yönetim', degree: null, allowedMinutes: [] };
  }

  // Teyit Sistemi / Teyite Gelmemek
  if (match(['teyit', 'teyite gelmemek', 'teyitten kacmak', 'teyitten kaçmak'])) {
    return { category: 'Teyit', degree: null, allowedMinutes: [0] };
  }

  // Cezadan Kaçma
  if (match(['cezadan kacmak', 'cezadan kaçmak'])) {
    return { category: 'Cezadan Kaçma', degree: null, allowedMinutes: [0] };
  }

  // Yan Hesap Kullanımı
  if (match(['yan hesap', 'alt account', 'yanhesap'])) {
    return { category: 'Yan Hesap Kullanımı', degree: null, allowedMinutes: [0] };
  }

  // 2. Discord ToS
  if (match(['tos', 'discord terms', 'kural dışı', '13 yaş', 'terör', '3. parti', 'doxx', 'nsfw'])) {
    return { category: 'Discord ToS', degree: null, allowedMinutes: [0] };
  }

  // 3. Dini / Milli Değerler
  if (['dini', 'milli', 'kutsal', 'atatürk', 'kutsala', 'allah', 'peygamber', 'bayrak'].some((k) => {
    const normK = normalizeTurkishText(k);
    if (normK === 'din' && (reason.includes('dinamik') || reason.includes('dinamig') || reason.includes('dinamiğ') || reason.includes('dinamik'))) {
      return false;
    }
    return reason.includes(normK);
  })) {
    return { category: 'Dini/Milli Değerler', degree: null, allowedMinutes: [10080, 0] };
  }

  // 4. Reklam
  if (match(['reklam', 'davet linki', 'discord.gg', 'üye çekme'])) {
    return { category: 'Reklam', degree: null, allowedMinutes: [1440, 0] };
  }

  // 5. Destek Talebi
  if (match(['destek talebi', 'bilet', 'ticket'])) {
    if (match(['üslup', 'uygunsuz', 'troll'])) {
      return { category: 'Destek Talebi', degree: 2, allowedMinutes: [1440, 0] };
    }
    if (match(['tekrarlı', 'aynı konu', 'bilet açımı'])) {
      return { category: 'Destek Talebi', degree: 1, allowedMinutes: [60, 0] };
    }
    return { category: 'Destek Talebi', degree: null, allowedMinutes: [60, 1440, 0] };
  }

  // 6. Yetkililere Saygısızlık
  if (match(['yetkili', 'adal', 'doğukan', 'admin', 'mod', 'ekip', 'ismini kötüleme', 'aşağılama', 'iftira'])) {
    return { category: 'Yetkililere Saygısızlık', degree: null, allowedMinutes: [720, 1440, 2880, 0] };
  }

  // 7. Oyunculara Saygısızlık
  if (match(['oyuncu', 'şahsa', 'kişiye', 'üyeye', 'saygısızlık', 'hakaret', 'aptal', 'mal', 'salak', 'beyin yok', 'geri zekâlı', 'aile', 'ailevi', 'anne', 'baba', 'ananı', 'anneniz', 'orospu', 'troll', 'toxic', 'toksik', 'rahatsız', 'kitle', 'topluluk', 'herkes'])) {
    if (match(['aile', 'ailevi', 'anne', 'baba', 'ananı', 'anneniz', 'orospu'])) {
      return { category: 'Oyunculara Saygısızlık', degree: 2, allowedMinutes: [360, 720, 1440, 0] };
    }
    if (match(['troll', 'toxic', 'toksik', 'rahatsız'])) {
      return { category: 'Oyunculara Saygısızlık', degree: 3, allowedMinutes: [360, 720, 1440, 0] };
    }
    if (match(['kitle', 'topluluk', 'herkes'])) {
      return { category: 'Oyunculara Saygısızlık', degree: 4, allowedMinutes: [720, 1440, 2880, 0] };
    }
    // Default Şahsa Edilmiş Hakaret
    return { category: 'Oyunculara Saygısızlık', degree: 1, allowedMinutes: [180, 360, 720, 0] };
  }

  // 8. Küfür / Hakaret
  if (match(['cinsellik', 'cinsel', 'fantezi', 'sex', 'nsfw', 'sikerim', 'götünü', 'amını', 'şişe'])) {
    return { category: 'Küfür/Hakaret', degree: 2, allowedMinutes: [720, 1440, 2880, 0] };
  }
  if (match(['küfür', 'argo', 'uygunsuz', 'kelime', 'mesaj', 'içerik', 'amk', 'amınakoyum', 'hassiktir', 'vay amk'])) {
    return { category: 'Küfür/Hakaret', degree: 1, allowedMinutes: [15, 30, 60, 120, 240, 480, 960, 1920, 0] };
  }

  // 9. Sunucu Dinamiği
  if (match(['sunucu dinamiği', 'dinamik', 'sunucu düzeni', 'kanalın amacı', 'ekran', 'flood', 'spam', 'polemik', 'bütünlüğünü boz', 'harf uzatma', 'sohbet bütünlüğü', 'sohbetin bütünlüğü', 'sohbet boz', 'bütünlük', 'kanal dışı', 'amacı dışında', 'protesto', 'yönetimistifa', 'istifa', 'etiket', 'etiketleme', 'kampanya', 'yalan', 'yanlış bilgi', 'yanıltıcı', 'marka', 'zarar'])) {
    if (match(['zarar', 'itibar', 'marka'])) {
      return { category: 'Sunucu Dinamiği', degree: 2, allowedMinutes: [1440, 2880, 5760, 0] };
    }
    if (match(['yalan', 'yanlış bilgi', 'yanıltıcı', 'kapanacak'])) {
      return { category: 'Sunucu Dinamiği', degree: 3, allowedMinutes: [360, 720, 1440, 0] };
    }
    if (match(['polemik', 'siyasi', 'politika', 'siyaset'])) {
      return { category: 'Sunucu Dinamiği', degree: 4, allowedMinutes: [360, 720, 1440, 0] };
    }
    if (match(['kampanya', 'protesto', 'istifa', 'yönetimistifa'])) {
      return { category: 'Sunucu Dinamiği', degree: 6, allowedMinutes: [360, 720, 1440, 0] };
    }
    if (match(['etiket', 'etiketleme'])) {
      return { category: 'Sunucu Dinamiği', degree: 7, allowedMinutes: [180, 360, 720, 0] };
    }
    if (match(['kanal dışı', 'amacı dışında', 'kanalın amacı', 'görsel odası'])) {
      return { category: 'Sunucu Dinamiği', degree: 1, allowedMinutes: [15, 30, 60, 120, 180, 240, 360, 480, 720, 960, 1440, 1920, 2880, 5760, 0] };
    }
    if (match(['flood', 'spam', 'bütünlüğünü boz', 'harf uzatma', 'sohbet bütünlüğü', 'sohbetin bütünlüğü', 'sohbet boz', 'bütünlük', 'latin alfabesi dışı', 'embed'])) {
      return { category: 'Sunucu Dinamiği', degree: 5, allowedMinutes: [15, 30, 60, 120, 180, 240, 360, 480, 720, 960, 1440, 1920, 2880, 5760, 0] };
    }
    // Generic fallback for Sunucu Dinamiği
    return {
      category: 'Sunucu Dinamiği',
      degree: null,
      allowedMinutes: [15, 30, 60, 120, 180, 240, 360, 480, 720, 960, 1440, 1920, 2880, 5760, 0],
    };
  }

  return { category: null, degree: null, allowedMinutes: [] };
}

export function validateCase(reasonRaw: string, durationMinutes?: number | null): CUKResult {
  const reason = normalizeTurkishText(reasonRaw);
  const mins = snapDurationForValidation(durationMinutes || 0);

  if (!reason) {
    return { valid: false, score: 0, message: 'Ceza sebebi girilmemiş.', categoryMatched: 'Yok' };
  }

  for (const kw of INVALID_KEYWORDS) {
    if (reason.includes(normalizeTurkishText(kw))) {
      return { valid: false, score: 0, message: `İptal kelimesi içeriyor: ${kw}`, categoryMatched: 'İptal' };
    }
  }

  const rule = getRuleDetails(reasonRaw);

  if (!rule.category) {
    const placeholders = new Set([
      'ada', 'de', 'denem', 'deneme', 'test', 'tst', 'placeholder', 'bos', 'boslar', 'yok',
      'abc', 'denemeler', 'asdasd', 'qwerty', 'denemee', 'deneme123', '/', '...', '.', '..', '-', '_'
    ]);
    const isPlaceholder = placeholders.has(reason) || 
      /^[^a-z0-9]*$/i.test(reason) || 
      (reason.length <= 3);

    if (isPlaceholder) {
      return { valid: false, score: 0, message: 'Geçersiz veya placeholder ceza sebebi. CUK kitapçığına uygun açıklama girilmelidir.', categoryMatched: 'Diğer' };
    }

    return { valid: false, score: 0, message: 'Tanımlanamayan ceza kategorisi.', categoryMatched: 'Diğer' };
  }

  if (rule.category === 'Yönetim') {
    return { valid: true, score: 1.0, message: 'Yönetim inisiyatifi, kural onaylandı.', categoryMatched: 'Yönetim' };
  }

  if (isDurationAllowed(mins, rule.allowedMinutes)) {
    return { valid: true, score: 1.0, message: 'Süre ve tür kurallarla uyumlu.', categoryMatched: rule.category };
  }

  const formatMins = (m: number) => {
    if (m === 0) return 'Süresiz';
    if (m < 60) return `${m} dk`;
    if (m % 60 === 0) return `${m / 60} saat`;
    return `${m} dk`;
  };
  const expectedList = rule.allowedMinutes.map(formatMins).join(', ');
  const givenLabel = mins === 0 ? 'Süresiz' : formatMins(mins);
  return {
    valid: false,
    score: 0,
    message: `Geçersiz süre. Verilen: ${givenLabel}. İzin verilen süreler: ${expectedList}`,
    categoryMatched: rule.category
  };
}

export function calculatePerformanceScore(validCount: number, invalidCount: number, pendingCount: number): number {
  return validCount * 2 - invalidCount * 3 - pendingCount;
}

export function getReliabilityStatus(validCount: number, invalidCount: number): string {
  const total = validCount + invalidCount;
  if (total === 0) return 'Bekleyen';
  const acc = (validCount / total) * 100;
  if (acc >= 70) return 'Guvenilir';
  if (acc >= 50) return 'Izlemede';
  return 'Riskli';
}

export type DurationVerdict = 'valid' | 'invalid' | 'pending' | 'manual';

export interface ValidDurationsResult {
  category: string | null;
  degree: number | null;
  allowedMinutes: number[];
  allowedLabels: string[];
  minMinutes: number | null;
  maxMinutes: number | null;
  isPermanentAllowed: boolean;
  currentMinutes: number | null;
  verdict: DurationVerdict;
  message: string;
}

function minutesToLabel(mins: number): string {
  if (mins === 0 || mins === Infinity || mins > 50000000) return 'Süresiz';
  if (mins < 60) return `${mins} dk`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)} saat`;
  if (mins < 60 * 24 * 7) return `${Math.round(mins / (60 * 24))} gün`;
  return `${Math.round(mins / (60 * 24 * 7))} hafta`;
}

export function getValidDurationsForCase(input: {
  reason_raw?: string;
  duration_ms?: number | null;
  is_permanent?: boolean;
  type?: string;
}): ValidDurationsResult {
  const reason = (input.reason_raw || '').trim();
  const durationMins = input.is_permanent
    ? 0
    : input.duration_ms != null
      ? Math.floor(input.duration_ms / 60000)
      : 0;

  const result = validateCase(reason, durationMins);
  const rule = getRuleDetails(reason);

  if (!rule.category) {
    return {
      category: null,
      degree: null,
      allowedMinutes: [],
      allowedLabels: [],
      minMinutes: null,
      maxMinutes: null,
      isPermanentAllowed: false,
      currentMinutes: durationMins,
      verdict: 'pending',
      message: result.message,
    };
  }

  if (rule.category === 'Yönetim') {
    return {
      category: rule.category,
      degree: null,
      allowedMinutes: [],
      allowedLabels: ['Yönetim onayı — süre kısıtı yok'],
      minMinutes: null,
      maxMinutes: null,
      isPermanentAllowed: true,
      currentMinutes: durationMins,
      verdict: 'valid',
      message: result.message,
    };
  }

  const allowedMinutes = rule.allowedMinutes.filter((m) => m > 0);
  const isPermanentAllowed = rule.allowedMinutes.includes(0);
  const allowedLabels = [
    ...allowedMinutes.map(minutesToLabel),
    ...(isPermanentAllowed ? ['Süresiz / Ban'] : []),
  ];

  let verdict: DurationVerdict = 'manual';
  if (result.valid) verdict = 'valid';
  else if (result.score === 0 && result.message.includes('Geçersiz')) verdict = 'invalid';
  else if (!reason) verdict = 'pending';

  const finite = allowedMinutes.filter((m) => m > 0);
  return {
    category: rule.category,
    degree: rule.degree,
    allowedMinutes: rule.allowedMinutes,
    allowedLabels,
    minMinutes: finite.length ? Math.min(...finite) : null,
    maxMinutes: finite.length ? Math.max(...finite) : null,
    isPermanentAllowed,
    currentMinutes: durationMins,
    verdict,
    message: result.message,
  };
}
