const { db } = require("../cloud");
const { getNowMs } = require("../date");

const USER_COLLECTION = "user";
const IDENTITY_COLLECTION = "user_identity";

async function findIdentityByOpenId(openid) {
  const res = await db
    .collection(IDENTITY_COLLECTION)
    .where({
      provider: "wechat_miniprogram",
      identityKey: openid,
    })
    .limit(1)
    .get();
  return res.data[0] || null;
}

async function findUserById(userId) {
  const res = await db.collection(USER_COLLECTION).doc(userId).get().catch(() => null);
  return res && res.data ? res.data : null;
}

async function createUserAndIdentity({ openid, nickname, avatarUrl }) {
  const now = getNowMs();
  const userRes = await db.collection(USER_COLLECTION).add({
    data: {
      nickname: nickname || "微信用户",
      avatarUrl: avatarUrl || "",
      status: 1,
      lastLoginAt: now,
      createdAt: now,
      updatedAt: now,
    },
  });
  const userId = userRes._id;
  await db.collection(IDENTITY_COLLECTION).add({
    data: {
      userId,
      provider: "wechat_miniprogram",
      identityKey: openid,
      openid,
      unionid: "",
      createdAt: now,
      updatedAt: now,
    },
  });
  return findUserById(userId);
}

async function updateLastLoginAt(userId) {
  const now = getNowMs();
  await db.collection(USER_COLLECTION).doc(userId).update({
    data: {
      lastLoginAt: now,
      updatedAt: now,
    },
  });
}

module.exports = {
  findIdentityByOpenId,
  findUserById,
  createUserAndIdentity,
  updateLastLoginAt,
};
