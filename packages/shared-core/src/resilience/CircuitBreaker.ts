/**
 * AMAÇ: Üçüncü parti servislere (Discord API, ML API) giden isteklerdeki hataların sistemi kilitlemesini önlemek.
 * MANTIK: Belirli hata eşiğinden sonra devreyi açar (Fast Fail) ve süresi dolunca yarı-açık konuma geçer.
 */
export type BreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
    failureThreshold: number;
    resetTimeoutMs: number;
}

export class CircuitBreaker {
    private state: BreakerState = 'CLOSED';
    private failures = 0;
    private nextAttempt = 0;

    constructor(
        private readonly operationName: string,
        private readonly options: CircuitBreakerOptions = { failureThreshold: 5, resetTimeoutMs: 30000 },
        private readonly logger: {
            warn(message: string): void;
            info(message: string): void;
            error(message: string): void;
        } = console
    ) { }

    public async execute<T>(action: () => Promise<T>): Promise<T> {
        if (this.state === 'OPEN') {
            if (Date.now() > this.nextAttempt) {
                this.state = 'HALF_OPEN';
                this.logger.warn(`CircuitBreaker [${this.operationName}] entering HALF_OPEN state`);
            } else {
                throw new Error(`CIRCUIT_BREAKER_OPEN: [${this.operationName}] is currently failing fast.`);
            }
        }

        try {
            const result = await action();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            throw error;
        }
    }

    private onSuccess(): void {
        this.failures = 0;
        if (this.state === 'HALF_OPEN') {
            this.state = 'CLOSED';
            this.logger.info(`CircuitBreaker [${this.operationName}] reset to CLOSED`);
        }
    }

    private onFailure(): void {
        this.failures++;
        if (this.failures >= this.options.failureThreshold) {
            this.state = 'OPEN';
            this.nextAttempt = Date.now() + this.options.resetTimeoutMs;
            this.logger.error(`CircuitBreaker [${this.operationName}] tripped to OPEN state! Next retry at ${new Date(this.nextAttempt).toISOString()}`);
        }
    }
}
