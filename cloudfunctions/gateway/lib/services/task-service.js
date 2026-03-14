const { AppError, ERROR_CODES } = require("../errors");
const { assertString, assertDate, assertDateRange, assertEnum } = require("../validators");
const { todayStr, getNowMs, isDateInRange } = require("../date");
const { normalizeRepeatRule, isSameRepeatRule } = require("../repeat-rule");
const taskRepo = require("../repositories/task-repository");
const todoRepo = require("../repositories/todo-repository");
const tagRepo = require("../repositories/tag-repository");
const todoService = require("./todo-service");

function normalizeTaskPayload(payload = {}) {
  assertString(payload.title, "浠诲姟鏍囬", { required: true, minLen: 1, maxLen: 64 });
  assertString(payload.remark || "", "浠诲姟澶囨敞", { required: false, maxLen: 300 });
  assertDate(payload.effectiveStartDate, "effectiveStartDate");
  if (payload.effectiveEndDate) {
    assertDate(payload.effectiveEndDate, "鐢熸晥缁撴潫鏃ユ湡");
  }
  assertDateRange(payload.effectiveStartDate, payload.effectiveEndDate, "effectiveStartDate", "effectiveEndDate");

  const repeatRule = normalizeRepeatRule(payload.repeatRule, true);

  const status = payload.status === undefined ? 1 : Number(payload.status);
  assertEnum(status, "Task status", [0, 1]);

  return {
    title: payload.title.trim(),
    remark: (payload.remark || "").trim(),
    effectiveStartDate: payload.effectiveStartDate,
    effectiveEndDate: payload.effectiveEndDate || null,
    repeatRule,
    status,
  };
}

async function normalizeStoredTaskRepeatRule(task) {
  if (!task) {
    return task;
  }
  const normalizedRepeatRule = normalizeRepeatRule(task.repeatRule, false);
  if (isSameRepeatRule(task.repeatRule || {}, normalizedRepeatRule)) {
    return {
      ...task,
      repeatRule: normalizedRepeatRule,
    };
  }
  const now = getNowMs();
  await taskRepo.updateTaskById(task._id, task.userId, {
    repeatRule: normalizedRepeatRule,
    updatedAt: now,
  });
  return {
    ...task,
    repeatRule: normalizedRepeatRule,
    updatedAt: now,
  };
}

async function normalizeTaskListRepeatRule(taskList = []) {
  if (!taskList.length) {
    return taskList;
  }
  const now = getNowMs();
  const normalizedList = [];
  for (const task of taskList) {
    const normalizedRepeatRule = normalizeRepeatRule(task.repeatRule, false);
    if (!isSameRepeatRule(task.repeatRule || {}, normalizedRepeatRule)) {
      await taskRepo.updateTaskById(task._id, task.userId, {
        repeatRule: normalizedRepeatRule,
        updatedAt: now,
      });
      normalizedList.push({
        ...task,
        repeatRule: normalizedRepeatRule,
        updatedAt: now,
      });
    } else {
      normalizedList.push({
        ...task,
        repeatRule: normalizedRepeatRule,
      });
    }
  }
  return normalizedList;
}

async function resolveTaskTag(userId, rawTagId) {
  if (rawTagId === undefined || rawTagId === null || rawTagId === "") {
    return {
      tagId: null,
      tagName: null,
    };
  }

  assertString(rawTagId, "鏍囩ID", { required: true, minLen: 1, maxLen: 64 });
  const tagId = rawTagId.trim();
  const tag = await tagRepo.getTagById(userId, tagId);
  if (!tag) {
    throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, "Tag not found or unavailable");
  }
  if (!(tag.name || tag.tagName)) {
    throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, "鏍囩鍚嶇О涓嶈兘涓虹┖");
  }

  return {
    tagId: tag._id,
    tagName: tag.name || tag.tagName,
  };
}

