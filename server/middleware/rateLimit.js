// Fixed-window, in-memory rate limiter keyed by client IP + path. Used to slow brute-force
// attempts on the auth endpoints.
// ponytail: per-process memory only — if this ever runs on multiple instances, move the
// counter to a shared store (Redis/Turso) so limits are global.
function rateLimit({ windowMs, max }) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    // Opportunistic cleanup so the Map can't grow without bound.
    if (hits.size > 5000) for (const [k, v] of hits) if (now > v.reset) hits.delete(k);

    const key = `${req.ip || req.socket.remoteAddress || 'unknown'}:${req.path}`;
    let rec = hits.get(key);
    if (!rec || now > rec.reset) { rec = { count: 0, reset: now + windowMs }; hits.set(key, rec); }
    rec.count += 1;
    if (rec.count > max) {
      const retry = Math.ceil((rec.reset - now) / 1000);
      res.setHeader('Retry-After', String(retry));
      return res.status(429).json({ error: `Too many attempts. Please try again in ${retry}s.` });
    }
    next();
  };
}

module.exports = rateLimit;
