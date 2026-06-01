// Keep in sync with packages/shared-core/src/engines/ruleMatching.ts

export function normalizeMatchText(value) {
    return String(value || '')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/ı/g, 'i')
        .replace(/İ/g, 'i')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ');
}

export function scoreKeywordMatches(haystack, keywords) {
    const normalizedHaystack = normalizeMatchText(haystack);
    if (!normalizedHaystack || !keywords?.length) return 0;

    let score = 0;
    for (const keyword of keywords) {
        const normalizedKeyword = normalizeMatchText(keyword);
        if (!normalizedKeyword) continue;
        if (normalizedKeyword === 'din' && (normalizedHaystack.includes('dinamik') || normalizedHaystack.includes('dinamig') || normalizedHaystack.includes('dinamiğ'))) {
            continue;
        }
        if (normalizedHaystack.includes(normalizedKeyword)) {
            score += normalizedKeyword.length;
        }
    }
    return score;
}

export function pickBestScoredCategory(scores) {
    const entries = Object.entries(scores).filter(([, score]) => score > 0);
    if (!entries.length) return null;
    entries.sort((left, right) => right[1] - left[1]);
    return entries[0][0];
}

export function matchesKeyword(haystack, keyword) {
    const normalizedHaystack = normalizeMatchText(haystack);
    const normalizedKeyword = normalizeMatchText(keyword);
    if (normalizedKeyword === 'din' && (normalizedHaystack.includes('dinamik') || normalizedHaystack.includes('dinamig') || normalizedHaystack.includes('dinamiğ'))) {
        return false;
    }
    return Boolean(normalizedKeyword && normalizedHaystack.includes(normalizedKeyword));
}
