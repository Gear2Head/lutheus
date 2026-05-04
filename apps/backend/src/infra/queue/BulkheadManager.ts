/**
 * AMAÇ: Kuyruktan alınan işlerin (Worker) sistemi aşırı yüklemesini engellemek için Bulkhead (Bölme) İzolasyonu.
 * MANTIK: Aynı anda işlenebilecek maksimum concurrent (eşzamanlı) görev sayısını sınırlandırır. Sistem Memory/CPU stabilitesini korur.
 */

export interface BulkheadOptions {
    maxConcurrency: number;     // Aynı anda çalışabilen görev sayısı
    maxQueueSize: number;       // Kuyrukta bekleyebilecek görev sayısı
}

export class BulkheadManager {
    private activeWorkers = 0;
    private queue: Array<() => void> = [];

    constructor(
        private readonly options: BulkheadOptions = { maxConcurrency: 10, maxQueueSize: 50 },
        private readonly logger: { error(message: string): void } = console
    ) { }

    public async execute<T>(taskName: string, operation: () => Promise<T>): Promise<T> {
        if (this.activeWorkers >= this.options.maxConcurrency) {
            if (this.queue.length >= this.options.maxQueueSize) {
                this.logger.error(`[Bulkhead] ${taskName} rejected. Max capacity reached!`);
                throw new Error(`BULKHEAD_REJECTED: ${taskName} exceeds capacity constraints.`);
            }

            // Kapasite doldu ama kuyrukta yer var, kuyruğa al
            return new Promise<T>((resolve, reject) => {
                this.queue.push(async () => {
                    try {
                        resolve(await this.runOperation(operation));
                    } catch (err) {
                        reject(err);
                    }
                });
            });
        }

        // Kapasite var, doğrudan çalıştır
        return this.runOperation(operation);
    }

    private async runOperation<T>(operation: () => Promise<T>): Promise<T> {
        this.activeWorkers++;
        try {
            return await operation();
        } finally {
            this.activeWorkers--;
            this.processNextInQueue();
        }
    }

    private processNextInQueue(): void {
        if (this.queue.length > 0 && this.activeWorkers < this.options.maxConcurrency) {
            const nextTask = this.queue.shift();
            if (nextTask) nextTask();
        }
    }

    public getMetrics() {
        return {
            activeWorkers: this.activeWorkers,
            queuedTasks: this.queue.length,
            concurrencyLimit: this.options.maxConcurrency
        };
    }
}
