export function buildLutheusCaseUrl(caseId: string | null | undefined): string {
  const cid = String(caseId || '').trim();
  if (!cid) return 'https://lutheus.vercel.app/dashboard/#/cases';
  return `https://lutheus.vercel.app/dashboard/#/cases?case=${encodeURIComponent(cid)}`;
}
