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

1. Click `选歌识别` or `分数识别` in the page.
2. The browser sends `POST /api/recognize` to the local Python server.
3. The server tries to capture one frame from camera index `0`, then `1`.
4. The server returns JSON shaped like a real recognition result.
5. The frontend uses that JSON to drive the existing HUD animation.

The recognition step is intentionally still a mock after capture. It is now isolated in
`recognize_song()` and `recognize_score()` inside `server.py`, so template matching,
OCR, or a model-based recognizer can replace those functions without changing the
frontend protocol.

If OpenCV is not installed or no camera is available, the API still returns mock data
and reports the capture failure reason in the control panel. That keeps the frontend
chain testable while camera setup is being fixed.

## API

```http
POST /api/recognize
Content-Type: application/json

{"kind":"song","slot":0}
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

