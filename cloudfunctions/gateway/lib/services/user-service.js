const { issueToken, TOKEN_EXPIRES_IN } = require("../auth");
const { AppError, ERROR_CODES } = require("../errors");
const userRepo = require("../repositories/user-repository");

async function wechatLogin(wxContext, body = {}) {
  const openid = wxContext.OPENID || body.devOpenId;
  if (!openid) {
    throw new AppError(401, ERROR_CODES.UNAUTHORIZED, "无法获取微信身份信息");
  }

  let identity = await userRepo.findIdentityByOpenId(openid);
  let user = null;
  if (!identity) {
    user = await userRepo.createUserAndIdentity({
      openid,
      nickname: body.nickname,
      avatarUrl: body.avatarUrl,
    });
  } else {
    user = await userRepo.findUserById(identity.userId);
    if (!user) {
      user = await userRepo.createUserAndIdentity({
        openid,
        nickname: body.nickname,
        avatarUrl: body.avatarUrl,
      });
    }
  }

  await userRepo.updateLastLoginAt(user._id);

  const token = issueToken({
    userId: user._id,
    openid,
  });

  return {
    token,
    expiresIn: TOKEN_EXPIRES_IN,
    user: {
      userId: user._id,
      nickname: user.nickname || "",
      avatarUrl: user.avatarUrl || "",
    },
  };
}

module.exports = {
  wechatLogin,
};
