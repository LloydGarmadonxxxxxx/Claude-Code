# Merry Christmas · 3D 粒子圣诞树

由 2 万到 5 万颗 GPU 粒子组成的 3D 圣诞树，用 Three.js + GLSL 实现，并用 MediaPipe Hands 做摄像头手势控制。

## 功能

| 状态 | 效果 | 触发方式 |
| --- | --- | --- |
| 1 聚合 | 粒子从屏幕四周飞向中心，组成发光圣诞树 | 开场自动 / 「聚合」按钮 / 键盘 1 |
| 2 爆散 | 圣诞树向四周炸开，带运动拖尾和闪光 | 张开手掌 / 双手分开 / 「爆散」 / 2 |
| 3 星云 | 爆散后自动形成倾斜旋转的 3D 粒子星云 | 爆散后自动 / 「星云」 / 3 |
| 4 重新聚合 | 粒子从四周回到树形 | 握拳 / 双手靠近 / 4 |
| 5 中心展示 | 金色粒子边框 + 中央照片或祝福卡片 | 拇指食指捏合 / 「卡片」 / 5 |
| 6 节日文字 | Merry Christmas / 圣诞快乐 金色逐字淡入 | 「祝福」 / 6 |

其他手势：手掌张开后缓慢移动，粒子会跟着手走；手掌左右挥动可以控制旋转；双手之间的距离会实时控制整体缩放。

不开摄像头也能操作：拖动旋转、滚轮或双指缩放、双击（或空格）切换爆散/聚合。点底部的图片图标可以把卡片换成自己的照片，照片只在本机处理。

## 本地运行

需要 Node.js 18 及以上版本。

```bash
npm install
npm run dev        # 打开终端里显示的地址，例如 http://localhost:5173
npm run build      # 生产构建，输出到 dist/
npm run preview    # 本地预览构建结果
```

摄像头只能在 **HTTPS** 或 **localhost** 下使用。手机测试请用部署好的 HTTPS 网址。（`npm run dev` 的局域网 IP 地址是 http，手机浏览器会拦截摄像头。）

### 免构建运行

`index.html` 里有一个 importmap，会从 jsDelivr CDN 加载 three 和 MediaPipe。所以整个文件夹不经过 Vite，直接放到任意静态服务器上也能运行：

```bash
npx serve .        # 或 python3 -m http.server
```

## 部署成可以分享的网址（免费，任选一种）

**A. GitHub Pages，免构建，最简单**
1. 在 GitHub 新建一个公开仓库，例如 `merry-christmas`。
2. 点 “uploading an existing file”，把本项目里的所有文件拖进去（不包括 `node_modules`、`dist`），然后提交。
3. 打开 Settings → Pages → Build and deployment，Source 选 “Deploy from a branch”，Branch 选 `main` / `(root)`，然后保存。
4. 大约 1 分钟后，网址会是 `https://你的用户名.github.io/merry-christmas/`

**B. GitHub Pages + 自动构建**
用 git 推送整个项目（包括 `.github/workflows/deploy.yml`），然后在 Settings → Pages 里把 Source 选成 “GitHub Actions”。之后每次推送都会自动执行 `npm install && npm run build` 并发布 `dist/`。

**C. Vercel / Netlify**
导入仓库即可。Build command 填 `npm run build`，Output 目录填 `dist`。

以上方式都是 HTTPS，所以手机和电脑都能打开摄像头，用手势控制。

## 项目结构

```
index.html                 页面结构、importmap、字体
favicon.svg
vite.config.js             base: './'，可以部署在任意子路径
package.json
.github/workflows/deploy.yml  GitHub Pages 自动构建部署
src/
  main.js        渲染器、后期处理（Bloom / 拖尾 / 色散 / 暗角 / 颗粒）、状态机、交互、自适应画质
  particles.js   粒子数据生成（树 / 爆散 / 星云 / 边框 四套目标）、连线、拖尾彗星、星尘、卡片纹理
  shaders.js     全部 GLSL：GPU 粒子形变、景深、闪烁、星芒、拖尾、调色
  gesture.js     MediaPipe HandLandmarker、手势分类、去抖与冷却
  config.js      粒子数量分级、颜色、手势阈值、演示时间线
  style.css      界面样式与响应式布局
```

## 技术要点

- **GPU 粒子**：每颗粒子在 BufferAttribute 里保存 4 个目标位置。CPU 每帧只更新 4 个权重，混合、漂浮、弧线飞行都在顶点着色器里完成，每帧不会创建新对象。
- **错落感**：每颗粒子都有自己的缓动指数，所以聚合和爆散时粒子是先后到达的。
- **InstancedBufferGeometry**：带拖尾的光点每颗是一个实例，拖尾由着色器沿时间回溯计算得出。
- **自适应性能**：先按设备选择 1.6 万到 5 万颗粒子。运行时如果帧率低于 42，会逐步减少绘制数量和像素比；帧率稳定后再逐步回升。也可以手动指定：`?quality=ultra|high|mobile|low` 或 `?count=40000`。
- **手势稳定性**：使用 3D 世界坐标做分类，手离摄像头远近不影响判断；手势要持续 170ms 才确认，捏合判定有滞回阈值，离散动作有 1.1 秒冷却。
- 手势模型（`hand_landmarker.task`）和 WASM 运行时从 Google / jsDelivr CDN 加载，所以第一次开启手势需要联网。
