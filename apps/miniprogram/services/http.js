const TOKEN_KEY = "TODO_FAIRY_TOKEN";

function getToken() {
  return wx.getStorageSync(TOKEN_KEY) || "";
}

function setToken(token) {
  wx.setStorageSync(TOKEN_KEY, token);
}

function clearToken() {
  wx.removeStorageSync(TOKEN_KEY);
}

function request({ path, method = "GET", query = {}, body = {}, withAuth = true, headers = {} }) {
  const app = getApp();
  const finalHeaders = { ...headers };
  const token = getToken();
  if (withAuth && token) {
    finalHeaders.Authorization = `Bearer ${token}`;
  }

  return wx.cloud
    .callFunction({
      name: "gateway",
      data: {
        path,
        method,
        query,
        body,
        headers: finalHeaders,
      },
    })
    .then((resp) => {
      const result = (resp && resp.result) || {};
      if (result.code === 0) {
        return result.data;
      }
      if (result.code === 40101) {
        clearToken();
        app.globalData.token = "";
      }
      throw new Error(result.message || "请求失败");
    });
}

module.exports = {
  TOKEN_KEY,
  getToken,
  setToken,
  clearToken,
  request,
};
