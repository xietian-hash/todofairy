const { request } = require("./http");

function login() {
  return request({
    path: "/api/v1/auth/wechat-login",
    method: "POST",
    withAuth: false,
  });
}

function getMonthCalendar(month) {
  return request({
    path: "/api/v1/calendar/month",
    method: "GET",
    query: { month },
  });
}

function getTagOptions() {
  return request({
    path: "/api/v1/tags/options",
    method: "GET",
  });
}

function getTags() {
  return request({
    path: "/api/v1/tags",
    method: "GET",
  });
}

function createTag(payload) {
  return request({
    path: "/api/v1/tags",
    method: "POST",
    body: payload,
  });
}

function updateTag(tagId, payload) {
  return request({
    path: `/api/v1/tags/${tagId}`,
    method: "PUT",
    body: payload,
  });
}

function deleteTag(tagId) {
  return request({
    path: `/api/v1/tags/${tagId}`,
    method: "DELETE",
  });
}

function getTodos(date, status) {
  return request({
    path: "/api/v1/todos",
    method: "GET",
    query: {
      date,
      status: status || "",
    },
  });
}

function updateTodoStatus(todoId, status) {
  return request({
    path: `/api/v1/todos/${todoId}/status`,
    method: "PATCH",
    body: { status },
  });
}

function deleteTodo(todoId) {
  return request({
    path: `/api/v1/todos/${todoId}`,
    method: "DELETE",
  });
}

function compensateTodayTodos() {
  return request({
    path: "/api/v1/todos/compensate-today",
    method: "POST",
  });
}

function createTask(payload) {
  return request({
    path: "/api/v1/tasks",
    method: "POST",
    body: payload,
  });
}

function getTasks(pageNo, pageSize, status) {
  return request({
    path: "/api/v1/tasks",
    method: "GET",
    query: {
      pageNo: pageNo || 1,
      pageSize: pageSize || 20,
      status: status === undefined || status === null ? "" : status,
    },
  });
}

function getTask(taskId) {
  return request({
    path: `/api/v1/tasks/${taskId}`,
    method: "GET",
  });
}

function updateTask(taskId, payload) {
  return request({
    path: `/api/v1/tasks/${taskId}`,
    method: "PUT",
    body: payload,
  });
}

function deleteTask(taskId) {
  return request({
    path: `/api/v1/tasks/${taskId}`,
    method: "DELETE",
  });
}

module.exports = {
  login,
  getMonthCalendar,
  getTagOptions,
  getTags,
  createTag,
  updateTag,
  deleteTag,
  getTodos,
  updateTodoStatus,
  deleteTodo,
  compensateTodayTodos,
  createTask,
  getTasks,
  getTask,
  updateTask,
  deleteTask,
};
