const assert = require("assert");
const { createRouteMeta, pickRoute } = require("../../cloudfunctions/gateway/lib/route-matcher");
const { normalizeEvent } = require("../../cloudfunctions/gateway/lib/request");

function runRouterMatchTest() {
  const routes = [
    createRouteMeta("GET", "/api/v1/todos"),
    createRouteMeta("PATCH", "/api/v1/todos/:todoId/status"),
    createRouteMeta("PUT", "/api/v1/tags/:tagId"),
  ];
  const matched = pickRoute(routes, "PATCH", "/api/v1/todos/todo_1/status");
  assert.ok(matched);
  assert.strictEqual(matched.params.todoId, "todo_1");

  const tagMatched = pickRoute(routes, "PUT", "/api/v1/tags/tag_1");
  assert.ok(tagMatched);
  assert.strictEqual(tagMatched.params.tagId, "tag_1");

  const notFound = pickRoute(routes, "GET", "/api/v1/not-exist");
  assert.strictEqual(notFound, null);
}

function runRequestNormalizeTest() {
  const req = normalizeEvent({
    path: "/api/v1/todos",
    method: "GET",
    query: { date: "2026-03-09" },
    headers: {},
  });
  assert.strictEqual(req.path, "/api/v1/todos");
  assert.strictEqual(req.method, "GET");
  assert.strictEqual(req.query.date, "2026-03-09");
  assert.ok(req.traceId);
}

module.exports = {
  runRouterMatchTest,
  runRequestNormalizeTest,
};
