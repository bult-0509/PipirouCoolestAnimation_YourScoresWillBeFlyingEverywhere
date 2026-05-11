import argparse
import json
import os
import platform
import time
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

try:
    import cv2
except ImportError:
    cv2 = None


ROOT_DIR = Path(__file__).resolve().parent
DEBUG_DIR = ROOT_DIR / "debug"
LATEST_FRAME = DEBUG_DIR / "latest_frame.jpg"

MOCK_SONGS = [
    {
        "diff": "IN",
        "constant": "15.8",
        "name": "DESTRUCTION 3,2,1",
        "score": "09954320",
        "rating": "15.65",
    },
    {
        "diff": "AT",
        "constant": "16.4",
        "name": "Igrape",
        "score": "09821000",
        "rating": "15.98",
    },
    {
        "diff": "HD",
        "constant": "11.5",
        "name": "Lyrith",
        "score": "10000000",
        "rating": "11.50",
    },
]


def _json_response(handler, status, payload):
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Cache-Control", "no-store")
    handler.end_headers()
    handler.wfile.write(body)


def _read_json(handler):
    length = int(handler.headers.get("Content-Length", "0") or "0")
    if length == 0:
        return {}
    raw = handler.rfile.read(length)
    return json.loads(raw.decode("utf-8"))


def _camera_backend():
    if platform.system() == "Windows" and cv2 is not None:
        return cv2.CAP_DSHOW
    return 0


def capture_frame(camera_indices):
    if cv2 is None:
        return {
            "ok": False,
            "reason": "opencv-python is not installed",
            "frameUrl": None,
            "width": None,
            "height": None,
        }

    DEBUG_DIR.mkdir(exist_ok=True)
    backend = _camera_backend()

    for index in camera_indices:
        cap = cv2.VideoCapture(index, backend)
        if not cap.isOpened():
            cap.release()
            continue

        frame = None
        ok = False
        for _ in range(5):
            ok, frame = cap.read()
            if ok and frame is not None:
                break
            time.sleep(0.03)

        cap.release()

        if ok and frame is not None:
            cv2.imwrite(str(LATEST_FRAME), frame)
            height, width = frame.shape[:2]
            return {
                "ok": True,
                "reason": None,
                "cameraIndex": index,
                "frameUrl": f"/debug/latest_frame.jpg?t={int(time.time() * 1000)}",
                "width": width,
                "height": height,
            }

    return {
        "ok": False,
        "reason": f"no camera opened from indices {camera_indices}",
        "frameUrl": None,
        "width": None,
        "height": None,
    }


def recognize_song(slot, capture):
    song = MOCK_SONGS[slot % len(MOCK_SONGS)].copy()
    song["coverImage"] = capture.get("frameUrl")
    return song


def recognize_score(slot, capture):
    song = MOCK_SONGS[slot % len(MOCK_SONGS)]
    return {
        "score": song["score"],
        "rating": song["rating"],
        "frameUrl": capture.get("frameUrl"),
    }


class AppHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT_DIR), **kwargs)

    def log_message(self, fmt, *args):
        print("%s - %s" % (self.address_string(), fmt % args))

    def do_GET(self):
        if self.path == "/api/health":
            _json_response(
                self,
                HTTPStatus.OK,
                {
                    "ok": True,
                    "opencv": cv2 is not None,
                    "cwd": str(ROOT_DIR),
                },
            )
            return
        super().do_GET()

    def do_POST(self):
        if self.path != "/api/recognize":
            _json_response(self, HTTPStatus.NOT_FOUND, {"ok": False, "error": "not found"})
            return

        try:
            body = _read_json(self)
            kind = body.get("kind")
            slot = int(body.get("slot", 0))
            indices = body.get("cameraIndices") or [0, 1]
            camera_indices = [int(value) for value in indices]

            capture = capture_frame(camera_indices)

            if kind == "song":
                payload = {
                    "ok": True,
                    "kind": "song",
                    "slot": slot,
                    "capture": capture,
                    "song": recognize_song(slot, capture),
                    "recognitionMode": "mock-after-capture",
                }
            elif kind == "score":
                payload = {
                    "ok": True,
                    "kind": "score",
                    "slot": slot,
                    "capture": capture,
                    "score": recognize_score(slot, capture),
                    "recognitionMode": "mock-after-capture",
                }
            else:
                payload = {"ok": False, "error": "kind must be song or score"}

            _json_response(self, HTTPStatus.OK, payload)
        except Exception as exc:
            _json_response(
                self,
                HTTPStatus.INTERNAL_SERVER_ERROR,
                {"ok": False, "error": str(exc)},
            )


def main():
    parser = argparse.ArgumentParser(description="Run the local Phigros HUD bridge.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", default=int(os.environ.get("PORT", "8765")), type=int)
    args = parser.parse_args()

    server = ThreadingHTTPServer((args.host, args.port), AppHandler)
    print(f"Serving HUD and API at http://{args.host}:{args.port}/")
    print("API: POST /api/recognize {kind: song|score, slot: number}")
    if cv2 is None:
        print("OpenCV is not installed; API will use mock recognition without camera frames.")
    server.serve_forever()


if __name__ == "__main__":
    main()
