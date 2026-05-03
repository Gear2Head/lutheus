/**
 * AMAÇ: Geriye dönük uyumlu (backward compatible) Versioned Decision Schema tanımları.
 * MANTIK: Kararların versiyonlanarak saklanması, format değişimlerinde sistemin bozulmasına karşı koruma sağlar.
 */
import { z } from 'zod';
import { EvidenceError } from './Errors';

// V1 Schema
export const TargetMetadataSchema_v1 = z.object({
    userId: z.string().uuid().or(z.string().regex(/^\d+$/)), // UUID veya Discord Karakter ID
    guildId: z.string().regex(/^\d+$/).optional(),
    avatarUrl: z.string().url().optional()
});

export const EvidenceSchema_v1 = z.object({
    rawContent: z.string().min(1),
    timestamp: z.number().int(),
    contextContext: z.string().optional()
});

export const DecisionSchema_v1 = z.object({
    version: z.literal('1.0'),
    decisionId: z.string().uuid(),
    target: TargetMetadataSchema_v1,
    evidenceIds: z.array(z.string().uuid()),
    isViolation: z.boolean(),
    confidenceScore: z.number().min(0).max(1),
    violationType: z.string().optional(),
    explanation: z.string(),   // Neden bu karar verildi?
    createdAt: z.number().int()
});

export type EvidenceV1 = z.infer<typeof EvidenceSchema_v1>;
export type DecisionV1 = z.infer<typeof DecisionSchema_v1>;

// Domain Invariant Enforcer
export class DecisionFactory {
    public static createDecision(payload: unknown): DecisionV1 {
        // Invariant: No decision without evidence
        const parsed = DecisionSchema_v1.safeParse(payload);
        if (!parsed.success) {
            throw new EvidenceError('Invalid Decision Schema structure', { issues: parsed.error.issues });
        }

        const decision = parsed.data;
        if (decision.evidenceIds.length === 0) {
            throw new EvidenceError('Domain Invariant Violation: No decision can be made without evidence.', { decisionId: decision.decisionId });
        }

        return decision;
    }
}
