# 7FA4 用户脚本

本仓库提供一个适用于 7FA4 在线评测系统的 Tampermonkey 用户脚本，旨在改进界面显示并提供便捷功能。

最新版本添加了 submission guard 功能，防止你误开三帮/二帮。

## 开发

守护相关代码已模块化并位于 `src/guard/` 目录：
- `modal.js`：提示模态框
- `needWarn.js`：判断是否需要提醒
- `interceptor.js`：拦截提交记录链接

使用 [Rollup](https://rollupjs.org/) 打包最终脚本：

```bash
npm install
npm run build
```

构建后生成的用户脚本位于项目根目录的 `main.js`。
