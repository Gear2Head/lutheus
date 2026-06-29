// Lightweight in-memory Token Bucket Rate Limiter for Serverless API protection
const memoryStore = new Map();

// Clean up expired buckets every 10 minutes to prevent memory leaks
setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of memoryStore.entries()) {
        if (now > bucket.resetTime) {
            memoryStore.delete(key);
        }
    }
}, 10 * 60 * 1000).unref?.();

function rateLimit(ip, limit = 60, windowMs = 60 * 1000) {
    const now = Date.now();
    const key = `rl:${ip}`;

    let bucket = memoryStore.get(key);
    if (!bucket) {
        bucket = {
            tokens: limit,
            lastRefill: now,
            resetTime: now + windowMs
        };
        memoryStore.set(key, bucket);
    }

    // Refill tokens based on time elapsed
    const elapsed = now - bucket.lastRefill;
    if (elapsed > 0) {
        const refillRate = limit / windowMs; // tokens per ms
        const refillTokens = elapsed * refillRate;
        bucket.tokens = Math.min(limit, bucket.tokens + refillTokens);
        bucket.lastRefill = now;
    }

    if (now > bucket.resetTime) {
        bucket.resetTime = now + windowMs;
    }

    if (bucket.tokens >= 1) {
        bucket.tokens -= 1;
        return {
            success: true,
            remaining: Math.floor(bucket.tokens),
            reset: Math.max(0, Math.ceil((bucket.resetTime - now) / 1000))
        };
    }

    return {
        success: false,
        remaining: 0,
        reset: Math.max(0, Math.ceil((bucket.resetTime - now) / 1000))
    };
}

module.exports = {
    rateLimit
};
