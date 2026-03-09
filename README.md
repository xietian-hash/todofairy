# 待办精灵（本期仅小程序）

本期范围：微信小程序 + gateway 云函数单入口 + 云数据库。

## 目录结构

```text
.
├─apps/
│  └─miniprogram/              # 小程序前端
├─cloudfunctions/
│  ├─gateway/                  # API 网关云函数（本期主服务）
│  └─quickstartFunctions/      # 历史脚手架示例（保留）
├─tests/
│  ├─unit/                     # 单元测试
│  └─api/                      # 接口测试（路由/请求层）
└─.document/
   ├─AI-PRD.md
   ├─AI-UI规范.md
   ├─开发规范.md
   └─OpenAPI.yaml
```

## API 契约

- 契约文件：`.document/OpenAPI.yaml`
- 统一响应：

```json
{
  "code": 0,
  "message": "ok",
  "data": {},
  "traceId": "xxxxxx"
}
```

## 关键接口（v1）

- `POST /api/v1/auth/wechat-login`：登录获取 JWT
- `GET /api/v1/calendar/month`：月历四态
- `GET /api/v1/todos`：按日期查询待办
- `PATCH /api/v1/todos/{todoId}/status`：设置待办状态（未完成/已完成）
- `DELETE /api/v1/todos/{todoId}`：删除待办
- `POST /api/v1/tasks`：创建任务
- `PUT /api/v1/tasks/{taskId}`：编辑任务
- `GET /api/v1/tasks/{taskId}`：任务详情
- `DELETE /api/v1/tasks/{taskId}`：删除任务
- `POST /api/v1/internal/daily-rollover`：日切任务（内部）
- `POST /api/v1/internal/db-init`：集合与索引初始化（内部）

## 数据模型（本期）

- `task`：任务规则（启用/停用、生效区间、软删除）
- `todo`：执行实例
  - `status`: 1=未完成, 2=已完成
  - `isExpired`: 是否失效
  - `expiredAt`: 首次失效时间

## 本地测试

```bash
node tests/unit/run-unit.js
node tests/api/run-api.js
```

测试文件与业务文件分离在 `tests/` 目录下。

## 发布与部署

1. 在微信开发者工具中配置云开发环境 ID（`apps/miniprogram/app.js`）
2. 上传并部署 `cloudfunctions/gateway`
3. 首次部署后调用内部接口初始化集合：
   - `POST /api/v1/internal/db-init`（需 `x-internal-key`）
4. 配置定时触发 `POST /api/v1/internal/daily-rollover`

## 参考文档

- [微信小程序云开发文档](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/basis/getting-started.html)
