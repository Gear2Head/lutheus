import { Injectable, NestMiddleware, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

export interface RedisLike {
    eval(script: string, numKeys: number, ...args: (string | number)[]): Promise<unknown>;
    ping?(): Promise<string>;
}

const TOKEN_BUCKET_SCRIPT = `
local key          = KEYS[1]
local now          = tonumber(ARGV[1])
local capacity     = tonumber(ARGV[2])
local refillRate   = tonumber(ARGV[3])
local ttl          = tonumber(ARGV[4])

local data = redis.call("HMGET", key, "tokens", "last_refill")
local tokens      = tonumber(data[1]) or capacity
local last_refill = tonumber(data[2]) or now

local elapsed_sec = (now - last_refill) / 1000
local new_tokens  = elapsed_sec * refillRate
tokens = math.min(capacity, tokens + new_tokens)

if tokens < 1 then
    redis.call("HSET", key, "tokens", tokens, "last_refill", now)
    redis.call("EXPIRE", key, ttl)
    return 0
end

tokens = tokens - 1
redis.call("HSET", key, "tokens", tokens, "last_refill", now)
redis.call("EXPIRE", key, ttl)
return 1
`;

export interface TokenBucketOptions {
    maxBucketSize?: number;
    refillRate?: number;
    failOpen?: boolean;
}

@Injectable()
export class TokenBucketRateLimiter implements NestMiddleware {
    private readonly logger = new Logger(TokenBucketRateLimiter.name);
    private readonly maxBucketSize: number;
    private readonly refillRate: number;
    private readonly failOpen: boolean;
    private readonly ttlSeconds: number;

    constructor(
        private readonly redisClient: RedisLike,
        options: TokenBucketOptions = {}
    ) {
        this.maxBucketSize = options.maxBucketSize ?? 100;
        this.refillRate = options.refillRate ?? 10;
        this.ttlSeconds = Math.ceil(this.maxBucketSize / this.refillRate) * 2;

        const envFlag = process.env.RATE_LIMIT_FAIL_OPEN;
        if (envFlag !== undefined) {
            this.failOpen = envFlag.toLowerCase() !== 'false';
        } else {
            this.failOpen = options.failOpen ?? true;
        }

        if (!process.env.REDIS_URL && !process.env.REDIS_HOST) {
            this.logger.warn(
                'Redis connection env vars (REDIS_URL / REDIS_HOST) are not set. ' +
                'Rate limiter will use fail-open mode until Redis is reachable.'
            );
        }
    }

    async use(req: Request, res: Response, next: NextFunction): Promise<void> {
        const rawId =
            (req.headers['x-client-id'] as string | undefined) ||
            req.ip ||
            'unknown';

        const clientId = rawId.replace(/[^a-zA-Z0-9._\-:]/g, '_').slice(0, 200);
        const redisKey = `rl:bucket:${clientId}`;

        try {
            const result = await this.redisClient.eval(
                TOKEN_BUCKET_SCRIPT,
                1,
                redisKey,
                Date.now(),
                this.maxBucketSize,
                this.refillRate,
                this.ttlSeconds
            );

            if (result !== 1) {
                this.logger.warn(`[RateLimiter] 429 TOO_MANY_REQUESTS for client: ${clientId}`);
                res.setHeader('Retry-After', Math.ceil(1 / this.refillRate).toString());
                throw new HttpException('TOO_MANY_REQUESTS', HttpStatus.TOO_MANY_REQUESTS);
            }

            next();
        } catch (error) {
            if (error instanceof HttpException) throw error;

            this.logger.error(
                `[RateLimiter] Redis error: ${(error as Error).message}. ` +
                `Fail mode: ${this.failOpen ? 'OPEN (allowing request)' : 'CLOSED (rejecting request)'}`
            );

            if (this.failOpen) {
                next();
            } else {
                throw new HttpException('SERVICE_UNAVAILABLE', HttpStatus.SERVICE_UNAVAILABLE);
            }
        }
    }
}
