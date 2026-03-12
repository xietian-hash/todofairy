const { AppError, ERROR_CODES } = require("../errors");
const { getNowMs, todayStr, compareDateStr } = require("../date");
const { assertEnum } = require("../validators");
const todoRepo = require("../repositories/todo-repository");

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

  const todoId = await todoRepo.createTodo(todoData);
  return {
    created: true,
    todo: {
      ...todoData,
      _id: todoId,
    },
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
  assertEnum(nextStatus, "待办状态", [1, 2]);

  const todo = await todoRepo.getTodoById(todoId, userId);
  if (!todo) {
    throw new AppError(404, ERROR_CODES.NOT_FOUND, "待办不存在");
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
    throw new AppError(404, ERROR_CODES.NOT_FOUND, "待办不存在");
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
  ensureTodoForTaskDate,
  listTodos,
  setTodoStatus,
  deleteTodo,
};
