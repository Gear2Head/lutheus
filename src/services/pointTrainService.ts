// SECTION: STATE_STORE
// PURPOSE: Computes and aggregates moderator point train statistics from Supabase cases.

import { FirebaseRepository } from '../lib/firebaseRepository.js';
import { RULES } from '../config/punishments';

export interface PointTrainResult {
  moderatorId: string;
  totalCases: number;
  totalPT: number;
  topRule: string;
}

type PointTrainCase = {
  createdAt?: string;
  created?: { createdAt?: string };
  authorName?: string;
  author?: { displayName?: string };
  reason?: { category?: string };
  reasonCategory?: string;
};

function getPTValueForRule(ruleId: string): number {
  const rule = RULES[ruleId];
  if (!rule) return 1; // Default fallback

  if (rule.categoryId === 'DIRECT_BAN') return 5;
  if (rule.categoryId === 'DIRECT_RESTRICTION') return 3;
  if (rule.categoryId === 'TICKET') return 2;
  
  return 1;
}

export async function fetchPointTrainData(startDate: Date, endDate: Date, moderatorId?: string): Promise<PointTrainResult[]> {
  try {
    const rawCases = await FirebaseRepository.listCases() as PointTrainCase[];
    if (!rawCases || !Array.isArray(rawCases)) return [];

    const cases = rawCases.filter(c => {
      const createdStr = c.createdAt || c.created?.createdAt;
      if (!createdStr) return false;
      const t = new Date(createdStr);
      if (isNaN(t.getTime())) return false;

      const dateOk = t >= startDate && t <= endDate;
      if (!dateOk) return false;

      const mod = c.authorName || c.author?.displayName || 'Unknown';
      if (moderatorId && moderatorId !== 'all') {
        return mod === moderatorId;
      }
      return true;
    });

    // Aggregate Data
    const aggregator: Record<string, { totalCases: number; totalPT: number; ruleCounts: Record<string, number> }> = {};

    cases.forEach(c => {
      const mod = c.authorName || c.author?.displayName || 'Unknown';
      const ruleId = c.reason?.category || c.reasonCategory || 'unknown';

      if (!aggregator[mod]) {
        aggregator[mod] = { totalCases: 0, totalPT: 0, ruleCounts: {} };
      }
      
      aggregator[mod].totalCases += 1;
      aggregator[mod].totalPT += getPTValueForRule(ruleId);
      
      if (!aggregator[mod].ruleCounts[ruleId]) {
        aggregator[mod].ruleCounts[ruleId] = 0;
      }
      aggregator[mod].ruleCounts[ruleId] += 1;
    });

    const results: PointTrainResult[] = Object.keys(aggregator).map(modId => {
      const data = aggregator[modId];
      // Find top rule
      let topRule = '';
      let maxCount = 0;
      Object.keys(data.ruleCounts).forEach(rId => {
        if (data.ruleCounts[rId] > maxCount) {
          maxCount = data.ruleCounts[rId];
          topRule = rId;
        }
      });

      return {
        moderatorId: modId,
        totalCases: data.totalCases,
        totalPT: data.totalPT,
        topRule: topRule ? `${topRule} - ${RULES[topRule]?.name || 'Bilinmeyen İhlal'}` : 'Yok'
      };
    });

    // Sort by PT descending
    return results.sort((a, b) => b.totalPT - a.totalPT);
  } catch (error) {
    console.error('Error fetching PT data:', error);
    return [];
  }
}
