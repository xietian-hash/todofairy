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

// 登录锁：防止并发请求同时触发多次登录
let _loginPromise = null;

function refreshLogin() {
  if (_loginPromise) {
    return _loginPromise;
  }
  _loginPromise = wx.cloud
    .callFunction({
      name: "gateway",
      data: {
        path: "/api/v1/auth/wechat-login",
        method: "POST",
        query: {},
        body: {},
        headers: {},
      },
    })
    .then((resp) => {
      const result = (resp && resp.result) || {};
      if (result.code === 0 && result.data && result.data.token) {
        setToken(result.data.token);
        getApp().globalData.token = result.data.token;
        return result.data.token;
      }
      throw new Error(result.message || "自动登录失败");
    })
    .finally(() => {
      _loginPromise = null;
    });
  return _loginPromise;
}

function request({ path, method = "GET", query = {}, body = {}, withAuth = true, headers = {}, _retried = false }) {
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
      if (result.code === 40101 && withAuth && !_retried) {
        clearToken();
        app.globalData.token = "";
        return refreshLogin().then(() =>
          request({ path, method, query, body, withAuth, headers, _retried: true })
        );
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
