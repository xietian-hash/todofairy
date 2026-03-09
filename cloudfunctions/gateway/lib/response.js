function success(data, traceId) {
  return {
    code: 0,
    message: "ok",
    data,
    traceId,
  };
}

function failure(code, message, traceId, details) {
  const payload = {
    code,
    message,
    data: null,
    traceId,
  };
  if (details) {
    payload.details = details;
  }
  return payload;
}

module.exports = {
  success,
  failure,
};
