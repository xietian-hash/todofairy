const { AppError, ERROR_CODES } = require("../errors");
const { getNowMs, todayStr, compareDateStr } = require("../date");
const { assertEnum } = require("../validators");
const { shouldTaskGenerateOnDate, normalizeRepeatRule, isSameRepeatRule } = require("../repeat-rule");
const todoRepo = require("../repositories/todo-repository");
const taskRepo = require("../repositories/task-repository");

function isDuplicateKeyError(err) {
  const message = String((err && err.message) || "").toLowerCase();
  return message.includes("duplicate") || message.includes("e11000") || message.includes("unique");
}

function sortTodosByTag(todos) {
  return [...todos].sort((a, b) => {
    const aHasTag = Boolean(a.tagName);
    const bHasTag = Boolean(b.tagName);
    if (aHasTag !== bHasTag) {
      return aHasTag ? -1 : 1;
    }

    if (aHasTag && bHasTag) {
      const byTag = String(a.tagName).localeCompare(String(b.tagName), "zh-Hans-CN");
      if (byTag !== 0) {
        return byTag;
      }
    }

    const aCreatedAt = Number(a.createdAt) || 0;
    const bCreatedAt = Number(b.createdAt) || 0;
    if (aCreatedAt !== bCreatedAt) {
      return aCreatedAt - bCreatedAt;
    }
    return String(a._id || "").localeCompare(String(b._id || ""));
  });
}

async function ensureTodoForTaskDate(task, todoDate, triggerType) {
  const existed = await todoRepo.findTodoByTaskAndDate(task.userId, task._id, todoDate);
  if (existed) {
    return {
      created: false,
      todo: existed,
      reason: "already_exists",
    };
  }

  const now = getNowMs();
  const todoData = {
    userId: task.userId,
    taskId: task._id,
    taskVersion: task.version || 1,
    todoDate,
    triggerType,
    title: task.title,
    remark: task.remark || "",
    tagId: task.tagId || null,
    tagName: task.tagName || null,
    completedAt: null,
    status: 1,
    isExpired: false,
    expiredAt: null,
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };

  try {
    const todoId = await todoRepo.createTodo(todoData);
    return {
      created: true,
      todo: {
        ...todoData,
        _id: todoId,
      },
      reason: "created",
    };
  } catch (err) {
    if (!isDuplicateKeyError(err)) {
      throw err;
    }
    const duplicate = await todoRepo.findAnyTodoByTaskAndDate(task.userId, task._id, todoDate);
    return {
      created: false,
      todo: duplicate || null,
      reason: duplicate && duplicate.isDeleted ? "duplicate_deleted" : "duplicate_key",
    };
  }
}

async function compensateTodayForUser(userId) {
  const today = todayStr();
  const now = getNowMs();

  let todoGenerated = 0;
  let taskScanned = 0;
  let skip = 0;
  const limit = 100;

  while (true) {
    const tasks = await taskRepo.listActiveTasksByUserForDate(userId, today, limit, skip);
    if (!tasks.length) {
      break;
    }

    for (const task of tasks) {
      taskScanned += 1;
      const normalizedRepeatRule = normalizeRepeatRule(task.repeatRule, false);
      if (!isSameRepeatRule(task.repeatRule || {}, normalizedRepeatRule)) {
        await taskRepo.updateTaskById(task._id, task.userId, {
          repeatRule: normalizedRepeatRule,
          updatedAt: now,
        });
        task.repeatRule = normalizedRepeatRule;
      }

      const inRange =
        compareDateStr(today, task.effectiveStartDate) >= 0 &&
        (!task.effectiveEndDate || compareDateStr(today, task.effectiveEndDate) <= 0);
      if (!inRange) {
        continue;
      }
      if (!shouldTaskGenerateOnDate(task, today, "compensate_today")) {
        continue;
      }

      const result = await ensureTodoForTaskDate(task, today, "compensate_today");
      if (result.created) {
        todoGenerated += 1;
      }
    }

    if (tasks.length < limit) {
      break;
    }
    skip += limit;
  }

  return {
    date: today,
    taskScanned,
    todoGenerated,
  };
}

async function listTodos(userId, query) {
  const date = query.date || todayStr();
  const status = query.status ? Number(query.status) : null;
  const todos = sortTodosByTag(await todoRepo.listTodosByDate(userId, date, status));
  const completedCount = todos.filter((item) => item.status === 2).length;
  const uncompletedCount = todos.filter((item) => item.status === 1).length;
  return {
    date,
    completedCount,
    uncompletedCount,
    total: todos.length,
    list: todos,
  };
}

async function setTodoStatus(userId, todoId, status) {
  const nextStatus = Number(status);
  assertEnum(nextStatus, "Todo status", [1, 2]);

  const todo = await todoRepo.getTodoById(todoId, userId);
  if (!todo) {
    throw new AppError(404, ERROR_CODES.NOT_FOUND, "Todo not found");
  }
  if (todo.status === nextStatus) {
    return todo;
  }

  const now = getNowMs();
  if (nextStatus === 2) {
    await todoRepo.updateTodoById(todoId, userId, {
      status: 2,
      completedAt: now,
      isExpired: false,
      updatedAt: now,
    });
  } else {
    const today = todayStr();
    const shouldExpired = compareDateStr(todo.todoDate, today) < 0;
    await todoRepo.updateTodoById(todoId, userId, {
      status: 1,
      completedAt: null,
      isExpired: shouldExpired,
      expiredAt: shouldExpired ? todo.expiredAt || now : todo.expiredAt,
      updatedAt: now,
    });
  }

  return todoRepo.getTodoById(todoId, userId);
}

async function deleteTodo(userId, todoId) {
  const todo = await todoRepo.getTodoById(todoId, userId);
  if (!todo) {
    throw new AppError(404, ERROR_CODES.NOT_FOUND, "Todo not found");
  }
  const now = getNowMs();
  await todoRepo.updateTodoById(todoId, userId, {
    isDeleted: true,
    deletedAt: now,
    updatedAt: now,
  });
  return {
    success: true,
  };
}

module.exports = {
  shouldTaskGenerateOnDate,
  ensureTodoForTaskDate,
  compensateTodayForUser,
  listTodos,
  setTodoStatus,
  deleteTodo,
};
