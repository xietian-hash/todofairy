const jwt = require("jsonwebtoken");
const { AppError, ERROR_CODES } = require("./errors");

const TOKEN_EXPIRES_IN = 12 * 60 * 60;

function getJwtSecret() {
  return process.env.JWT_SECRET || "todo-fairy-dev-secret";
}

function issueToken(payload) {
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: TOKEN_EXPIRES_IN,
  });
}

function parseBearerToken(headers = {}) {
  const auth = headers.Authorization || headers.authorization || "";
  if (!auth) return null;
  const [type, token] = auth.split(" ");
  if (!type || !token || type.toLowerCase() !== "bearer") {
    return null;
  }
  return token;
}

function verifyToken(token) {
  try {
    return jwt.verify(token, getJwtSecret());
  } catch (err) {
    throw new AppError(401, ERROR_CODES.UNAUTHORIZED, "登录状态已失效，请重新登录");
  }
}

function ensureInternalKey(headers = {}) {
  const expected = process.env.INTERNAL_CALL_KEY || "";
  const incoming = headers["x-internal-key"] || headers["X-Internal-Key"] || "";
  if (!expected || expected !== incoming) {
    throw new AppError(403, ERROR_CODES.FORBIDDEN, "内部调用鉴权失败");
  }
}

function authenticateRequest(route, headers, wxContext) {
  if (route.public) return null;
  if (route.internal) return null;

  const token = parseBearerToken(headers);
  if (!token) {
    throw new AppError(401, ERROR_CODES.UNAUTHORIZED, "请先登录");
  }
  const payload = verifyToken(token);
  if (wxContext.OPENID && payload.openid && wxContext.OPENID !== payload.openid) {
    throw new AppError(403, ERROR_CODES.FORBIDDEN, "用户身份不匹配");
  }
  return payload;
}

module.exports = {
  TOKEN_EXPIRES_IN,
  issueToken,
  parseBearerToken,
  verifyToken,
  ensureInternalKey,
  authenticateRequest,
};
