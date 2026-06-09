/**
 * CUK System Rules and Automatic Validation Engine for Lutheus CezaRapor
 */

export interface CukRule {
  category: string;
  subCategory?: string;
  degree?: string;
  durations: string[]; // repeat sequence e.g., ['3 saat', '6 saat', '12 saat', 'Sınırsız Kısıtlama']
}

export const CUK_RULES: Record<string, CukRule> = {
  YETKILI_HAKARET: {
    category: 'MUTE',
    subCategory: 'Yetkiliye Hakaret/İsmini Kötüleme/Aşağılama/İftira Atma',
    durations: ['12 saat', '24 saat', '48 saat', 'Sınırsız Kısıtlama']
  },
  SAHSA_HAKARET: {
    category: 'MUTE',
    subCategory: 'Şahsa Edilmiş Hakaret (1. Derece)',
    durations: ['3 saat', '6 saat', '12 saat', 'Sınırsız Kısıtlama']
  },
  AILEVI_HAKARET: {
    category: 'MUTE',
    subCategory: 'Ailevi Değerlere Hakaret (2. Derece)',
    durations: ['6 saat', '12 saat', '24 saat', 'Sınırsız Kısıtlama']
  },
  TROLL: {
    category: 'MUTE',
    subCategory: 'Rahatsız Edici Davranış Sergileme/Troll (3. Derece)',
    durations: ['6 saat', '12 saat', '24 saat', 'Sınırsız Kısıtlama']
  },
  KITLE_HAKARET: {
    category: 'MUTE',
    subCategory: 'Kitleye Hakaret (4. Derece)',
    durations: ['12 saat', '24 saat', '48 saat', 'Sınırsız Kısıtlama']
  },
  YONELTME_OLMAYAN_HAKARET: {
    category: 'MUTE',
    subCategory: 'Yöneltme Olmayan Hakaret (1. Derece)',
    durations: ['15 dakika', '30 dakika', '1 saat', '2 saat', '4 saat', '8 saat', '16 saat', '32 saat', 'Sınırsız Kısıtlama']
  },
  CINSEL_HAKARET: {
    category: 'MUTE',
    subCategory: 'Cinsellik (2. Derece)',
    durations: ['12 saat', '24 saat', '48 saat', 'Sınırsız Kısıtlama']
  },
  DINI_MILLI_HAKARET: {
    category: 'MUTE',
    subCategory: 'Dini/Milli/Kutsal vb. Değerlere Saygısızlık/Hakaret',
    durations: ['7 gün', 'Sınırsız Kısıtlama']
  },
  AMAC_DISI_KULLANIM: {
    category: 'MUTE',
    subCategory: 'Kanalın Amacı Dışında Kullanımı (1. Derece)',
    durations: ['15 dakika', '30 dakika', '1 saat', '2 saat', '4 saat', '8 saat', '16 saat', '32 saat', 'Sınırsız Kısıtlama']
  },
  SUNUCU_ZARAR: {
    category: 'MUTE',
    subCategory: 'Sunucuya/Lutheus Markasına Zarar Verebilecek Paylaşım/Konuşma (2. Derece)',
    durations: ['24 saat', '48 saat', '96 saat', 'Sınırsız Kısıtlama']
  },
  YANLIS_BILGI: {
    category: 'MUTE',
    subCategory: 'Kasıtlı Olarak Yanlış/Yanıltıcı Bilgi Yayımı (3. Derece)',
    durations: ['6 saat', '12 saat', '24 saat', 'Sınırsız Kısıtlama']
  },
  POLITICAL_DEBATE: {
    category: 'MUTE',
    subCategory: 'Polemiğe Sebep Olabilecek Dini/Milli/Irki/Siyasi Konuşmalar/Paylaşımlar (4. Derece)',
    durations: ['6 saat', '12 saat', '24 saat', 'Sınırsız Kısıtlama']
  },
  CHAT_KIRLETME: {
    category: 'MUTE',
    subCategory: 'Sohbetin Bütünlüğünü Bozacak Davranış (5. Derece)',
    durations: ['15 dakika', '30 dakika', '1 saat', '2 saat', '4 saat', '8 saat', '16 saat', '32 saat', 'Sınırsız Kısıtlama']
  },
  KAMPANYA: {
    category: 'MUTE',
    subCategory: 'Kampanya Başlatmak (6. Derece)',
    durations: ['6 saat', '12 saat', '24 saat', 'Sınırsız Kısıtlama']
  },
  YONETIME_ETIKET: {
    category: 'MUTE',
    subCategory: 'Yönetime Tekrarlı Etiket (7. Derece)',
    durations: ['3 saat', '6 saat', '12 saat', 'Sınırsız Kısıtlama']
  },
  REKLAM: {
    category: 'REKLAM',
    subCategory: 'Reklam/Sunucuya Üye Çekme/Sunucu Kitlesi Yardımıyla Kâr Etme',
    durations: ['1 gün', 'Sınırsız Kısıtlama']
  },
  TICKET_USLUP: {
    category: 'DESTEK TALEBI',
    subCategory: 'Destek Talebi İçerisinde Uygunsuz Üslup Kullanımı',
    durations: ['24 saat']
  },
  TICKET_TEKRAR: {
    category: 'DESTEK TALEBI',
    subCategory: 'Devamlı Şekilde Aynı Konu Hakkında Tekrarlı Bilet Açımı',
    durations: ['1 saat']
  },
  TICKET_TROLL: {
    category: 'DESTEK TALEBI',
    subCategory: 'Destek Talebi İçerisinde Troll Yapmak',
    durations: ['24 saat']
  }
};

