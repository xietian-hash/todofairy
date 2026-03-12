const { db, _ } = require("../cloud");

const TASK_COLLECTION = "task";

async function createTask(data) {
  const res = await db.collection(TASK_COLLECTION).add({ data });
  return res._id;
}

async function getTaskById(taskId, userId) {
  const res = await db
    .collection(TASK_COLLECTION)
    .where({
      _id: taskId,
      userId,
      isDeleted: false,
    })
    .limit(1)
    .get();
  return res.data[0] || null;
}

async function updateTaskById(taskId, userId, data) {
  await db
    .collection(TASK_COLLECTION)
    .where({
      _id: taskId,
      userId,
      isDeleted: false,
    })
    .update({
      data,
    });
}

async function softDeleteTaskById(taskId, userId, data) {
  await db
    .collection(TASK_COLLECTION)
    .where({
      _id: taskId,
      userId,
      isDeleted: false,
    })
    .update({
      data,
    });
}

async function listActiveTasksForDate(dateStr, limit = 100, skip = 0) {
  const res = await db
    .collection(TASK_COLLECTION)
    .where({
      isDeleted: false,
      status: 1,
      effectiveStartDate: _.lte(dateStr),
    })
    .skip(skip)
    .limit(limit)
    .get();
  return res.data || [];
}

async function countTasksByUser(userId, status) {
  const where = {
    userId,
    isDeleted: false,
  };
  if (status !== null && status !== undefined) {
    where.status = status;
  }
  const res = await db.collection(TASK_COLLECTION).where(where).count();
  return res.total || 0;
}

async function listTasksByUser(userId, options = {}) {
  const {
    status = null,
    pageNo = 1,
    pageSize = 20,
  } = options;

  const where = {
    userId,
    isDeleted: false,
  };
  if (status !== null && status !== undefined) {
    where.status = status;
  }

  const skip = (pageNo - 1) * pageSize;
  const res = await db
    .collection(TASK_COLLECTION)
    .where(where)
    .orderBy("createdAt", "desc")
    .skip(skip)
    .limit(pageSize)
    .get();
  return res.data || [];
}

module.exports = {
  createTask,
  getTaskById,
  updateTaskById,
  softDeleteTaskById,
  listActiveTasksForDate,
  countTasksByUser,
  listTasksByUser,
};
