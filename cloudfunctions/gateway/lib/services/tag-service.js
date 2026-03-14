const { AppError, ERROR_CODES } = require("../errors");
const { getNowMs } = require("../date");
const { assertString } = require("../validators");
const tagRepo = require("../repositories/tag-repository");
const taskRepo = require("../repositories/task-repository");
const todoRepo = require("../repositories/todo-repository");

function sortTags(tags = []) {
  return [...tags].sort((a, b) => {
    const bySort = (Number(a.sort) || 0) - (Number(b.sort) || 0);
    if (bySort !== 0) {
      return bySort;
    }
    return (Number(a.createdAt) || 0) - (Number(b.createdAt) || 0);
  });
}

function toTagName(tag = {}) {
  return String(tag.name || tag.tagName || "").trim();
}

function formatTag(tag = {}) {
  return {
    tagId: String(tag._id || ""),
    tagName: toTagName(tag),
    sort: Number(tag.sort) || 0,
    createdAt: Number(tag.createdAt) || 0,
    updatedAt: Number(tag.updatedAt) || 0,
  };
}

function normalizeTagName(rawName) {
  assertString(rawName, "标签名称", { required: true, minLen: 1, maxLen: 20 });
  const tagName = String(rawName).trim();
  assertString(tagName, "标签名称", { required: true, minLen: 1, maxLen: 20 });
  return tagName;
}

function resolvePayloadTagName(payload = {}) {
  return normalizeTagName(
    payload.tagName !== undefined ? payload.tagName : payload.name
  );
}

function normalizeSort(rawSort, defaultValue = 0) {
  if (rawSort === undefined || rawSort === null || rawSort === "") {
    return defaultValue;
  }
  const sort = Number(rawSort);
  if (!Number.isInteger(sort) || sort < 0 || sort > 9999) {
    throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, "标签排序必须是0-9999之间的整数");
  }
  return sort;
}

function findDuplicateTag(tags = [], tagName, excludeTagId = "") {
  return tags.find((tag) => {
    if (!tag || !tag._id) {
      return false;
    }
    if (excludeTagId && String(tag._id) === String(excludeTagId)) {
      return false;
    }
    return toTagName(tag) === tagName;
  });
}

function nextSort(tags = []) {
  const maxSort = tags.reduce((maxValue, item) => {
    const sort = Number(item && item.sort);
    return Number.isFinite(sort) ? Math.max(maxValue, sort) : maxValue;
  }, 0);
  return maxSort + 1;
}

async function listTagOptions(userId) {
  const tags = sortTags(await tagRepo.listTagsByUser(userId));
  return {
    list: tags
      .filter((tag) => tag && toTagName(tag))
      .map((tag) => ({
        tagId: String(tag._id),
        tagName: toTagName(tag),
        sort: Number(tag.sort) || 0,
      })),
  };
}

async function listTags(userId) {
  const sorted = sortTags(await tagRepo.listTagsByUser(userId));
  return {
    total: sorted.length,
    list: sorted.map((tag) => formatTag(tag)),
  };
}

async function createTag(userId, payload = {}) {
  const tags = await tagRepo.listTagsByUser(userId);
  const tagName = resolvePayloadTagName(payload);
  if (findDuplicateTag(tags, tagName)) {
    throw new AppError(409, ERROR_CODES.CONFLICT, "标签名称已存在");
  }

  const now = getNowMs();
  const sort = normalizeSort(payload.sort, nextSort(tags));
  const tagId = await tagRepo.createTag({
    userId,
    name: tagName,
    tagName,
    sort,
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  });
  const created = await tagRepo.getTagById(userId, tagId);
  return formatTag(created);
}

async function updateTag(userId, tagId, payload = {}) {
  const current = await tagRepo.getTagById(userId, tagId);
  if (!current) {
    throw new AppError(404, ERROR_CODES.NOT_FOUND, "标签不存在");
  }

  const tags = await tagRepo.listTagsByUser(userId);
  const tagName = resolvePayloadTagName(payload);
  if (findDuplicateTag(tags, tagName, tagId)) {
    throw new AppError(409, ERROR_CODES.CONFLICT, "标签名称已存在");
  }

  const now = getNowMs();
  await tagRepo.updateTagById(userId, tagId, {
    name: tagName,
    tagName,
    updatedAt: now,
  });

  if (toTagName(current) !== tagName) {
    await Promise.all([
      taskRepo.updateTaskTagNameByTagId(userId, tagId, tagName, now),
      todoRepo.updateTodoTagNameByTagId(userId, tagId, tagName, now),
    ]);
  }

  const latest = await tagRepo.getTagById(userId, tagId);
  return formatTag(latest);
}

async function deleteTag(userId, tagId) {
  const tag = await tagRepo.getTagById(userId, tagId);
  if (!tag) {
    throw new AppError(404, ERROR_CODES.NOT_FOUND, "标签不存在");
  }

  const linkedTaskCount = await taskRepo.countTasksByTagId(userId, tagId);
  if (linkedTaskCount > 0) {
    throw new AppError(409, ERROR_CODES.CONFLICT, "标签已被任务使用，无法删除");
  }

  const now = getNowMs();
  await tagRepo.softDeleteTagById(userId, tagId, {
    isDeleted: true,
    deletedAt: now,
    updatedAt: now,
  });
  return {
    success: true,
  };
}

module.exports = {
  listTagOptions,
  listTags,
  createTag,
  updateTag,
  deleteTag,
};
