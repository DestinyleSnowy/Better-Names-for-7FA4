# Better Names for 7FA4

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-2026.06.16-green.svg)
![Build](https://img.shields.io/badge/build-passing-brightgreen.svg)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-orange.svg)

### 介绍

Better Names for 7FA4 是一款适用于 7FA4 在线评测系统的开源浏览器扩展，旨在改进界面显示并提供便捷功能。

### 使用

要使用 Better Names for 7FA4 插件，可以在 Gitlab 或 Github 的 **Release** 处进行下载。在 Gitlab 上，您可以在 Release 处 `Automated release from GitHub Actions. Download: Better-Names-for-7FA4-<version>.zip` 字样链接下载插件压缩包，或在 `Assets` 处下载 Github 仓库完整源码。

建议您**更新到最新版本**及**加入 Better Names 计划**以获取更好的体验。

### 本地加载

当前仓库已经建立新的 `TypeScript + 单仓多入口` 重构骨架。源码主入口已经切到 `src/`，构建产物目标为 `dist/`。

开发阶段：

1. 安装依赖：`npm install`
2. 类型检查：`npm run typecheck`
3. 产出扩展：`npm run build`
4. 在浏览器中加载目录 `E:\Better-Names-for-7FA4-Refactoring\dist`

说明：

- `manifest.json` 仍保留在仓库根目录，作为当前最小可加载占位入口；
- 新架构的正式入口是 `src/app/content/main.ts`、`src/app/popup/main.ts`、`src/app/worker/main.ts`；
- 正式 manifest 模板位于 `manifests/manifest.base.json`，构建时写入 `dist/manifest.json`；
- `Better-Names-for-7FA4/` 旧目录仅保留作参考，不参与新架构设计。

### 新功能请求

如果您有好的建议、新功能的想法、bug 的反馈等非开发问题，可以：
- 在 Gitlab 上提 issue；
- 更新至最新版本的 Better Names，在插件面板上获取 QQ 群进群方式，或通过私信功能联系我们。

如果您需要成为开发者，请前往 Github。

往往，向 Better Names 捐赠 (vx: DestinyleSnowy, QQ: 2581056985)，可以得到更快的解决。

### 开发

Better Names for 7FA4 核心功能已开发完成并已趋于稳定，但该项目仍持续维护，并周期性处理兼容性、安全和发布工作。欢迎向我们联系！

### 重构骨架

当前重构骨架以你确认的方案为基线：

- `MV3`
- `TypeScript`
- `单仓多入口构建`
- `content-app` 作为统一内容入口
- `service worker` 只承载平台能力
- `feature` 独立注册
- `config/schema/migration` 独立
- `DOM / API / storage` 走 adapter
- 按页面路由装配 feature

当前目录分层：

- `src/app/`：运行时入口与装配层
- `src/features/`：页面能力模块
- `src/platform/`：浏览器平台能力
- `src/adapters/`：DOM、API、storage 适配层
- `src/config/`：默认值、schema、migration
- `src/shared/`：跨运行时契约、类型、工具
- `manifests/`：manifest 模板
- `scripts/build/`：构建辅助脚本

这一步只完成架构搭建和最小占位实现，没有开始迁移旧功能。

### 致谢

感谢所有对此插件有过贡献的开发者！如果这个扩展对你有帮助，欢迎在 Gitlab 与 GitHub Star ⭐️ 支持。
