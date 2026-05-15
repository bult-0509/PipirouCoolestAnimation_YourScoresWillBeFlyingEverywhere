# bult直播间可能会用到的比较帅的推课题视觉效果增强工具！

qwq我真的不会写代码，前端完全由Gemini 3.1 Pro实现，后端完全由Claude Opus 4.6实现！
idea by @bult_0509 https://space.bilibili.com/291942700
cowork with @雪跡 https://space.bilibili.com/405061756

~~关注bult_0509谢谢喵关注雪迹谢谢喵关注bult_0509谢谢喵关注雪迹谢谢喵关注bult_0509谢谢喵关注雪迹谢谢喵关注bult_0509谢谢喵关注雪迹谢谢喵关注bult_0509谢谢喵关注雪迹谢谢喵关注bult_0509谢谢喵关注雪迹谢谢喵关注bult_0509谢谢喵关注雪迹谢谢喵关注bult_0509谢谢喵关注雪迹谢谢喵关注bult_0509谢谢喵关注雪迹谢谢喵关注bult_0509谢谢喵关注雪迹谢谢喵关注bult_0509谢谢喵关注雪迹谢谢喵关注bult_0509谢谢喵关注雪迹谢谢喵关注bult_0509谢谢喵关注雪迹谢谢喵关注bult_0509谢谢喵关注雪迹谢谢喵关注bult_0509谢谢喵关注雪迹谢谢喵关注bult_0509谢谢喵关注雪迹谢谢喵关注bult_0509谢谢喵关注雪迹谢谢喵关注bult_0509谢谢喵关注雪迹谢谢喵关注bult_0509谢谢喵关注雪迹谢谢喵关注bult_0509谢谢喵关注雪迹谢谢喵关注bult_0509谢谢喵关注雪迹谢谢喵关注bult_0509谢谢喵关注雪迹谢谢喵！！！

我设计该工具的初衷是增强直播观感，运用机器学习相关方法识别文本，实现强交互性动效，就像是Ae里时时渲染出来的一样，事实证明，做到这一点并不太难（
#### **我对动画基本元素有一些基本定义，以方便读者理解后续动画操作：**
- **栏 (Bar)**：右侧半隐藏的倾斜平行四边形容器。
- **信息 (Info)**：机器识别出的曲绘、曲名、难度、定数、分数及计算出的 Rating。
- **信息识取 (Extraction)**：原位生成发光元素并缓动放大至正中央。
- **信息收录 (Collection)**：信息从中央缩小移动，被伸出的"栏"接住的同步过程。
- **栏牵连 (Implication)**：信息被收录后，与"栏"同步缓动位移。

排版、字体、元素设计等美工元素均参考Phigros官方！

---

## 核心交互流程规范

**交互界面包含四个按钮，分别实现不同功能，最大简化并能实现有关的所有需求**

### 🔘 按钮一：选歌识别

**场景：** 选歌界面。

1. **识别：** 提取左侧曲名/难度，在后台匹配本地高清图与定数。
2. **识取：** 曲绘原位重合生成、发光，放大至画面正中央。
3. **展示：** 曲绘上移，下方淡入排版文本：`[难度标识] [下取整定数] [曲名]`。
4. **收录与缩回：** 停留 1 秒后，第 $x$ 个"栏"伸出接住这些信息；随后执行栏牵连缩回至右侧半隐藏状态。

### 🔘 按钮二：分数识别

**场景：** 单曲结算右上角。

1. **识别：** 提取纯数字文本及 Bounding Box。
2. **识取：** 数字原位重合生成、发光、放大至正中央并变为纯白色。
3. **收录与缩回：** 第 $x$ 个"栏"伸出接住数字；执行栏牵连缩回至右侧。变量 $x += 1$。

### 🔘 按钮三：常规重置 (打歌中断)

**场景：** 轮次中途放弃。

1. **伸出与清空：** 1、2、3 号"栏"依次伸出。所有承载的信息不透明度降为 0 并销毁。
2. **复位：** 空置的"栏"依次缩回初始状态。变量 $x$ 归零。

### 🔘 按钮四：结算展板

**场景：** 连续三首歌完毕。

1. **全局进场：** 1、2、3 号"栏"携信息依次执行栏牵连伸出，向中央移动并列**栏显示**。
2. **模式切换（点击切换）：**
    - **分数模式 (默认)**：栏内保留大字号分数。右下角淡出单行：`总分数：XXXXXXX`。
    - **Rating 模式**：触发时，栏内分数通过数字滚动切换为单曲 Rating。右下角滚动切换为：`总定数：XX.XX`。

---

## 新增退出动效规范

### 🔘 结算后重置

**场景：** 结算展示完毕，清空面板准备新轮次。

1. **加速离场：** 处于中央放大状态的 1、2、3 号栏携内部信息，依次执行**加速缓动 (Ease-In)**，向左快速移出屏幕可视区域。
2. **幕后变换：** 完全移出画面后，瞬间销毁栏内承载的数值与图文信息；将"栏"的尺寸、不透明度瞬间还原为初始的侧栏参数，并将绝对坐标平移至屏幕最右侧可视区域之外。
3. **侧栏归位：** 还原后的三个"栏"依次从屏幕右侧外部向左滑入，停靠在初始的半隐藏侧栏位置。变量 $x$ 归零。

---

## 核心技术要求

### 精准识别与定位

- 计算机需准确识别分数所在位置和大小
- 文字和图像必须完全重合，而非简单从正中央生成
- 栏右侧在动画过程中不得露出

