/**
 * AMAÇ: Sistem genelinde kullanılacak Formal Hata Taksonomisi (Error Taxonomy)
 * MANTIK: Hataların tip güvenli ve standart bir yapıda fırlatılmasını sağlar. 
 * UYARI: Generic Error fırlatmak yerine daima bu domain bazlı error sınıfları kullanılmalıdır.
 */

export class BaseDomainError extends Error {
    public readonly code: string;
    public readonly details?: Record<string, unknown>;

    constructor(message: string, code: string, details?: Record<string, unknown>) {
        super(message);
        this.name = this.constructor.name;
        this.code = code;
        this.details = details;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

export class DecisionError extends BaseDomainError {
    constructor(message: string, details?: Record<string, unknown>) {
        super(message, 'DECISION_ERROR', details);
    }
}

export class EvidenceError extends BaseDomainError {
    constructor(message: string, details?: Record<string, unknown>) {
        super(message, 'EVIDENCE_ERROR', details);
    }
}

export class IntegrityError extends BaseDomainError {
    constructor(message: string, details?: Record<string, unknown>) {
        super(message, 'INTEGRITY_ERROR', details);
    }
}

export class CalibrationError extends BaseDomainError {
    constructor(message: string, details?: Record<string, unknown>) {
        super(message, 'CALIBRATION_ERROR', details);
    }
}
