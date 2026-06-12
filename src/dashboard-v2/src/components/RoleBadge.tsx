import React from 'react';
import { Shield } from 'lucide-react';

interface RoleBadgeProps {
  role?: string;
  staffName?: string;
  customClass?: string;
}

export function getRoleDetails(roleName: string, name: string = '') {
  const roleLower = (roleName || '').trim().toLowerCase();

  // Role icon URLs
  const ROLE_ICONS: Record<string, string> = {
    yönetici: 'https://cdn.discordapp.com/role-icons/1445466436809134353/9baa5fe7dbe9be15b4c6b7f522e42156.webp?size=20&quality=lossless',
    admin: 'https://cdn.discordapp.com/role-icons/1445466436809134353/9baa5fe7dbe9be15b4c6b7f522e42156.webp?size=20&quality=lossless',
    manager: 'https://cdn.discordapp.com/role-icons/1445466436809134353/9baa5fe7dbe9be15b4c6b7f522e42156.webp?size=20&quality=lossless',
    discord_yöneticisi: 'https://cdn.discordapp.com/role-icons/1445466911554015293/907dcfe9f1d72cd7f3ab1798197be6e9.webp?size=20&quality=lossless',
    discord_yoneticisi: 'https://cdn.discordapp.com/role-icons/1445466911554015293/907dcfe9f1d72cd7f3ab1798197be6e9.webp?size=20&quality=lossless',
    discord_destek_ekibi: 'https://cdn.discordapp.com/role-icons/1445468216137875652/8b67a8b57fafca0d4ebae952201592b0.webp?size=20&quality=lossless',
    destek: 'https://cdn.discordapp.com/role-icons/1445468216137875652/8b67a8b57fafca0d4ebae952201592b0.webp?size=20&quality=lossless',
    support: 'https://cdn.discordapp.com/role-icons/1445468216137875652/8b67a8b57fafca0d4ebae952201592b0.webp?size=20&quality=lossless',
    genel_sorumlu: 'https://cdn.discordapp.com/role-icons/1445466798689620048/d08b0c0dbf79e7692f7e65491f920a20.webp?size=20&quality=lossless',
    supervisor: 'https://cdn.discordapp.com/role-icons/1445466798689620048/d08b0c0dbf79e7692f7e65491f920a20.webp?size=20&quality=lossless',
    kidemli: 'https://cdn.discordapp.com/role-icons/1445467904295305260/595d3f996e3b3d4da0baa45603eb0e57.webp?size=20&quality=lossless',
    senior: 'https://cdn.discordapp.com/role-icons/1445466979195555893/b40595c8689fb3f0b6437c9b348b2e6c.webp?size=20&quality=lossless',
    senior_moderator: 'https://cdn.discordapp.com/role-icons/1445466979195555893/b40595c8689fb3f0b6437c9b348b2e6c.webp?size=20&quality=lossless',
    kidemli_discord_moderatoru: 'https://cdn.discordapp.com/role-icons/1445467904295305260/595d3f996e3b3d4da0baa45603eb0e57.webp?size=20&quality=lossless',
    discord_moderatoru: 'https://cdn.discordapp.com/role-icons/1445466979195555893/b40595c8689fb3f0b6437c9b348b2e6c.webp?size=20&quality=lossless',
    moderator: 'https://cdn.discordapp.com/role-icons/1445466979195555893/b40595c8689fb3f0b6437c9b348b2e6c.webp?size=20&quality=lossless',
  };

  // Handle exact lowercase database role IDs first to bypass casing issues
  if (roleLower === 'kurucu' || roleLower === 'founder') {
    return {
      label: 'Kurucu',
      colorClass: 'text-[#FF453A]',
      bgClass: 'bg-[#FF453A]/10 border-[#FF453A]/20',
      badgeColor: '#FF453A',
      iconUrl: null
    };
  }
  if (roleLower === 'discord_yoneticisi' || roleLower === 'discord_yöneticisi') {
    return {
      label: 'Discord Yöneticisi',
      colorClass: 'text-[#BF5AF2]',
      bgClass: 'bg-[#BF5AF2]/10 border-[#BF5AF2]/20',
      badgeColor: '#BF5AF2',
      iconUrl: ROLE_ICONS.discord_yöneticisi
    };
  }
  if (roleLower === 'yonetici' || roleLower === 'yönetici' || roleLower === 'admin' || roleLower === 'manager') {
    return {
      label: 'Yönetici',
      colorClass: 'text-[#FF453A]',
      bgClass: 'bg-[#FF453A]/10 border-[#FF453A]/20',
      badgeColor: '#FF453A',
      iconUrl: ROLE_ICONS.yönetici
    };
  }
  if (roleLower === 'genel_sorumlu' || roleLower === 'supervisor') {
    return {
      label: 'Genel Sorumlu',
      colorClass: 'text-[#34C759]',
      bgClass: 'bg-[#34C759]/10 border-[#34C759]/20',
      badgeColor: '#34C759',
      iconUrl: ROLE_ICONS.genel_sorumlu
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
      badgeColor: '#FF9F0A',
      iconUrl: ROLE_ICONS.kidemli
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
      badgeColor: '#5E5CE6',
      iconUrl: ROLE_ICONS.discord_moderatoru
    };
  }
  if (roleLower === 'deneme_destek_ekibi' || roleLower === 'deneme' || roleLower === 'trainee' || roleLower === 'apprentice') {
    return {
      label: 'Deneme Destek Ekibi',
      colorClass: 'text-[#8E8E93]',
      bgClass: 'bg-[#8E8E93]/10 border-[#8E8E93]/20',
      badgeColor: '#8E8E93',
      iconUrl: null
    };
  }
  if (roleLower === 'eski_yetkili' || roleLower === 'eski' || roleLower === 'old') {
    return {
      label: 'Eski Yetkili',
      colorClass: 'text-white/40',
      bgClass: 'bg-white/5 border-white/10',
      badgeColor: '#8E8E93',
      iconUrl: null
    };
  }
  if (roleLower === 'discord_destek_ekibi' || roleLower === 'support' || roleLower === 'destek') {
    return {
      label: 'Discord Destek Ekibi',
      colorClass: 'text-[#FF2D55]',
      bgClass: 'bg-[#FF2D55]/10 border-[#FF2D55]/20',
      badgeColor: '#FF2D55',
      iconUrl: ROLE_ICONS.discord_destek_ekibi
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
      badgeColor: '#FF453A',
      iconUrl: null
    };
  }

  if (norm.includes('YÖNETİCİSİ') || norm === 'YÖNETİCİ' || norm.includes('ADMIN') || norm.includes('MANAGER')) {
    if (norm.includes('DISCORD YÖNETİCİ') || norm.includes('DISCORD_YÖNETİCİ')) {
      return {
        label: 'Discord Yöneticisi',
        colorClass: 'text-[#BF5AF2]',
        bgClass: 'bg-[#BF5AF2]/10 border-[#BF5AF2]/20',
        badgeColor: '#BF5AF2',
        iconUrl: ROLE_ICONS.discord_yöneticisi
      };
    }
    return {
      label: 'Yönetici',
      colorClass: 'text-[#FF453A]',
      bgClass: 'bg-[#FF453A]/10 border-[#FF453A]/20',
      badgeColor: '#FF453A',
      iconUrl: ROLE_ICONS.yönetici
    };
  }

  if (norm.includes('GENEL') || norm.includes('SORUMLU') || norm.includes('SUPERVISOR')) {
    return {
      label: 'Genel Sorumlu',
      colorClass: 'text-[#34C759]',
      bgClass: 'bg-[#34C759]/10 border-[#34C759]/20',
      badgeColor: '#34C759',
      iconUrl: ROLE_ICONS.genel_sorumlu
    };
  }

  if (norm.includes('KIDEMLİ') || norm.includes('SENIOR') || norm === 'SR. MODERATOR') {
    return {
      label: 'Kıdemli Moderatör',
      colorClass: 'text-[#FF9F0A]',
      bgClass: 'bg-[#FF9F0A]/10 border-[#FF9F0A]/20',
      badgeColor: '#FF9F0A',
      iconUrl: ROLE_ICONS.kidemli
    };
  }

  if (norm.includes('MODERATÖR') || norm.includes('MODERATOR')) {
    return {
      label: 'Discord Moderatör',
      colorClass: 'text-[#5E5CE6]',
      bgClass: 'bg-[#5E5CE6]/10 border-[#5E5CE6]/20',
      badgeColor: '#5E5CE6',
      iconUrl: ROLE_ICONS.discord_moderatoru
    };
  }

  if (norm.includes('DENEME') || norm.includes('TRAINEE') || norm.includes('APPRENTICE')) {
    return {
      label: 'Deneme Destek Ekibi',
      colorClass: 'text-[#8E8E93]',
      bgClass: 'bg-[#8E8E93]/10 border-[#8E8E93]/20',
      badgeColor: '#8E8E93',
      iconUrl: null
    };
  }

  if (norm.includes('ESKİ') || norm.includes('OLD')) {
    return {
      label: 'Eski Yetkili',
      colorClass: 'text-white/40',
      bgClass: 'bg-white/5 border-white/10',
      badgeColor: '#8E8E93',
      iconUrl: null
    };
  }

  // Default Fallback: Destek Ekibi
  return {
    label: 'Discord Destek Ekibi',
    colorClass: 'text-[#FF2D55]',
    bgClass: 'bg-[#FF2D55]/10 border-[#FF2D55]/20',
    badgeColor: '#FF2D55',
    iconUrl: ROLE_ICONS.discord_destek_ekibi
  };
}

export default function RoleBadge({ role, staffName, customClass = '' }: RoleBadgeProps) {
  const details = getRoleDetails(role || '', staffName || '');

  return (
    <span 
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${details.bgClass} ${details.colorClass} ${customClass}`}
    >
      {details.iconUrl ? (
        <img 
          src={details.iconUrl} 
          alt="" 
          className="w-4 h-4 rounded-sm"
          style={{ filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.3))' }}
        />
      ) : (
        <Shield size={10} style={{ color: details.badgeColor }} />
      )}
      <span>{details.label}</span>
    </span>
  );
}
