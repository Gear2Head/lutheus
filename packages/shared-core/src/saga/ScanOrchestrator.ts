import { randomUUID } from 'crypto';

export type ScanState =
    | 'INIT'
    | 'QUEUED'
    | 'COLLECTING'
    | 'ANALYZING'
    | 'COMPLETED'
    | 'FAILED'
    | 'ROLLED_BACK';

export interface ScanContext {
    jobId: string;
    idempotencyKey: string;
    targetId: string;
    initiatorId: string;
    state: ScanState;
    evidencePayload?: unknown;
    analysisResult?: unknown;
    errorReason?: string;
    rolledBackSteps?: string[];
    stateHistory?: Array<{ state: ScanState; at: string }>;
}

export class ScanOrchestrator {
    constructor(
        private readonly dbStorage: {
            findByIdempotencyKey(key: string): Promise<ScanContext | null>;
            createRecord(ctx: ScanContext): Promise<void>;
            updateState(jobId: string, state: ScanState, meta?: Record<string, unknown>): Promise<void>;
        },
        private readonly redisQueue: {
            push(queue: string, payload: Record<string, unknown>): Promise<void>;
            removeRelatedTasks(jobId: string): Promise<void>;
        },
        private readonly telemetry: {
            record(event: string, meta?: Record<string, unknown>): void;
        }
    ) {}

    public async executeScanSaga(
        context: Omit<ScanContext, 'jobId' | 'state' | 'stateHistory' | 'rolledBackSteps'>
    ): Promise<string> {
        const jobId = randomUUID();
        let current: ScanContext = {
            ...context,
            jobId,
            state: 'INIT',
            stateHistory: [{ state: 'INIT', at: new Date().toISOString() }],
            rolledBackSteps: []
        };

        try {
            const existing = await this.dbStorage.findByIdempotencyKey(context.idempotencyKey);
            if (existing) {
                this.telemetry.record('scan_idempotency_hit', { jobId: existing.jobId });
                return existing.jobId;
            }

            await this.dbStorage.createRecord(current);

            current = await this.transition(current, 'QUEUED');
            await this.redisQueue.push('scan_evidence_tasks', {
                jobId,
                targetId: context.targetId
            });

            this.telemetry.record('saga_queued', { jobId });
            return jobId;
        } catch (error: unknown) {
            const reason = error instanceof Error ? error.message : String(error);
            this.telemetry.record('saga_failed', { jobId, error: reason });
            await this.compensate(current, reason);
            throw new Error(`SCAN_SAGA_FAILED: ${reason}`);
        }
    }

    public async onWorkerStarted(jobId: string): Promise<void> {
        await this.dbStorage.updateState(jobId, 'COLLECTING', {
            workerStartedAt: new Date().toISOString()
        });
        this.telemetry.record('worker_collecting', { jobId });
    }

    public async onWorkerAnalyzing(jobId: string): Promise<void> {
        await this.dbStorage.updateState(jobId, 'ANALYZING', {
            analyzingStartedAt: new Date().toISOString()
        });
        this.telemetry.record('worker_analyzing', { jobId });
    }

    public async onWorkerCompleted(jobId: string, result?: unknown): Promise<void> {
        await this.dbStorage.updateState(jobId, 'COMPLETED', {
            completedAt: new Date().toISOString(),
            result
        });
        this.telemetry.record('saga_completed', { jobId });
    }

    public async onWorkerFailed(jobId: string, reason: string): Promise<void> {
        await this.dbStorage.updateState(jobId, 'FAILED', {
            failedAt: new Date().toISOString(),
            errorReason: reason
        });
        this.telemetry.record('saga_worker_failed', { jobId, reason });
    }

    private async transition(context: ScanContext, state: ScanState): Promise<ScanContext> {
        const updated: ScanContext = {
            ...context,
            state,
            stateHistory: [
                ...(context.stateHistory ?? []),
                { state, at: new Date().toISOString() }
            ]
        };
        await this.dbStorage.updateState(context.jobId, state);
        return updated;
    }

    private async compensate(context: ScanContext, reason: string): Promise<void> {
        const rolledBackSteps: string[] = [];

        if (context.state === 'ANALYZING' || context.state === 'COLLECTING' || context.state === 'QUEUED') {
            try {
                await this.redisQueue.removeRelatedTasks(context.jobId);
                rolledBackSteps.push('queue_task_removed');
            } catch {
                this.telemetry.record('compensate_queue_error', { jobId: context.jobId });
            }
        }

        await this.dbStorage.updateState(context.jobId, 'ROLLED_BACK', {
            errorReason: reason,
            rolledBackSteps,
            rolledBackAt: new Date().toISOString()
        });

        this.telemetry.record('saga_compensated', {
            jobId: context.jobId,
            rolledBackSteps
        });
    }
}
