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

## API

```http
POST /api/recognize
Content-Type: application/json

{"kind":"song","slot":0,"cameraIndex":0}
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
    "coverImage": "/debug/latest_frame.jpg?t=..."
  },
  "recognitionMode": "mock-after-capture"
}
```
