/**
 * AMAÇ: OpenTelemetry veya benzeri yapılandırmalar için Yapılandırılmış (Structured/JSON) loglama servisi.
 * MANTIK: Tüm loglara correlationId eklenir, objeler stringification hatalarına karşı korunur (Circular Dependency Guard).
 */
import { Injectable, LoggerService } from '@nestjs/common';
import { randomUUID } from 'crypto';

export interface StructuredLogContext {
    correlationId: string;
    userId?: string;
    scanId?: string;
    [key: string]: unknown;
}

@Injectable()
export class StructuredLogger implements LoggerService {
    private readonly serviceContext = 'LutheusBackend';

    public log(message: string, context?: StructuredLogContext | string) {
        this.writeLog('INFO', message, context);
    }

    public error(message: string, context?: StructuredLogContext | string, trace?: string) {
        this.writeLog('ERROR', message, context, trace);
    }

    public warn(message: string, context?: StructuredLogContext | string) {
        this.writeLog('WARN', message, context);
    }

    public debug(message: string, context?: StructuredLogContext | string) {
        this.writeLog('DEBUG', message, context);
    }

    private writeLog(level: string, message: string, contextInfo?: StructuredLogContext | string, trace?: string) {
        const timestamp = new Date().toISOString();
        let formattedContext = typeof contextInfo === 'string' ? { module: contextInfo } : (contextInfo || {});

        // Eğer bir Correlation ID yoksa izlenebilirlik için otomatik üret.
        if (!formattedContext.correlationId) {
            formattedContext.correlationId = randomUUID();
        }

        const logEntry = {
            timestamp,
            level,
            service: this.serviceContext,
            message,
            trace,
            ...formattedContext
        };

        // OpenTelemetry / Datadog / ELK stack JSON parse edebilsin diye console'a JSON basilır
        // Circular referencedatasına karşı basit koruma (Gelişmiş objeler için custom replacer kullanılır)
        try {
            const output = JSON.stringify(logEntry);
            if (level === 'ERROR') process.stderr.write(output + '\n');
            else process.stdout.write(output + '\n');
        } catch (e) {
            // JSON serialize edilemiyorsa düz string bas
            process.stderr.write(`[${level}] ${timestamp} Serialization Error in log payload: ${message}\n`);
        }
    }
}
