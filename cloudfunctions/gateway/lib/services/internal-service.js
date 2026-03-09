const { db } = require("../cloud");
const { todayStr, getNowMs, compareDateStr } = require("../date");
const todoRepo = require("../repositories/todo-repository");
const taskRepo = require("../repositories/task-repository");
const todoService = require("./todo-service");

const COLLECTIONS = [
  "user",
  "user_identity",
  "user_credential",
  "task",
  "todo",
  "todo_generation_log",
];

const INDEXES = [
  {
    collection: "user_identity",
    name: "idx_provider_identityKey",
    keys: [{ name: "provider", direction: 1 }, { name: "identityKey", direction: 1 }],
    unique: true,
  },
  {
    collection: "task",
    name: "idx_user_status_deleted",
    keys: [
      { name: "userId", direction: 1 },
      { name: "status", direction: 1 },
      { name: "isDeleted", direction: 1 },
    ],
  },
  {
    collection: "todo",
    name: "idx_user_task_date",
    keys: [
      { name: "userId", direction: 1 },
      { name: "taskId", direction: 1 },
      { name: "todoDate", direction: 1 },
    ],
    unique: true,
  },
];

async function dailyRollover() {
  const today = todayStr();
  const now = getNowMs();
  const expiredMarked = await todoRepo.markExpiredBeforeDate(today, now);

  let todoGenerated = 0;
  let skip = 0;
  const limit = 100;
  // 分页扫描任务，避免一次性读取过多数据。
  while (true) {
    const tasks = await taskRepo.listActiveTasksForDate(today, limit, skip);
    if (!tasks.length) break;
    for (const task of tasks) {
      const inRange =
        compareDateStr(today, task.effectiveStartDate) >= 0 &&
        (!task.effectiveEndDate || compareDateStr(today, task.effectiveEndDate) <= 0);
      if (!inRange) continue;
      const result = await todoService.ensureTodoForTaskDate(task, today, "cron_0000");
      if (result.created) {
        todoGenerated += 1;
      }
    }
    if (tasks.length < limit) break;
    skip += limit;
  }

  return {
    todoGenerated,
    expiredMarked,
  };
}

async function dbInit() {
  const createdCollections = [];
  const indexResults = [];
  const warnings = [];

  for (const name of COLLECTIONS) {
    try {
      await db.createCollection(name);
      createdCollections.push(name);
    } catch (err) {
      if (!String(err.message || "").includes("already exists")) {
        warnings.push(`集合${name}创建异常: ${err.message || "unknown"}`);
      }
    }
  }

  for (const indexDef of INDEXES) {
    try {
      const collection = db.collection(indexDef.collection);
      if (typeof collection.createIndex !== "function") {
        warnings.push(
          `当前运行环境不支持代码创建索引，请在控制台为${indexDef.collection}手动创建${indexDef.name}`
        );
        continue;
      }
      await collection.createIndex({
        name: indexDef.name,
        unique: Boolean(indexDef.unique),
        keys: indexDef.keys,
      });
      indexResults.push({
        collection: indexDef.collection,
        name: indexDef.name,
        created: true,
      });
    } catch (err) {
      warnings.push(`索引${indexDef.name}创建异常: ${err.message || "unknown"}`);
    }
  }

  return {
    collections: createdCollections,
    indexes: indexResults,
    warnings,
  };
}

module.exports = {
  dailyRollover,
  dbInit,
};
