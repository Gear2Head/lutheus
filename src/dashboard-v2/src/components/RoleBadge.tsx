import React from 'react';
import { Shield } from 'lucide-react';

interface RoleBadgeProps {
  role?: string;
  staffName?: string;
  customClass?: string;
}

export function getRoleDetails(roleName: string, name: string = '') {
  const roleLower = (roleName || '').trim().toLowerCase();

  // Handle exact lowercase database role IDs first to bypass casing issues
  if (roleLower === 'kurucu' || roleLower === 'founder') {
    return {
      label: 'Kurucu',
      colorClass: 'text-[#FF453A]',
      bgClass: 'bg-[#FF453A]/10 border-[#FF453A]/20',
      badgeColor: '#FF453A'
    };
  }
  if (roleLower === 'discord_yoneticisi' || roleLower === 'discord_yöneticisi') {
    return {
      label: 'Discord Yöneticisi',
      colorClass: 'text-[#BF5AF2]',
      bgClass: 'bg-[#BF5AF2]/10 border-[#BF5AF2]/20',
      badgeColor: '#BF5AF2'
    };
  }
  if (roleLower === 'yonetici' || roleLower === 'yönetici' || roleLower === 'admin' || roleLower === 'manager') {
    return {
      label: 'Yönetici',
      colorClass: 'text-[#FF453A]',
      bgClass: 'bg-[#FF453A]/10 border-[#FF453A]/20',
      badgeColor: '#FF453A'
    };
  }
  if (roleLower === 'genel_sorumlu' || roleLower === 'supervisor') {
    return {
      label: 'Genel Sorumlu',
      colorClass: 'text-[#34C759]',
      bgClass: 'bg-[#34C759]/10 border-[#34C759]/20',
      badgeColor: '#34C759'
    };
  }
  if (
    roleLower === 'kidemli_discord_moderatoru' ||
    roleLower === 'kidemli_discord_moderatörü' ||
    roleLower === 'kidemli' ||
    roleLower === 'senior' ||
    roleLower === 'senior_moderator' ||
    roleLower === 'sr. moderator'
  ) {
    return {
      label: 'Kıdemli Moderatör',
      colorClass: 'text-[#FF9F0A]',
      bgClass: 'bg-[#FF9F0A]/10 border-[#FF9F0A]/20',
      badgeColor: '#FF9F0A'
    };
  }
  if (
    roleLower === 'discord_moderatoru' ||
    roleLower === 'discord_moderatörü' ||
    roleLower === 'moderator' ||
    roleLower === 'discord_moderator'
  ) {
    return {
      label: 'Discord Moderatör',
      colorClass: 'text-[#5E5CE6]',
      bgClass: 'bg-[#5E5CE6]/10 border-[#5E5CE6]/20',
      badgeColor: '#5E5CE6'
    };
  }
  if (roleLower === 'deneme_destek_ekibi' || roleLower === 'deneme' || roleLower === 'trainee' || roleLower === 'apprentice') {
    return {
      label: 'Deneme Destek Ekibi',
      colorClass: 'text-[#8E8E93]',
      bgClass: 'bg-[#8E8E93]/10 border-[#8E8E93]/20',
      badgeColor: '#8E8E93'
    };
  }
  if (roleLower === 'eski_yetkili' || roleLower === 'eski' || roleLower === 'old') {
    return {
      label: 'Eski Yetkili',
      colorClass: 'text-white/40',
      bgClass: 'bg-white/5 border-white/10',
      badgeColor: '#8E8E93'
    };
  }
  if (roleLower === 'discord_destek_ekibi' || roleLower === 'support' || roleLower === 'destek') {
    return {
      label: 'Discord Destek Ekibi',
      colorClass: 'text-[#FF2D55]',
      bgClass: 'bg-[#FF2D55]/10 border-[#FF2D55]/20',
      badgeColor: '#FF2D55'
    };
  }

  let norm = (roleName || '').trim().toUpperCase();
  const nameNorm = (name || '').trim().toUpperCase();

  // If role is empty, let's deduce from nickname prefix
  if (!norm && nameNorm) {
    if (nameNorm.includes('[DENEME]') || nameNorm.includes('DENEME_') || nameNorm.includes('TRAINEE')) {
      norm = 'DENEME DESTEK';
    } else if (nameNorm.includes('KURUCU') || nameNorm.includes('GEAR_HEAD') || nameNorm.includes('GEARHEAD')) {
      norm = 'KURUCU';
    } else if (nameNorm.includes('KIDEMLİ') || nameNorm.includes('SENIOR')) {
      norm = 'KIDEMLİ MODERATÖR';
    } else if (nameNorm.includes('MODERATÖR')) {
      norm = 'DISCORD MODERATÖR';
    } else if (nameNorm.includes('SORUMLU') || nameNorm.includes('GENEL')) {
      norm = 'GENEL SORUMLU';
    } else if (nameNorm.includes('YÖNETİCİ')) {
      norm = 'YÖNETİCİ';
    }
  }

  // Exact matching or substring parsing which mirrors CUK rules
  if (norm === 'KURUCU' || norm === 'FOUNDER') {
    return {
      label: 'Kurucu',
      colorClass: 'text-[#FF453A]',
      bgClass: 'bg-[#FF453A]/10 border-[#FF453A]/20',
      badgeColor: '#FF453A'
    };
  }

  if (norm.includes('YÖNETİCİSİ') || norm === 'YÖNETİCİ' || norm.includes('ADMIN') || norm.includes('MANAGER')) {
    if (norm.includes('DISCORD YÖNETİCİ') || norm.includes('DISCORD_YÖNETİCİ')) {
      return {
        label: 'Discord Yöneticisi',
        colorClass: 'text-[#BF5AF2]',
        bgClass: 'bg-[#BF5AF2]/10 border-[#BF5AF2]/20',
        badgeColor: '#BF5AF2'
      };
    }
    return {
      label: 'Yönetici',
      colorClass: 'text-[#FF453A]',
      bgClass: 'bg-[#FF453A]/10 border-[#FF453A]/20',
      badgeColor: '#FF453A'
    };
  }

  if (norm.includes('GENEL') || norm.includes('SORUMLU') || norm.includes('SUPERVISOR')) {
    return {
      label: 'Genel Sorumlu',
      colorClass: 'text-[#34C759]',
      bgClass: 'bg-[#34C759]/10 border-[#34C759]/20',
      badgeColor: '#34C759'
    };
  }

  if (norm.includes('KIDEMLİ') || norm.includes('SENIOR') || norm === 'SR. MODERATOR') {
    return {
      label: 'Kıdemli Moderatör',
      colorClass: 'text-[#FF9F0A]',
      bgClass: 'bg-[#FF9F0A]/10 border-[#FF9F0A]/20',
      badgeColor: '#FF9F0A'
    };
  }

  if (norm.includes('MODERATÖR') || norm.includes('MODERATOR')) {
    return {
      label: 'Discord Moderatör',
      colorClass: 'text-[#5E5CE6]',
      bgClass: 'bg-[#5E5CE6]/10 border-[#5E5CE6]/20',
      badgeColor: '#5E5CE6'
    };
  }

  if (norm.includes('DENEME') || norm.includes('TRAINEE') || norm.includes('APPRENTICE')) {
    return {
      label: 'Deneme Destek Ekibi',
      colorClass: 'text-[#8E8E93]',
      bgClass: 'bg-[#8E8E93]/10 border-[#8E8E93]/20',
      badgeColor: '#8E8E93'
    };
  }

  if (norm.includes('ESKİ') || norm.includes('OLD')) {
    return {
      label: 'Eski Yetkili',
      colorClass: 'text-white/40',
      bgClass: 'bg-white/5 border-white/10',
      badgeColor: '#8E8E93'
    };
  }

  // Default Fallback: Destek Ekibi
  return {
    label: 'Discord Destek Ekibi',
    colorClass: 'text-[#FF2D55]',
    bgClass: 'bg-[#FF2D55]/10 border-[#FF2D55]/20',
    badgeColor: '#FF2D55'
  };
}

export default function RoleBadge({ role, staffName, customClass = '' }: RoleBadgeProps) {
  const details = getRoleDetails(role || '', staffName || '');

  return (
    <span 
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${details.bgClass} ${details.colorClass} ${customClass}`}
    >
      <Shield size={10} style={{ color: details.badgeColor }} />
      <span>{details.label}</span>
    </span>
  );
}
