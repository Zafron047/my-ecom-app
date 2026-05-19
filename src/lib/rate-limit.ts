type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
};

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

const buckets = new Map<string, RateLimitBucket>();

export function getClientIp(request: Request) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || 'unknown';
  }

  return (
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-real-ip') ??
    'unknown'
  );
}

export function checkRateLimit(
  { key, limit, windowMs }: RateLimitOptions,
  nowMs = Date.now(),
) {
  const current = buckets.get(key);
  if (!current || current.resetAt <= nowMs) {
    buckets.set(key, { count: 1, resetAt: nowMs + windowMs });
    return { allowed: true, remaining: Math.max(0, limit - 1), resetAt: nowMs + windowMs };
  }

  if (current.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: current.resetAt };
  }

  current.count += 1;
  return {
    allowed: true,
    remaining: Math.max(0, limit - current.count),
    resetAt: current.resetAt,
  };
}

export async function checkDistributedRateLimit(
  { key, limit, windowMs }: RateLimitOptions,
  nowMs = Date.now(),
): Promise<RateLimitResult> {
  const { prisma } = await import('@/lib/prisma');
  if (typeof prisma.$queryRaw !== 'function') {
    return checkRateLimit({ key, limit, windowMs }, nowMs);
  }

  const resetAt = new Date(nowMs + windowMs);
  const rows = await prisma.$queryRaw<
    { count: number; resetAt: Date }[]
  >`
    INSERT INTO "RateLimitBucket" ("key", "count", "resetAt", "updatedAt")
    VALUES (${key}, 1, ${resetAt}, NOW())
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "RateLimitBucket"."resetAt" <= NOW() THEN 1
        ELSE "RateLimitBucket"."count" + 1
      END,
      "resetAt" = CASE
        WHEN "RateLimitBucket"."resetAt" <= NOW() THEN ${resetAt}
        ELSE "RateLimitBucket"."resetAt"
      END,
      "updatedAt" = NOW()
    RETURNING "count", "resetAt"
  `;
  const bucket = rows[0];
  const count = bucket?.count ?? 1;
  const bucketResetAt = bucket?.resetAt.getTime() ?? resetAt.getTime();

  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    resetAt: bucketResetAt,
  };
}

export function rateLimitHeaders(result: RateLimitResult, limit: number) {
  const retryAfterSeconds = Math.max(
    0,
    Math.ceil((result.resetAt - Date.now()) / 1000),
  );

  return {
    'Retry-After': String(retryAfterSeconds),
    'X-RateLimit-Limit': String(limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
  };
}

export function clearRateLimitBucketsForTests() {
  buckets.clear();
}
