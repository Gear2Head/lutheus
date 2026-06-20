// Lutheus — Hadron Bot URL Yardımcı Fonksiyonları
// Sunucu ID: 1223431616081166336

/**
 * Verilen ticket_id değerini temizleyip Hadron transkript URL'sine dönüştürür.
 * @example getHadronTranscriptUrl("83")  // → "https://dash.hadron.bot/manage/.../transcripts/view/83"
 * @example getHadronTranscriptUrl("ticket-0024")  // → "https://dash.hadron.bot/manage/.../transcripts/view/24"
 */
export const getHadronTranscriptUrl = (ticketId: string): string => {
  const cleanId = String(ticketId).replace(/[^0-9]/g, '').trim();
  return `https://dash.hadron.bot/manage/1223431616081166336/transcripts/view/${cleanId}`;
};

/**
 * Ticket ID'sini sayısal string'e normalize eder (öncü sıfır olmadan).
 */
export const normalizeTicketId = (ticketId: string): string => {
  return String(ticketId).replace(/[^0-9]/g, '').trim();
};
