/**
 * AMAÇ: Belirli if-else kurallarına dayalı Deterministic (Açıklanabilir) Kurallar Motoru.
 * MANTIK: Girdi verisini bir dizi kural üzerinden geçirir, her kuralın ağırlığını (weight) toplar ve kararı açıklar.
 */
import { EvidenceV1 } from '../domain/DecisionSchema';
import { DecisionError } from '../domain/Errors';

export interface RuleDefinition {
    id: string;
    name: string;
    weight: number;
    evaluate: (evidence: string) => boolean;
    reasonTemplate: string;
}

export interface RuleEvaluationResult {
    matchedRuleIds: string[];
    totalWeight: number;
    explanation: string[];
}

export class DeterministicRuleEngine {
    private readonly rules: RuleDefinition[] = [];

    constructor(rules: RuleDefinition[]) {
        if (!rules || rules.length === 0) {
            throw new DecisionError('RuleEngine initialized without rules.');
        }
        this.rules = rules;
    }

    public analyze(evidenceData: EvidenceV1[]): RuleEvaluationResult {
        let totalWeight = 0;
        const matchedRuleIds = new Set<string>();
        const explanation: string[] = [];

        for (const evidence of evidenceData) {
            const content = evidence.rawContent.toLowerCase();

            for (const rule of this.rules) {
                if (!matchedRuleIds.has(rule.id) && rule.evaluate(content)) {
                    matchedRuleIds.add(rule.id);
                    totalWeight += rule.weight;
                    explanation.push(`Rule matched [${rule.name}]: ${rule.reasonTemplate}`);
                }
            }
        }

        return {
            matchedRuleIds: Array.from(matchedRuleIds),
            totalWeight: Math.min(totalWeight, 1.0), // Max 1.0 (100%)
            explanation
        };
    }
}
