# Better Names for 7FA4

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-2026.07.01-green.svg)
![Manifest](https://img.shields.io/badge/manifest-v3-brightgreen.svg)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-orange.svg)

Better Names for 7FA4 是一款面向 7FA4 在线评测系统的浏览器扩展。它在保留原站使用方式的基础上，补充用户昵称与颜色映射、界面增强、计划与复盘渲染、聊天室、外站题提交等功能，让 7FA4 的日常使用更顺手。

## 主要功能

- 用户显示增强：按内置数据库显示昵称与颜色，支持隐藏头像、自定义用户颜色和面板主题色。
- 题目与作业体验优化：默认隐藏已提交作业、隐藏已通过/已跳过题目、快捷跳过、题目自动更新、网页标题优化。
- 计划相关工具：批量加入个人计划、个人计划日期导航、长计划页自动定位到当天。
- Markdown / LaTeX 渲染：支持计划、复盘本和聊天室消息中的 Markdown、LaTeX、代码高亮，并对可渲染内容进行清理。
- 7FA4 聊天室：支持私聊/群聊、会话列表、消息缓存、新消息提示、预览开关和历史消息加载。
- 比赛与复盘辅助：比赛结束后可补充相关文件下载按钮，并提供复盘入口。
- 外站题提交器：内置 7FA4 外站题提交器，便于从外站提交记录发送到 7FA4 指定题目。
- 更新与反馈：面板内提供版本检查、售后反馈和加入 Better Names 计划入口。

## 安装使用

推荐从 Release 下载已经打包好的扩展压缩包：

- GitHub Releases：<https://github.com/DestinyleSnowy/Better-Names-for-7FA4/releases>
- GitLab Releases：<http://jx.7fa4.cn:9080/yx/better-names-for-7fa4>

下载 `Better-Names-for-7FA4-<version>.zip` 后解压，然后在浏览器中加载解压后的 `Better-Names-for-7FA4` 目录。

### Chromium / Edge

1. 打开 `chrome://extensions` 或 `edge://extensions`。
2. 开启右上角的“开发者模式”。
3. 点击“加载已解压的扩展程序”。
4. 选择解压后的 `Better-Names-for-7FA4` 目录。
5. 建议把扩展固定到浏览器工具栏，便于使用提交器弹窗。

### Firefox

1. 打开 `about:debugging#/runtime/this-firefox`。
2. 点击“临时载入附加组件”。
3. 选择 `Better-Names-for-7FA4/manifest.json`。

> Firefox 临时载入会在浏览器重启后失效。正式使用仍建议优先使用 Release 包与支持持久安装的浏览器环境。

## 更新

发布版本会同步到 GitHub 与 GitLab。插件面板会尝试检查新版本；如果检查失败，可手动前往 Release 页面下载最新版并覆盖本地解压目录，再在扩展管理页点击刷新。

建议保持最新版本，尤其是包含安全修复、数据库更新和 7FA4 页面兼容性调整的版本。

## 开发

本仓库主体是原生 JavaScript 的 Manifest V3 扩展，不需要前端构建工具即可加载调试。

```bash
git clone https://github.com/DestinyleSnowy/Better-Names-for-7FA4.git
cd Better-Names-for-7FA4
```

如果需要拉取或更新提交器依赖：

```bash
python -m pip install requests
python build.py build
```

常用构建脚本命令：

```bash
python build.py build   # 构建所有提交器依赖
python build.py clean   # 清理提交器依赖
python build.py test    # 检查提交器配置
```

本地调试时，在浏览器扩展管理页加载仓库中的 `Better-Names-for-7FA4` 目录。修改脚本或样式后，通常需要在扩展管理页刷新扩展，并刷新 7FA4 页面。

## 目录结构

```text
.
├── Better-Names-for-7FA4/        # 浏览器扩展源码
│   ├── background.js             # 后台逻辑
│   ├── content/                  # 注入页面的脚本、面板与第三方库
│   ├── data/                     # 用户映射与特殊用户数据
│   ├── icons/                    # 扩展图标
│   ├── submitter/                # 外站题提交器及其依赖
│   └── manifest.json             # 扩展清单
├── database/                     # 用户数据库维护脚本
├── build.py                      # 提交器依赖构建脚本
├── CHANGELOG.md                  # 版本变更记录
└── README.md
```

## 反馈与贡献

非开发类反馈可以在 GitLab 提 issue，或在插件面板中使用售后反馈入口。开发相关问题、代码贡献和 Pull Request 建议优先前往 GitHub。提交代码前请阅读 [贡献指南](CONTRIBUTING.md)。

提交问题时，请尽量附上：

- 插件版本与浏览器版本。
- 出现问题的 7FA4 页面地址或页面类型。
- 可复现步骤、预期表现和实际表现。
- 控制台报错截图或文本。

## 致谢

感谢所有参与开发、测试、反馈和维护 Better Names for 7FA4 的贡献者。

## 许可证

本项目基于 [MIT License](LICENSE) 开源。
