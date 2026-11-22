# Blender 脚本

这里存放用代码驱动 Blender 生成 3D 图片和动画的脚本。这些文件不会影响网站。

## 在新对话里接着用

把下面这段发给 Claude：

> 从我的 GitHub 仓库 LloydGarmadonxxxxxx/Claude-Code 拿出 `blender/` 文件夹里的脚本，在云端装好 Blender（`pip install bpy`），然后接着做。

## 自己运行

**云端或任何装了 Python 的电脑：**

```bash
pip install bpy            # Blender 的 Python 版，约 1 分钟
python3 scripts/test_render.py
```

**在电脑上的 Blender 里：**

打开 Blender → 上方切到 **Scripting** → 打开脚本 → 点 ▶ 运行。

## 脚本列表

| 脚本 | 内容 |
|---|---|
| `scripts/test_render.py` | 测试渲染：一个金色金属圆环，960×540，Cycles 引擎 |
| `scripts/snow_assets.py` | 「初雪」网页的模型：3 种带积雪松树、圣诞树、原木小屋、路灯、栅栏，导出 `snow_assets.glb` 和内嵌版 `snow_assets.gltf.json`。加 `--preview` 顺便渲染一张预览图 |

## 备注

- 云端没有显卡，只能用 CPU 渲染，比较慢（测试图约 37 秒）。
- 在你自己电脑的 Blender 里运行时，可以在渲染设置里改用 GPU，会快很多。
- 渲染结果会保存在运行脚本时所在的文件夹。
