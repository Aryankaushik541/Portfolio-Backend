// Strips keys starting with "$" or containing "." from incoming request data
// to prevent NoSQL (MongoDB) operator-injection attacks, without requiring
// an extra third-party dependency.
function clean(obj) {
  if (Array.isArray(obj)) {
    return obj.map(clean);
  }
  if (obj && typeof obj === "object") {
    const out = {};
    for (const key of Object.keys(obj)) {
      if (key.startsWith("$") || key.includes(".")) continue;
      out[key] = clean(obj[key]);
    }
    return out;
  }
  return obj;
}

export function sanitizeInput(req, res, next) {
  if (req.body) req.body = clean(req.body);
  if (req.query) req.query = clean(req.query);
  if (req.params) req.params = clean(req.params);
  next();
}
