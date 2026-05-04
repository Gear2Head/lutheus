import {
    Injectable,
    CanActivate,
    ExecutionContext,
    UnauthorizedException,
    Logger,
    OnModuleInit
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';

const MAX_TIMESTAMP_AGE_MS = 60_000;
const MAX_TIMESTAMP_FUTURE_MS = 10_000;
const EXPECTED_SIG_HEX_LEN = 64;

@Injectable()
export class HmacVerifierGuard implements CanActivate, OnModuleInit {
    private readonly logger = new Logger(HmacVerifierGuard.name);
    private readonly hmacSecret: string;

    constructor() {
        const secret = process.env.HMAC_SHARED_SECRET;

        if (!secret || secret.trim() === '') {
            throw new Error(
                '[FATAL] HMAC_SHARED_SECRET environment variable is not set. ' +
                'Application cannot start without a valid signing secret.'
            );
        }

        this.hmacSecret = secret.trim();
    }

    onModuleInit(): void {
        this.logger.log('HmacVerifierGuard initialized. Signing secret loaded from env.');
    }

    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest<{
            headers: Record<string, string | undefined>;
            body?: unknown;
            rawBody?: Buffer;
        }>();

        const signature = request.headers['x-signature'];
        const timestampHeader = request.headers['x-timestamp'];

        if (!signature || !timestampHeader) {
            throw new UnauthorizedException('MISSING_SIGNATURE_HEADERS');
        }

        const timestamp = parseInt(timestampHeader, 10);
        if (Number.isNaN(timestamp)) {
            throw new UnauthorizedException('INVALID_TIMESTAMP_FORMAT');
        }

        const now = Date.now();
        const age = now - timestamp;

        if (age > MAX_TIMESTAMP_AGE_MS) {
            throw new UnauthorizedException('EXPIRED_TIMESTAMP');
        }

        if (age < -MAX_TIMESTAMP_FUTURE_MS) {
            throw new UnauthorizedException('FUTURE_TIMESTAMP');
        }

        let bodyStr: string;

        if (Buffer.isBuffer(request.rawBody)) {
            bodyStr = request.rawBody.toString('utf8');
        } else if (request.body !== undefined && request.body !== null) {
            bodyStr = JSON.stringify(request.body);
        } else {
            bodyStr = '';
        }

        const expectedHex = createHmac('sha256', this.hmacSecret)
            .update(`${timestamp}.${bodyStr}`)
            .digest('hex');

        if (signature.length !== EXPECTED_SIG_HEX_LEN) {
            throw new UnauthorizedException('INVALID_SIGNATURE_LENGTH');
        }

        const signatureBuffer = Buffer.from(signature, 'hex');
        const expectedBuffer = Buffer.from(expectedHex, 'hex');

        if (signatureBuffer.length !== expectedBuffer.length) {
            throw new UnauthorizedException('INVALID_SIGNATURE_LENGTH');
        }

        if (!timingSafeEqual(signatureBuffer, expectedBuffer)) {
            throw new UnauthorizedException('INVALID_PAYLOAD_SIGNATURE');
        }

        return true;
    }
}
