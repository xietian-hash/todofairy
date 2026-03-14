const { db } = require("../cloud");

const TAG_COLLECTION = "user_tag";

async function listTagsByUser(userId) {
  const res = await db
    .collection(TAG_COLLECTION)
    .where({
      userId,
    })
    .get();
  return (res.data || []).filter((item) => !item.isDeleted);
}

async function getTagById(userId, tagId) {
  const res = await db
    .collection(TAG_COLLECTION)
    .where({
      _id: tagId,
      userId,
    })
    .limit(1)
    .get();
  const tag = res.data[0] || null;
  if (!tag || tag.isDeleted) {
    return null;
  }
  return tag;
}

async function createTag(data) {
  const res = await db.collection(TAG_COLLECTION).add({ data });
  return res._id;
}

async function updateTagById(userId, tagId, data) {
  await db
    .collection(TAG_COLLECTION)
    .where({
      _id: tagId,
      userId,
      isDeleted: false,
    })
    .update({
      data,
    });
}

async function softDeleteTagById(userId, tagId, data) {
  await db
    .collection(TAG_COLLECTION)
    .where({
      _id: tagId,
      userId,
      isDeleted: false,
    })
    .update({
      data,
    });
}

module.exports = {
  listTagsByUser,
  getTagById,
  createTag,
  updateTagById,
  softDeleteTagById,
};
