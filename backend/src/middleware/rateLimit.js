const buckets = new Map();
const MAX_BUCKETS = 10_000;

const cleanup = () => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
};

const cleanupInterval = setInterval(cleanup, 60_000);
cleanupInterval.unref();

export const createRateLimiter = ({ limit, windowMs = 60_000 }) =>
  (req, res, next) => {
    const now = Date.now();
    const key = `${req.baseUrl}${req.path}:${req.ip || req.socket.remoteAddress || "unknown"}`;
    let bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      if (buckets.size >= MAX_BUCKETS && !bucket) {
        cleanup();
        if (buckets.size >= MAX_BUCKETS) {
          return res.status(503).json({
            status: "error",
            message: "Webhook capacity is temporarily unavailable.",
          });
        }
      }
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }

    res.set("RateLimit-Limit", String(limit));
    res.set("RateLimit-Remaining", String(Math.max(0, limit - bucket.count - 1)));
    res.set("RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));
    if (bucket.count >= limit) {
      return res.status(429).json({
        status: "error",
        message: "Too many webhook requests. Try again later.",
      });
    }

    bucket.count += 1;
    return next();
  };