### 动画效果规范

- **栏伸出**：平行四边形缓入缓出左移
- **栏缩回**：平行四边形缓入缓出右移
- **栏显示**：栏的三种基本动画效果
- **信息识取**：原位发光显示并缓动放大到正中央
- **信息收录**：信息与栏同步运动的动画
- **栏牵连**：栏和信息同步运动的过程

### 交互键定义

1. **按钮一**：选歌识别
2. **按钮二**：分数识别
3. **按钮三**：重置
4. **按钮四**：结算

---

## 计算公式规范

### Rating 计算公式

```
rating = ((score - 550000) / 450000)^2 * 定数
```

**参数要求：**

- 定数：歌曲对应难度，精确到小数点后一位
- Rating：精确到小数点后两位，下取整
- 最终结果：三个单曲 Rating 相加

---

## 文件资源管理

**字体文件：** 游戏内字体已经置于文件夹中
**曲目资源：** 需在文件夹中预先储存曲绘、谱面相关信息

---

## 版本信息

**当前版本：**  alpha 0.1.0
**最后更新：** 2026年5月12日
缺失后端代码和游戏相关信息（可能不太能公开，嗯。）
目前上传的前端代码存在大量问题，如动画曲线错误、与预期不符等极多遗留问题，后续会不断更新代码并上传识别模块代码等以完善该工具。

---

# Phigros HUD Camera Bridge

This branch wires the existing HUD animation to a local camera capture API.

## Run

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python server.py
```

Open:

```text
http://127.0.0.1:8765/
```

## Current Flow

1. Open the page and pick a camera from the `摄像头` selector, or leave it on
   `自动选择`.
2. Click `选歌识别` or `分数识别` in the page.
3. The browser sends `POST /api/recognize` to the local Python server with the
   selected `cameraIndex`.
4. The server captures one frame from that camera. In auto mode it tries the
   selected platform's first few camera indices.
5. The server returns JSON shaped like a real recognition result.
6. The frontend uses that JSON to drive the existing HUD animation.

The recognition step is intentionally still a mock after capture. It is now isolated in
`recognize_song()` and `recognize_score()` inside `server.py`, so template matching,
OCR, or a model-based recognizer can replace those functions without changing the
frontend protocol.

If OpenCV is not installed or no camera is available, the API still returns mock data
and reports the capture failure reason in the control panel. That keeps the frontend
chain testable while camera setup is being fixed.

## Camera Selection

The frontend calls:

```http
GET /api/cameras
```

The server scans camera indices from `0` to `CAMERA_SCAN_LIMIT - 1`. The default
limit is `6`, and it can be changed when starting the server:

```bash
CAMERA_SCAN_LIMIT=10 python server.py
```

OpenCV backend selection is platform-aware:

- Windows: DirectShow
- macOS: AVFoundation
- Linux: V4L2
- Other systems: OpenCV default backend

If no camera is listed, check OS camera permissions, whether iVCam or another
virtual camera is running, and whether another application is already holding the
camera.

## Test Images

`Choose.jpg` and `Score.jpg` are committed as sample inputs from the current
`master` branch. The frontend exposes a `测试输入` selector:

- `关闭`: use the selected camera.
- `按按钮自动选择`: use `Choose.jpg` for `选歌识别` and `Score.jpg` for `分数识别`.
- `Choose.jpg` or `Score.jpg`: force one sample image for every recognition call.

The sample image is copied to `debug/latest_frame.jpg` and returned through the
same `capture.frameUrl` field as a real camera frame. This keeps the frontend,
backend, and animation protocol testable even when no camera is available.

## Song Cover Normalization

For `选歌识别`, the backend first tries to detect the song art quadrilateral from
the captured selection frame with OpenCV edge/line detection. If that detection
fails, it falls back to the current fixed Phigros select-screen ratio. The crop is
then normalized into the HUD's clean parallelogram shape and written to:

```text
debug/latest_cover.png
```

The output is not a rectangle: it is a transparent PNG whose visible area is a
parallelogram matching the frontend HUD cover/score-frame angle. This removes the
camera perspective distortion while preserving the Phigros-style slanted shape.
The frontend receives this image as `song.coverImage`, plus the original-frame
`coverCrop.sourceQuad` and `coverCrop.sourceBBox`. During animation the browser
shows the captured source frame, clips the art in-place from the detected source
quadrilateral, fades that into the normalized parallelogram at the same origin,
then flies it to the center and into the HUD slot with eased motion.

The future cover-library recognizer should replace `match_cover_from_library()`
in `server.py`. Until that library exists, the server returns mock song metadata
plus `coverMatch.matched: false`.

## API

```http
POST /api/recognize
Content-Type: application/json

{"kind":"song","slot":0,"cameraIndex":0,"sampleFrame":"auto"}
```

Response:

```json
{
  "ok": true,
  "kind": "song",
  "slot": 0,
  "capture": {
    "ok": true,
    "cameraIndex": 0,
    "frameUrl": "/debug/latest_frame.jpg?t=..."
  },
  "song": {
    "diff": "IN",
    "constant": "15.8",
    "name": "DESTRUCTION 3,2,1",
    "score": "09954320",
    "rating": "15.65",
    "coverImage": "/debug/latest_cover.png?t=...",
    "coverCrop": {
      "detected": true,
      "detectionMethod": "auto-hough-lines",
      "sourceBBox": {"x": 1903, "y": 952, "width": 1274, "height": 737}
    }
  },
  "recognitionMode": "mock-after-capture"
}
```
