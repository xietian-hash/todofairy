const { db, _ } = require("../cloud");

const TODO_COLLECTION = "todo";

async function getTodoById(todoId, userId) {
  const res = await db
    .collection(TODO_COLLECTION)
    .where({
      _id: todoId,
      userId,
      isDeleted: false,
    })
    .limit(1)
    .get();
  return res.data[0] || null;
}

async function findTodoByTaskAndDate(userId, taskId, todoDate) {
  const res = await db
    .collection(TODO_COLLECTION)
    .where({
      userId,
      taskId,
      todoDate,
      isDeleted: false,
    })
    .limit(1)
    .get();
  return res.data[0] || null;
}

async function findAnyTodoByTaskAndDate(userId, taskId, todoDate) {
  const res = await db
    .collection(TODO_COLLECTION)
    .where({
      userId,
      taskId,
      todoDate,
    })
    .limit(1)
    .get();
  return res.data[0] || null;
}

async function createTodo(data) {
  const res = await db.collection(TODO_COLLECTION).add({ data });
  return res._id;
}

async function updateTodoById(todoId, userId, data) {
  await db
    .collection(TODO_COLLECTION)
    .where({
      _id: todoId,
      userId,
      isDeleted: false,
    })
    .update({
      data,
    });
}

async function updateTodoByTaskAndDate(userId, taskId, todoDate, data) {
  await db
    .collection(TODO_COLLECTION)
    .where({
      userId,
      taskId,
      todoDate,
      isDeleted: false,
      status: 1,
    })
    .update({
      data,
    });
}

async function listTodosByDate(userId, dateStr, status) {
  const where = {
    userId,
    todoDate: dateStr,
    isDeleted: false,
  };
  if (status) {
    where.status = status;
  }
  const res = await db
    .collection(TODO_COLLECTION)
    .where(where)
    .orderBy("createdAt", "asc")
    .get();
  return res.data || [];
}

async function listTodosByDateRange(userId, startDate, endDate) {
  const res = await db
    .collection(TODO_COLLECTION)
    .where({
      userId,
      isDeleted: false,
      todoDate: _.and([_.gte(startDate), _.lte(endDate)]),
    })
    .get();
  return res.data || [];
}

async function markExpiredBeforeDate(dateStr, nowMs) {
  const res = await db
    .collection(TODO_COLLECTION)
    .where({
      isDeleted: false,
      status: 1,
      isExpired: false,
      todoDate: _.lt(dateStr),
    })
    .update({
      data: {
        isExpired: true,
        expiredAt: nowMs,
        updatedAt: nowMs,
      },
    });
  return res.stats ? res.stats.updated : 0;
}

async function updateTodoTagNameByTagId(userId, tagId, tagName, nowMs) {
  await db
    .collection(TODO_COLLECTION)
    .where({
      userId,
      isDeleted: false,
      tagId,
    })
    .update({
      data: {
        tagName,
        updatedAt: nowMs,
      },
    });
}

module.exports = {
  getTodoById,
  findTodoByTaskAndDate,
  findAnyTodoByTaskAndDate,
  createTodo,
  updateTodoById,
  updateTodoByTaskAndDate,
  listTodosByDate,
  listTodosByDateRange,
  markExpiredBeforeDate,
  updateTodoTagNameByTagId,
};