/**
 * Matches a free text reason with our categorized list of rules
 */
export function matchCukRule(rawReason: string): { key: string; rule: CukRule } | null {
  const norm = (rawReason || '').trim().replace(/\s+/g, ' ').toLowerCase();
  
  for (const [key, rule] of Object.entries(CUK_RULES)) {
    const subLower = rule.subCategory?.toLowerCase() || '';
    const nameLower = key.toLowerCase();
    
    // Check match or substring match
    if (
      norm.includes(subLower) || 
      subLower.includes(norm) ||
      norm.includes(subLower.split(' (')[0].toLowerCase()) || // strip degrees
      nameLower === norm
    ) {
      return { key, rule };
    }
  }
  
  // Hand-curated substring aliases
  if (norm.includes('yetkili') && norm.includes('hakaret')) {
    return { key: 'YETKILI_HAKARET', rule: CUK_RULES.YETKILI_HAKARET };
  }
  if (norm.includes('şahsa') || (norm.includes('oyuncu') && norm.includes('saygısızlık')) || norm.includes('saygısızlık')) {
    return { key: 'SAHSA_HAKARET', rule: CUK_RULES.SAHSA_HAKARET };
  }
  if (norm.includes('ailevi') || norm.includes('aile')) {
    return { key: 'AILEVI_HAKARET', rule: CUK_RULES.AILEVI_HAKARET };
  }
  if (norm.includes('troll') || norm.includes('rahatsız edici')) {
    return { key: 'TROLL', rule: CUK_RULES.TROLL };
  }
  if (norm.includes('kitle')) {
    return { key: 'KITLE_HAKARET', rule: CUK_RULES.KITLE_HAKARET };
  }
  if (norm.includes('yöneltme olmayan') || norm.includes('küfür')) {
    return { key: 'YONELTME_OLMAYAN_HAKARET', rule: CUK_RULES.YONELTME_OLMAYAN_HAKARET };
  }
  if (norm.includes('cinsellik') || norm.includes('cinsel')) {
    return { key: 'CINSEL_HAKARET', rule: CUK_RULES.CINSEL_HAKARET };
  }
  if (norm.includes('dini') || norm.includes('milli') || norm.includes('değer')) {
    return { key: 'DINI_MILLI_HAKARET', rule: CUK_RULES.DINI_MILLI_HAKARET };
  }
  if (norm.includes('amaç dışı') || norm.includes('kanal') || norm.includes('kullanımı')) {
    return { key: 'AMAC_DISI_KULLANIM', rule: CUK_RULES.AMAC_DISI_KULLANIM };
  }
  if (norm.includes('zarar') || norm.includes('itibar')) {
    return { key: 'SUNUCU_ZARAR', rule: CUK_RULES.SUNUCU_ZARAR };
  }
  if (norm.includes('yanlış bilgi') || norm.includes('yanıltıcı')) {
    return { key: 'YANLIS_BILGI', rule: CUK_RULES.YANLIS_BILGI };
  }
  if (norm.includes('polemik')) {
    return { key: 'POLITICAL_DEBATE', rule: CUK_RULES.POLITICAL_DEBATE };
  }
  if (norm.includes('spam') || norm.includes('bütünlüğü') || norm.includes('flood')) {
    return { key: 'CHAT_KIRLETME', rule: CUK_RULES.CHAT_KIRLETME };
  }
  if (norm.includes('kampanya')) {
    return { key: 'KAMPANYA', rule: CUK_RULES.KAMPANYA };
  }
  if (norm.includes('etiket')) {
    return { key: 'YONETIME_ETIKET', rule: CUK_RULES.YONETIME_ETIKET };
  }
  if (norm.includes('reklam')) {
    return { key: 'REKLAM', rule: CUK_RULES.REKLAM };
  }
  if (norm.includes('bilet') || norm.includes('bilette') || norm.includes('destek talebi')) {
    if (norm.includes('üslup') || norm.includes('hakaret')) {
      return { key: 'TICKET_USLUP', rule: CUK_RULES.TICKET_USLUP };
    }
    if (norm.includes('troll')) {
      return { key: 'TICKET_TROLL', rule: CUK_RULES.TICKET_TROLL };
    }
    return { key: 'TICKET_TEKRAR', rule: CUK_RULES.TICKET_TEKRAR };
  }
  
  return null;
}

