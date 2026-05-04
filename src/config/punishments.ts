export type PunishmentType = 'MUTE' | 'BAN' | 'RESTRICTION' | 'TICKET_RESTRICTION';
export type TimeUnit = 'MINUTES' | 'HOURS' | 'DAYS' | 'UNLIMITED';

export interface PunishmentStep {
  duration: number; // 0 means UNLIMITED
  unit: TimeUnit;
}

export interface RuleCategory {
  id: string;
  name: string;
  group: 'A' | 'B' | 'C' | 'D' | 'DIRECT_RESTRICTION' | 'DIRECT_BAN' | 'TICKET';
}

export interface Rule {
  id: string;
  categoryId: string;
  name: string;
  type: PunishmentType;
  steps: PunishmentStep[];
}

export const CATEGORIES: Record<string, RuleCategory> = {
  A: { id: 'A', name: 'Yetkililere ve Oyunculara Saygısızlık', group: 'A' },
  B: { id: 'B', name: 'Küfür/Hakaret/Uygunsuz Öge', group: 'B' },
  C: { id: 'C', name: 'Sunucu Dinamiğini Sarsmak', group: 'C' },
  D: { id: 'D', name: 'Reklam', group: 'D' },
  DIRECT_RESTRICTION: { id: 'DIRECT_RESTRICTION', name: 'Doğrudan Kısıtlama Sebepleri', group: 'DIRECT_RESTRICTION' },
  DIRECT_BAN: { id: 'DIRECT_BAN', name: 'Doğrudan Ban Sebepleri', group: 'DIRECT_BAN' },
  TICKET: { id: 'TICKET', name: 'Destek Talebi (Ticket) Cezaları', group: 'TICKET' },
};

export const RULES: Record<string, Rule> = {
  A1: {
    id: 'A1', categoryId: 'A', name: 'Yetkiliye Hakaret/İsmini Kötüleme vs.', type: 'MUTE',
    steps: [{ duration: 12, unit: 'HOURS' }, { duration: 24, unit: 'HOURS' }, { duration: 48, unit: 'HOURS' }, { duration: 0, unit: 'UNLIMITED' }]
  },
  B1: {
    id: 'B1', categoryId: 'B', name: 'Yöneltme Olmayan Hakaret (1. Derece)', type: 'MUTE',
    steps: [{ duration: 15, unit: 'MINUTES' }, { duration: 30, unit: 'MINUTES' }, { duration: 1, unit: 'HOURS' }, { duration: 2, unit: 'HOURS' }, { duration: 4, unit: 'HOURS' }, { duration: 8, unit: 'HOURS' }, { duration: 16, unit: 'HOURS' }, { duration: 32, unit: 'HOURS' }, { duration: 0, unit: 'UNLIMITED' }]
  },
  C1: {
    id: 'C1', categoryId: 'C', name: 'Kanalın Amacı Dışında Kullanımı (1. Derece)', type: 'MUTE',
    steps: [{ duration: 15, unit: 'MINUTES' }, { duration: 30, unit: 'MINUTES' }, { duration: 1, unit: 'HOURS' }, { duration: 2, unit: 'HOURS' }, { duration: 4, unit: 'HOURS' }, { duration: 8, unit: 'HOURS' }, { duration: 16, unit: 'HOURS' }, { duration: 32, unit: 'HOURS' }, { duration: 0, unit: 'UNLIMITED' }]
  },
  DR1: {
    id: 'DR1', categoryId: 'DIRECT_RESTRICTION', name: 'Ticaret Faaliyetleri', type: 'RESTRICTION',
    steps: [{ duration: 0, unit: 'UNLIMITED' }]
  },
  DB1: {
    id: 'DB1', categoryId: 'DIRECT_BAN', name: 'Discord ToS İhlali', type: 'BAN',
    steps: [{ duration: 0, unit: 'UNLIMITED' }]
  },
  T1: {
    id: 'T1', categoryId: 'TICKET', name: 'Uygunsuz Üslup Kullanımı', type: 'TICKET_RESTRICTION',
    steps: [{ duration: 24, unit: 'HOURS' }]
  }
};
