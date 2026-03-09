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

function createTask(payload) {
  return request({
    path: "/api/v1/tasks",
    method: "POST",
    body: payload,
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

module.exports = {
  login,
  getMonthCalendar,
  getTodos,
  updateTodoStatus,
  deleteTodo,
  createTask,
  getTask,
  updateTask,
};
