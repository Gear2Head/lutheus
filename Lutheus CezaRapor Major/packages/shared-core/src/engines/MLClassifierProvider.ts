/**
 * AMAÇ: Dışarıdan enjekte edilebilir, pluggable Makine Öğrenmesi Model Arayüzü.
 * MANTIK: İlgili AI modelini (HuggingFace, OpenAI, Custom gRPC vs.) soyutlayarak core domainden ayırır.
 */
import { EvidenceV1 } from '../domain/DecisionSchema';

export interface MLInferenceResult {
    predictedClass: string;
    rawProbability: number; // 0.0 - 1.0 arası kalibre edilmemiş skor
    featuresExtracted: string[];
}

export interface IMLClassifierProvider {
    readonly providerName: string;
    readonly modelVersion: string;

    predict(evidence: EvidenceV1[]): Promise<MLInferenceResult>;
    isHealthy(): Promise<boolean>;
}

// Örnek bir Dummy Provider Implementasyonu (Test/Fallback için)
export class FallbackMLProvider implements IMLClassifierProvider {
    public readonly providerName = 'FallbackKeywordHeuristics';
    public readonly modelVersion = '1.0.0-fallback';

    async predict(evidence: EvidenceV1[]): Promise<MLInferenceResult> {
        // Gerçekte bir HTTP veya gRPC inferans servisine istek atılır.
        return {
            predictedClass: 'UNKNOWN',
            rawProbability: 0.5,
            featuresExtracted: []
        };
    }

    async isHealthy(): Promise<boolean> {
        return true;
    }
}
