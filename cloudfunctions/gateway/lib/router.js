const { AppError, ERROR_CODES } = require("./errors");
const { createRouteMeta, pickRoute } = require("./route-matcher");
const userService = require("./services/user-service");
const taskService = require("./services/task-service");
const todoService = require("./services/todo-service");
const calendarService = require("./services/calendar-service");
const internalService = require("./services/internal-service");
const { ensureInternalKey } = require("./auth");

function createRoute(method, path, handler, options = {}) {
  const meta = createRouteMeta(method, path);
  return {
    ...meta,
    handler,
    public: Boolean(options.public),
    internal: Boolean(options.internal),
  };
}

const routes = [
  createRoute(
    "GET",
    "/api/v1/health",
    async ({ nowMs }) => ({
      status: "ok",
      now: nowMs,
    }),
    { public: true }
  ),
  createRoute(
    "POST",
    "/api/v1/auth/wechat-login",
    async ({ wxContext, body }) => userService.wechatLogin(wxContext, body || {}),
    { public: true }
  ),
  createRoute("GET", "/api/v1/calendar/month", async ({ auth, query }) =>
    calendarService.getMonthCalendar(auth.userId, query.month)
  ),
  createRoute("GET", "/api/v1/todos", async ({ auth, query }) =>
    todoService.listTodos(auth.userId, query)
  ),
  createRoute("PATCH", "/api/v1/todos/:todoId/status", async ({ auth, params, body }) =>
    todoService.setTodoStatus(auth.userId, params.todoId, body && body.status)
  ),
  createRoute("PATCH", "/api/v1/todos/:todoId/complete", async ({ auth, params }) =>
    todoService.setTodoStatus(auth.userId, params.todoId, 2)
  ),
  createRoute("DELETE", "/api/v1/todos/:todoId", async ({ auth, params }) =>
    todoService.deleteTodo(auth.userId, params.todoId)
  ),
  createRoute("POST", "/api/v1/tasks", async ({ auth, body }) =>
    taskService.createTask(auth.userId, body || {})
  ),
  createRoute("GET", "/api/v1/tasks/:taskId", async ({ auth, params }) =>
    taskService.getTask(auth.userId, params.taskId)
  ),
  createRoute("PUT", "/api/v1/tasks/:taskId", async ({ auth, params, body }) =>
    taskService.updateTask(auth.userId, params.taskId, body || {})
  ),
  createRoute("DELETE", "/api/v1/tasks/:taskId", async ({ auth, params }) =>
    taskService.deleteTask(auth.userId, params.taskId)
  ),
  createRoute(
    "POST",
    "/api/v1/internal/daily-rollover",
    async ({ headers }) => {
      ensureInternalKey(headers);
      return internalService.dailyRollover();
    },
    { internal: true }
  ),
  createRoute(
    "POST",
    "/api/v1/internal/db-init",
    async ({ headers }) => {
      ensureInternalKey(headers);
      return internalService.dbInit();
    },
    { internal: true }
  ),
];

function matchRoute(method, path) {
  return pickRoute(routes, method, path);
}

function ensureRoute(method, path) {
  const matched = matchRoute(method, path);
  if (!matched) {
    throw new AppError(404, ERROR_CODES.NOT_FOUND, "接口不存在");
  }
  return matched;
}

module.exports = {
  routes,
  matchRoute,
  ensureRoute,
};