async function createTask(userId, payload) {
  const now = getNowMs();
  const normalized = normalizeTaskPayload(payload);
  const tag = await resolveTaskTag(userId, payload && payload.tagId);
  const taskData = {
    userId,
    ...normalized,
    ...tag,
    isDeleted: false,
    version: 1,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  const taskId = await taskRepo.createTask(taskData);
  const created = await taskRepo.getTaskById(taskId, userId);

  const today = todayStr();
  if (
    created.status === 1 &&
    isDateInRange(today, created.effectiveStartDate, created.effectiveEndDate) &&
    todoService.shouldTaskGenerateOnDate(created, today, "create_task")
  ) {
    await todoService.ensureTodoForTaskDate(created, today, "create_task");
  }
  return normalizeStoredTaskRepeatRule(created);
}

async function getTask(userId, taskId) {
  const task = await taskRepo.getTaskById(taskId, userId);
  if (!task) {
    throw new AppError(404, ERROR_CODES.NOT_FOUND, "Task not found");
  }
  return normalizeStoredTaskRepeatRule(task);
}

function normalizePageNo(value) {
  const pageNo = Number(value || 1);
  if (!Number.isInteger(pageNo) || pageNo < 1) {
    throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, "pageNo must be an integer >= 1");
  }
  return pageNo;
}

function normalizePageSize(value) {
  const pageSize = Number(value || 20);
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, "pageSize must be an integer between 1 and 100");
  }
  return pageSize;
}

function normalizeTaskListStatus(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const status = Number(value);
  assertEnum(status, "Task status", [0, 1]);
  return status;
}

async function listTasks(userId, query = {}) {
  const pageNo = normalizePageNo(query.pageNo);
  const pageSize = normalizePageSize(query.pageSize);
  const status = normalizeTaskListStatus(query.status);
  const [total, list] = await Promise.all([
    taskRepo.countTasksByUser(userId, status),
    taskRepo.listTasksByUser(userId, {
      status,
      pageNo,
      pageSize,
    }),
  ]);
  const normalizedList = await normalizeTaskListRepeatRule(list);

  return {
    pageNo,
    pageSize,
    total,
    list: normalizedList,
  };
}

async function updateTask(userId, taskId, payload) {
  const current = await getTask(userId, taskId);
  const normalized = normalizeTaskPayload(payload);
  const hasTagId = Object.prototype.hasOwnProperty.call(payload || {}, "tagId");
  const tag = hasTagId
    ? await resolveTaskTag(userId, payload.tagId)
    : {
        tagId: current.tagId || null,
        tagName: current.tagName || null,
      };
  const now = getNowMs();

  await taskRepo.updateTaskById(taskId, userId, {
    ...normalized,
    ...tag,
    version: (current.version || 1) + 1,
    updatedAt: now,
  });

  const latest = await getTask(userId, taskId);
  const today = todayStr();
  const todayTodo = await todoRepo.findTodoByTaskAndDate(userId, taskId, today);

  if (
    latest.status === 1 &&
    isDateInRange(today, latest.effectiveStartDate, latest.effectiveEndDate) &&
    todoService.shouldTaskGenerateOnDate(latest, today, "update_task")
  ) {
    if (todayTodo && todayTodo.status === 1) {
      await todoRepo.updateTodoByTaskAndDate(userId, taskId, today, {
        title: latest.title,
        remark: latest.remark || "",
        tagId: latest.tagId || null,
        tagName: latest.tagName || null,
        taskVersion: latest.version,
        updatedAt: now,
      });
    } else if (!todayTodo) {
      await todoService.ensureTodoForTaskDate(latest, today, "create_task");
    }
  }

  return latest;
}

async function deleteTask(userId, taskId) {
  await getTask(userId, taskId);
  const now = getNowMs();
  await taskRepo.softDeleteTaskById(taskId, userId, {
    isDeleted: true,
    deletedAt: now,
    updatedAt: now,
  });
  return {
    success: true,
  };
}

module.exports = {
  createTask,
  listTasks,
  getTask,
  updateTask,
  deleteTask,
};