/**
 * Normalizes duration string to standard terms like "12 saat", "3 saat", "15 dakika", "Süresiz / Ban"
 */
export function normalizeDurationString(rawDuration: string): string {
  const norm = (rawDuration || '').trim().toLowerCase();
  if (norm.includes('sınırsız') || norm.includes('kalıcı') || norm.includes('100y') || norm.includes('perma') || norm.includes('ban')) {
    return 'Sınırsız Kısıtlama';
  }
  
  // Format hours
  if (norm.includes('saat') || norm.endsWith('sa') || norm.endsWith('h')) {
    const digits = norm.replace(/\D/g, '');
    return digits ? `${digits} saat` : rawDuration;
  }
  
  // Format minutes
  if (norm.includes('dakika') || norm.endsWith('dk') || norm.endsWith('m')) {
    const digits = norm.replace(/\D/g, '');
    return digits ? `${digits} dakika` : rawDuration;
  }
  
  // Format days
  if (norm.includes('gün') || norm.endsWith('g') || norm.endsWith('d')) {
    const digits = norm.replace(/\D/g, '');
    return digits ? `${digits} gün` : rawDuration;
  }
  
  return rawDuration;
}

/**
 * Validates a case details and returns structured report
 */
export interface ValidationResult {
  isValid: boolean;
  expectedDuration: string;
  matchedRule: CukRule | null;
  errorMessage?: string;
}

export function validatePenaltyRecord(reason: string, duration: string, repeatIndex: number = 0): ValidationResult {
  const match = matchCukRule(reason);
  if (!match) {
    return {
      isValid: true, // If we don't have a rigid rule, let it pass gracefully
      expectedDuration: duration,
      matchedRule: null
    };
  }
  
  const normDuration = normalizeDurationString(duration);
  const { rule } = match;
  
  // Grab correct limit from repeat array
  const seqIdx = Math.max(0, Math.min(repeatIndex, rule.durations.length - 1));
  const expected = rule.durations[seqIdx];
  const normExpected = normalizeDurationString(expected);
  
  if (normDuration.toLowerCase() === normExpected.toLowerCase()) {
    return {
      isValid: true,
      expectedDuration: expected,
      matchedRule: rule
    };
  }
  
  return {
    isValid: false,
    expectedDuration: expected,
    matchedRule: rule,
    errorMessage: `CUK yaptırım ihlali: Bu ihlal (${seqIdx + 1}x tekrarı) için ceza süresi tam olarak "${expected}" olmalıdır. Alınan ceza süresi: "${duration}"`
  };
}
