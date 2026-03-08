# 待办精灵（云开发，多端架构）

本项目采用微信云开发，并预留小程序、Web、Electron 桌面端统一接入能力。

## 目录结构

```text
.
├─apps/
│  ├─miniprogram/          # 小程序端
│  ├─web/                  # Web 端（预留）
│  └─desktop-electron/     # 桌面端（预留）
├─packages/
│  ├─shared/               # 跨端共享模块
│  └─api-client/           # 统一 API 调用封装
├─cloudfunctions/          # 云函数
└─.document/               # PRD、UI规范、开发规范
```

## 开发约束

- 前端禁止直接访问云数据库（包括查询），统一调用服务端 API。
- 小程序根目录已迁移为 `apps/miniprogram/`。
- 云函数目录保持为 `cloudfunctions/`。

## 参考文档

- [微信小程序云开发文档](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/basis/getting-started.html)
