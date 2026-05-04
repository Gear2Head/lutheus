import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
// @ts-expect-error - Firebase config is provided by the extension runtime build.
import { db } from '../config/firebase'; // Adjust this import based on the actual firebase setup
import { RULES, RuleCategory } from '../config/punishments';

export interface ModerationCase {
  id: string;
  moderatorId: string;
  userId: string;
  ruleId: string;
  duration: number;
  timestamp: Timestamp;
}

export interface PointTrainResult {
  moderatorId: string;
  totalCases: number;
  totalPT: number;
  topRule: string;
}

// Helper to determine PT value of a rule
function getPTValueForRule(ruleId: string): number {
  const rule = RULES[ruleId];
  if (!rule) return 1; // Default fallback

  if (rule.categoryId === 'DIRECT_BAN') return 5;
  if (rule.categoryId === 'DIRECT_RESTRICTION') return 3;
  if (rule.categoryId === 'TICKET') return 2;
  
  // A, B, C, D categories
  return 1;
}

export async function fetchPointTrainData(startDate: Date, endDate: Date, moderatorId?: string): Promise<PointTrainResult[]> {
  try {
    const casesRef = collection(db, 'cases');
    let q = query(
      casesRef,
      where('timestamp', '>=', Timestamp.fromDate(startDate)),
      where('timestamp', '<=', Timestamp.fromDate(endDate))
    );

    if (moderatorId && moderatorId !== 'all') {
      q = query(q, where('moderatorId', '==', moderatorId));
    }

    const snapshot = await getDocs(q);
    const cases: ModerationCase[] = [];
    
    snapshot.forEach(doc => {
      cases.push({ id: doc.id, ...doc.data() } as ModerationCase);
    });

    // Aggregate Data
    const aggregator: Record<string, { totalCases: number; totalPT: number; ruleCounts: Record<string, number> }> = {};

    cases.forEach(c => {
      if (!aggregator[c.moderatorId]) {
        aggregator[c.moderatorId] = { totalCases: 0, totalPT: 0, ruleCounts: {} };
      }
      
      aggregator[c.moderatorId].totalCases += 1;
      aggregator[c.moderatorId].totalPT += getPTValueForRule(c.ruleId);
      
      if (!aggregator[c.moderatorId].ruleCounts[c.ruleId]) {
        aggregator[c.moderatorId].ruleCounts[c.ruleId] = 0;
      }
      aggregator[c.moderatorId].ruleCounts[c.ruleId] += 1;
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
