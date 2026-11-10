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

收藏栏第一项「DeepSeek Harness」指向 `dsh://start`，由本机注册的 `dsh://` 协议处理器负责启动/打开。图标右上角圆点是**运行状态指示灯**（绿 = 3080 在监听，灰 = 未监听，每 8 秒探测一次）。

### 首次安装（每台机器一次，当前用户级，无需管理员）

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-dsh-protocol.ps1
```

脚本注册 `HKCU\Software\Classes\dsh`，处理程序指向本仓库的 `scripts\start-dsh.ps1`。浏览器第一次点击收藏时会询问是否打开外部应用，勾选「始终允许」后不再询问。卸载：同一命令加 `-Uninstall`。

> 协议里记录的是绝对路径，本仓库改名或移动后需重新运行一次安装脚本。

### 点击收藏时发生什么

| 3080 端口 | 行为 |
| --- | --- |
| 已在监听，且上次由本脚本启动 | 直接打开 `server.json` 里缓存的带 token 认证 URL |
| 已在监听，但由其他方式启动 | 打开 `http://127.0.0.1:3080/`（会话 Cookie 有效期 30 天） |
| 未监听 | 隐藏窗口后台启动 `dsh web --port 3080 --no-open`，从输出中捕获 `dsh web: http://127.0.0.1:3080/?token=…` 并打开 |

为什么不直接在页面里打开：认证 URL 的 token 是**进程级**的，只有 `dsh web` 启动时打印，网页脚本既不能启动进程也拿不到它；而且会话 Cookie 是 `SameSite=Strict`，从扩展页面跨站跳到 3080 不会带上 Cookie。由协议处理器（系统级导航）打开才既拿得到 token，又能带上 Cookie。

### 日志与状态（`%LOCALAPPDATA%\DeepSeekHarness\`）

- `start.log` — 每次点击的判断与结果（排查优先看这个）
- `harness.log` / `harness.error.log` — 服务 stdout / stderr
- `server.json` — 由本脚本启动的服务的 pid、端口与认证 URL

`dsh` 的解析顺序：`DSH_LAUNCH_COMMAND` 环境变量 → PATH 上的 `dsh.cmd` / `dsh.exe` → npx 缓存中最新的 `@deepseek-ai\dsh\lib\bin.js` → `npx -y @deepseek-ai/dsh`。不注册协议时，点击收藏只会让浏览器停在 `dsh://start` 空白页。

## 许可

[MIT](LICENSE)
