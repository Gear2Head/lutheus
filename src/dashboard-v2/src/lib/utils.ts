import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Resilient Turkish / standard ISO date parser to handle DD.MM.YYYY and YYYY-MM-DD
 */
export function parseDateSafe(dateStr: string): Date {
  if (!dateStr) return new Date();
  
  // Try direct ISO parse first (YYYY-MM-DD)
  if (dateStr.includes('-')) {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d;
  }
  
  // Handle DD.MM.YYYY HH:mm:ss or DD.MM.YYYY formats popular in Turkey/Svelte
  const dotParts = dateStr.split('.');
  if (dotParts.length >= 3) {
    const day = parseInt(dotParts[0], 10);
    const month = parseInt(dotParts[1], 10) - 1; // 0-indexed month
    const yearPart = dotParts[2].trim();
    
    let year = yearPart.split(' ')[0];
    const yearNum = parseInt(year, 10);
    
    // Check if there is time component (e.g. HH:mm:ss)
    const timePart = yearPart.includes(' ') ? yearPart.split(' ')[1] : null;
    let hours = 0, minutes = 0, seconds = 0;
    if (timePart) {
      const timeParts = timePart.split(':');
      hours = parseInt(timeParts[0], 10) || 0;
      minutes = parseInt(timeParts[1], 10) || 0;
      seconds = parseInt(timeParts[2], 10) || 0;
    }
    
    const parsed = new Date(yearNum, month, day, hours, minutes, seconds);
    if (!isNaN(parsed.getTime())) return parsed;
  }

  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? new Date() : d;
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  try {
    const parsed = parseDateSafe(dateStr);
    return parsed.toLocaleDateString('tr-TR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export function formatDateTime(dateStr: string): string {
  if (!dateStr) return '—';
  try {
    const parsed = parseDateSafe(dateStr);
    return parsed.toLocaleString('tr-TR');
  } catch {
    return dateStr;
  }
}

export function relativeTime(dateStr: string): string {
  if (!dateStr) return '—';
  const parsed = parseDateSafe(dateStr);
  const diff = Date.now() - parsed.getTime();
  
  // Safe bounds check
  if (diff < 0) {
    if (Math.abs(diff) < 60000) return 'az önce';
    return formatDate(dateStr);
  }
  
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}sn önce`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}dk önce`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}sa önce`;
  const days = Math.floor(hrs / 24);
  
  if (days > 30) {
    return formatDate(dateStr);
  }
  return `${days}gün önce`;
}

export function minutesToHuman(mins: number): string {
  if (!mins || mins === 0) return 'Kalıcı';
  if (mins < 60) return `${mins} dk`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h < 24) return m > 0 ? `${h}sa ${m}dk` : `${h} saat`;
  const d = Math.floor(h / 24);
  return `${d} gün`;
}
