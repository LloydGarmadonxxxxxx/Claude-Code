# 夜行剑客 · ASCII Night Ronin

3D 场景实时转成彩色 ASCII 字符的生存砍怪网页游戏（手机横屏 / 电脑）。
线上地址：https://lloydgarmadonxxxxxx.github.io/Claude-Code/night-ronin/

这个文件夹不需要构建：`index.html` 通过 importmap 加载 `vendor/three.module.js`（three.js r128），游戏代码都在 `src/main.js`。
Vite 构建时 `public/` 里的文件会原样复制到 `dist/night-ronin/`。

本地预览：在本文件夹运行 `python3 -m http.server`，打开 http://localhost:8000/

调试：控制台里的 `window.__debug` 提供 `advance(秒)`、`setTime(秒)`、`learnAll()`、`stats()`。
