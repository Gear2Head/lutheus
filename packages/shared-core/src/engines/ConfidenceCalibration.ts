/**
 * AMAÇ: Raw ML skorlarını veya Kural skorlarını gerçek güven oranlarına dönüştürmek.
 * MANTIK: Platt Scaling (Sigmoid) veya benzeri bir kalibrasyon fonksiyonu kullanarak skoru kalibre eder.
 * UYARI: Kararlar sisteminde doğrudan raw ML olasılıkları yerine, kalibre edilmiş güven (confidence) değerleri kullanılır.
 */
import { CalibrationError } from '../domain/Errors';

export interface CalibrationResult {
    originalScore: number;
    calibratedConfidence: number;
    scalingApplied: string; // 'Platt', 'Isotonic', 'Linear', etc.
}

export class ConfidenceCalibrationEngine {
    // Platt Scaling Parametreleri (A ve B değerleri genelde model eğitiminde hesaplanır)
    // P(y=1|f) = 1 / (1 + exp(A * f + B))
    private readonly plattA: number;
    private readonly plattB: number;

    constructor(plattA: number = -1.5, plattB: number = 0.5) {
        this.plattA = plattA;
        this.plattB = plattB;
    }

    public calibrate(rawProbability: number): CalibrationResult {
        if (rawProbability < 0 || rawProbability > 1) {
            throw new CalibrationError(`Invalid raw probability: ${rawProbability}. Must be between 0 and 1.`);
        }

        // Apply Platt Scaling (Sigmoid function mapping)
        const calibrated = 1.0 / (1.0 + Math.exp(this.plattA * rawProbability + this.plattB));

        // Normalizasyon (Güvenlik sınırlarını aşmaması için)
        const normalized = Math.max(0.01, Math.min(0.99, calibrated));

        return {
            originalScore: rawProbability,
            calibratedConfidence: Number(normalized.toFixed(4)),
            scalingApplied: 'Platt_Sigmoid'
        };
    }

    // ML Modeli (Drift/Değişim) sonucu skorlarında farklılık varsa A ve B güncellenmelidir.
}
