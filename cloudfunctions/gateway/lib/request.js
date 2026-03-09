const { AppError, ERROR_CODES } = require("./errors");
const { getNowMs } = require("./date");

function normalizeEvent(event = {}) {
  const method = String(event.method || "GET").toUpperCase();
  const path = event.path || "";
  const query = event.query || {};
  const body = event.body || {};
  const headers = event.headers || {};
  const traceId =
    event.traceId || headers["x-trace-id"] || headers["X-Trace-Id"] || `${getNowMs()}-${Math.random().toString(16).slice(2, 10)}`;

  if (!path) {
    throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, "请求缺少path");
  }

  return {
    method,
    path,
    query,
    body,
    headers,
    traceId,
    nowMs: getNowMs(),
  };
}

module.exports = {
  normalizeEvent,
};
