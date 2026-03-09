const { cloud } = require("./lib/cloud");
const { success, failure } = require("./lib/response");
const { AppError, ERROR_CODES } = require("./lib/errors");
const { normalizeEvent } = require("./lib/request");
const { ensureRoute } = require("./lib/router");
const { authenticateRequest } = require("./lib/auth");

exports.main = async (event = {}, context = {}) => {
  const wxContext = cloud.getWXContext();
  let request = null;

  try {
    request = normalizeEvent(event);
    const { route, params } = ensureRoute(request.method, request.path);
    const auth = authenticateRequest(route, request.headers, wxContext);

    const data = await route.handler({
      wxContext,
      auth,
      params,
      query: request.query,
      body: request.body,
      headers: request.headers,
      traceId: request.traceId,
      nowMs: request.nowMs,
      context,
    });

    console.log(
      JSON.stringify({
        level: "info",
        traceId: request.traceId,
        action: `${request.method} ${request.path}`,
        userId: auth ? auth.userId : "",
        result: "success",
      })
    );

    return success(data, request.traceId);
  } catch (err) {
    const traceId = request ? request.traceId : `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
    if (err instanceof AppError) {
      console.warn(
        JSON.stringify({
          level: "warn",
          traceId,
          result: "failed",
          code: err.code,
          message: err.message,
          details: err.details || null,
        })
      );
      return failure(err.code, err.message, traceId, err.details);
    }

    console.error(
      JSON.stringify({
        level: "error",
        traceId,
        result: "failed",
        code: ERROR_CODES.INTERNAL_ERROR,
        message: err.message || "系统异常",
        stack: err.stack || "",
      })
    );
    return failure(ERROR_CODES.INTERNAL_ERROR, "系统异常，请稍后重试", traceId);
  }
};
