# 简约起始页 · Minimal Start Page

一款优雅简约的浏览器起始页，作为 **Edge / Chrome 新标签页扩展**使用：居中大搜索栏（可切换 百度 / Google / 豆包 / DeepSeek），下方圆形图标快捷收藏栏，收藏可增删改，全部本地存储。

![icon](icons/icon128.png)

## 功能

- 🔍 **多引擎搜索**：百度、Google、网页版豆包、网页版 DeepSeek，点击搜索栏左侧圆钮弹出菜单切换，`Alt+1~4` 快捷键
- ⭐ **快捷收藏**：圆形渐变图标 + 自定义名称，悬停删除、右键编辑、末尾"＋"添加，超过 10 个自动换行
- 🕐 大号细体时钟与日期，柔和渐变背景，逐段入场动画
- ⚡ 内置「DeepSeek Harness」收藏（点击自动启动本地服务，见下文说明）
- 💾 收藏与引擎偏好保存在 localStorage，刷新不丢失

## 安装（Edge / Chrome）

1. 打开 `edge://extensions`（Chrome 为 `chrome://extensions`）
2. 打开右上角「开发人员模式」
3. 点击「加载解压缩的扩展」，选择本仓库目录（根目录，含 `manifest.json`）
4. 新建标签页即显示起始页

## 使用

| 操作 | 方式 |
| --- | --- |
| 搜索 | 输入关键词按回车（`Ctrl/Cmd+回车` 新标签页打开） |
| 切换引擎 | 点击搜索栏左侧圆钮弹出菜单，或 `Alt+1~4` |
| 添加收藏 | 点击收藏栏末尾的"＋" |
| 删除收藏 | 悬停收藏项，点右上角"×" |
| 编辑收藏 | 右键收藏项 |

## 自定义 / 开发

起始页的**唯一源码**是单文件 `src/startpage.html`（所有 CSS/JS 内联，可直接双击在浏览器打开预览）。

修改源码后，运行构建脚本生成扩展文件：

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File .\build.ps1
```

然后到扩展管理页点击该扩展的「重新加载」。

> MV3 扩展页面禁止内联脚本（CSP），因此 `build.ps1` 会把内联 `<style>/<script>` 拆分为根目录的 `startpage.css` / `startpage.js`。

## 关于 DeepSeek Harness 收藏

收藏栏第一项「DeepSeek Harness」是指向 `http://127.0.0.1:3080` 的普通链接，其图标右上角的圆点为**运行状态指示灯**（绿 = 运行中，灰 = 未运行，每 8 秒自动探测一次端口）。指示灯仅作状态展示，不负责启动服务；服务需自行运行 `npx @deepseek-ai/dsh web`。

## 许可

[MIT](LICENSE)
