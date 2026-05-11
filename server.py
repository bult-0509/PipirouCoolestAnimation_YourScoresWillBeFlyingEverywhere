import argparse
import json
import os
import platform
import shutil
import time
from http import HTTPStatus
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

try:
    import cv2
    import numpy as np
except ImportError:
    cv2 = None
    np = None


ROOT_DIR = Path(__file__).resolve().parent
DEBUG_DIR = ROOT_DIR / "debug"
LATEST_FRAME = DEBUG_DIR / "latest_frame.jpg"
LATEST_COVER = DEBUG_DIR / "latest_cover.png"
DEFAULT_CAMERA_SCAN_LIMIT = int(os.environ.get("CAMERA_SCAN_LIMIT", "6"))
NORMALIZED_COVER_WIDTH = 1280
NORMALIZED_COVER_HEIGHT = 720
COVER_SKEW_RATIO = 19.3 / 128
SAMPLE_FRAMES = {
    "song": {
        "label": "Choose.jpg",
        "path": ROOT_DIR / "Choose.jpg",
    },
    "score": {
        "label": "Score.jpg",
        "path": ROOT_DIR / "Score.jpg",
    },
}

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
    if cv2 is None:
        return 0

    system = platform.system()
    if system == "Windows":
        return cv2.CAP_DSHOW
    if system == "Darwin":
        return cv2.CAP_AVFOUNDATION
    if system == "Linux":
        return cv2.CAP_V4L2
    return 0


def _camera_backend_name():
    system = platform.system()
    if system == "Windows":
        return "DirectShow"
    if system == "Darwin":
        return "AVFoundation"
    if system == "Linux":
        return "V4L2"
    return "OpenCV default"


def _open_capture(index):
    backend = _camera_backend()
    if backend:
        return cv2.VideoCapture(index, backend)
    return cv2.VideoCapture(index)


def _camera_candidates(selected_index=None):
    candidates = []
    if selected_index is not None:
        candidates.append(selected_index)
    candidates.extend(range(DEFAULT_CAMERA_SCAN_LIMIT))

    unique = []
    seen = set()
    for index in candidates:
        value = int(index)
        if value not in seen:
            seen.add(value)
            unique.append(value)
    return unique


def list_cameras(limit=DEFAULT_CAMERA_SCAN_LIMIT):
    if cv2 is None:
        return {
            "ok": False,
            "opencv": False,
            "platform": platform.system(),
            "backend": _camera_backend_name(),
            "cameras": [],
            "reason": "opencv-python is not installed",
        }

    cameras = []
    for index in range(max(0, int(limit))):
        cap = _open_capture(index)
        opened = cap.isOpened()

        width = None
        height = None
        if opened:
            width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0) or None
            height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0) or None

        cap.release()

        if opened:
            label = f"Camera {index}"
            if width and height:
                label = f"{label} ({width}x{height})"
            cameras.append(
                {
                    "index": index,
                    "label": label,
                    "width": width,
                    "height": height,
                }
            )

    return {
        "ok": True,
        "opencv": True,
        "platform": platform.system(),
        "backend": _camera_backend_name(),
        "cameras": cameras,
        "scanLimit": int(limit),
    }


def list_sample_frames():
    return {
        "ok": True,
        "samples": [
            {
                "key": key,
                "label": sample["label"],
                "exists": sample["path"].exists(),
                "url": f"/{sample['path'].name}" if sample["path"].exists() else None,
            }
            for key, sample in SAMPLE_FRAMES.items()
        ],
    }


def _sample_key_for(kind, requested_sample):
    if requested_sample in SAMPLE_FRAMES:
        return requested_sample
    if requested_sample == "auto" and kind in SAMPLE_FRAMES:
        return kind
    return None


def capture_sample_frame(sample_key):
    sample = SAMPLE_FRAMES.get(sample_key)
    if sample is None:
        return None

    source_path = sample["path"]
    if not source_path.exists():
        return {
            "ok": False,
            "source": "sample",
            "reason": f"sample frame not found: {source_path.name}",
            "frameUrl": None,
            "width": None,
            "height": None,
            "sampleKey": sample_key,
            "sampleLabel": sample["label"],
        }

    DEBUG_DIR.mkdir(exist_ok=True)
    shutil.copyfile(source_path, LATEST_FRAME)

    width = None
    height = None
    if cv2 is not None:
        frame = cv2.imread(str(LATEST_FRAME))
        if frame is not None:
            height, width = frame.shape[:2]

    return {
        "ok": True,
        "source": "sample",
        "reason": None,
        "cameraIndex": None,
        "frameUrl": f"/debug/latest_frame.jpg?t={int(time.time() * 1000)}",
        "width": width,
        "height": height,
        "sampleKey": sample_key,
        "sampleLabel": sample["label"],
    }


def capture_frame(camera_indices):
    if cv2 is None:
        return {
            "ok": False,
            "source": "camera",
            "reason": "opencv-python is not installed",
            "frameUrl": None,
            "width": None,
            "height": None,
        }

    DEBUG_DIR.mkdir(exist_ok=True)
    for index in camera_indices:
        cap = _open_capture(index)
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
                "source": "camera",
                "reason": None,
                "cameraIndex": index,
                "frameUrl": f"/debug/latest_frame.jpg?t={int(time.time() * 1000)}",
                "width": width,
                "height": height,
            }

    return {
        "ok": False,
        "source": "camera",
        "reason": f"no camera opened from indices {camera_indices}",
        "frameUrl": None,
        "width": None,
        "height": None,
    }


def _selection_cover_quad(width, height):
    # Fallback for the current Phigros select screen cover region.
    return [
        [int(width * 0.492), int(height * 0.329)],
        [int(width * 0.787), int(height * 0.312)],
        [int(width * 0.746), int(height * 0.562)],
        [int(width * 0.446), int(height * 0.562)],
    ]


def _normalize_angle(angle):
    while angle <= -90:
        angle += 180
    while angle > 90:
        angle -= 180
    return angle


def _line_coefficients(segment):
    x1, y1, x2, y2 = segment["x1"], segment["y1"], segment["x2"], segment["y2"]
    a = y1 - y2
    b = x2 - x1
    c = x1 * y2 - x2 * y1
    return a, b, c


def _line_intersection(first, second):
    a1, b1, c1 = _line_coefficients(first)
    a2, b2, c2 = _line_coefficients(second)
    determinant = a1 * b2 - a2 * b1
    if abs(determinant) < 1e-6:
        return None
    x = (b1 * c2 - b2 * c1) / determinant
    y = (c1 * a2 - c2 * a1) / determinant
    return [int(round(x)), int(round(y))]


def _shrink_quad(quad, factor=0.90):
    center = np.mean(np.array(quad, dtype="float32"), axis=0)
    points = []
    for point in quad:
        vector = np.array(point, dtype="float32") - center
        adjusted = center + vector * factor
        points.append([int(round(adjusted[0])), int(round(adjusted[1]))])
    return points


def _clean_detected_cover_quad(quad):
    points = _shrink_quad(quad)
    bbox = _quad_bbox(points)
    right_inset = int(bbox["width"] * 0.08)
    points[1][0] -= right_inset
    points[2][0] -= right_inset
    return points


def _quad_bbox(quad):
    xs = [point[0] for point in quad]
    ys = [point[1] for point in quad]
    left = min(xs)
    top = min(ys)
    right = max(xs)
    bottom = max(ys)
    return {
        "x": int(left),
        "y": int(top),
        "width": int(right - left),
        "height": int(bottom - top),
    }


def _valid_cover_quad(quad, width, height):
    if not quad or len(quad) != 4:
        return False

    margin = max(width, height) * 0.03
    for x, y in quad:
        if x < -margin or x > width + margin or y < -margin or y > height + margin:
            return False

    bbox = _quad_bbox(quad)
    if bbox["width"] < width * 0.20 or bbox["width"] > width * 0.55:
        return False
    if bbox["height"] < height * 0.12 or bbox["height"] > height * 0.40:
        return False

    area = abs(cv2.contourArea(np.array(quad, dtype="float32")))
    return area > width * height * 0.03


def detect_selection_cover_quad(frame):
    height, width = frame.shape[:2]
    fallback = _selection_cover_quad(width, height)

    x0 = int(width * 0.40)
    y0 = int(height * 0.26)
    x1 = int(width * 0.90)
    y1 = int(height * 0.62)
    roi = frame[y0:y1, x0:x1]
    if roi.size == 0:
        return {"quad": fallback, "method": "fallback-fixed-ratio", "detected": False}

    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blurred, 40, 120)
    lines = cv2.HoughLinesP(
        edges,
        1,
        np.pi / 180,
        90,
        minLineLength=int(width * 0.07),
        maxLineGap=35,
    )
    if lines is None:
        return {"quad": fallback, "method": "fallback-no-lines", "detected": False}

    segments = []
    for raw in lines[:, 0]:
        lx1, ly1, lx2, ly2 = [int(value) for value in raw]
        gx1, gy1 = lx1 + x0, ly1 + y0
        gx2, gy2 = lx2 + x0, ly2 + y0
        length = float(np.hypot(gx2 - gx1, gy2 - gy1))
        if length <= 0:
            continue
        angle = _normalize_angle(float(np.degrees(np.arctan2(gy2 - gy1, gx2 - gx1))))
        segments.append(
            {
                "x1": gx1,
                "y1": gy1,
                "x2": gx2,
                "y2": gy2,
                "mx": (gx1 + gx2) / 2,
                "my": (gy1 + gy2) / 2,
                "length": length,
                "angle": angle,
            }
        )

    horizontal = [
        segment
        for segment in segments
        if abs(segment["angle"]) < 8 and segment["length"] > width * 0.08
    ]
    left_edges = [
        segment
        for segment in segments
        if -85 < segment["angle"] < -55
        and segment["length"] > height * 0.08
        and segment["mx"] < width * 0.58
    ]
    right_edges = [
        segment
        for segment in segments
        if -85 < segment["angle"] < -55
        and segment["length"] > height * 0.08
        and segment["mx"] > width * 0.70
    ]

    if not horizontal or not left_edges or not right_edges:
        return {"quad": fallback, "method": "fallback-missing-edges", "detected": False}

    def pick_near(candidates, expected_y):
        return min(candidates, key=lambda segment: abs(segment["my"] - expected_y) - segment["length"] * 0.02)

    top = pick_near(horizontal, height * 0.31)
    bottom = pick_near(horizontal, height * 0.56)
    left = max(left_edges, key=lambda segment: segment["length"])
    right = max(right_edges, key=lambda segment: segment["length"])

    quad = [
        _line_intersection(top, left),
        _line_intersection(top, right),
        _line_intersection(bottom, right),
        _line_intersection(bottom, left),
    ]
    if any(point is None for point in quad):
        return {"quad": fallback, "method": "fallback-parallel-lines", "detected": False}

    quad = _clean_detected_cover_quad(quad)
    if not _valid_cover_quad(quad, width, height):
        return {"quad": fallback, "method": "fallback-invalid-auto-quad", "detected": False}

    return {"quad": quad, "method": "auto-hough-lines", "detected": True}


def extract_song_cover(frame_path=LATEST_FRAME):
    if cv2 is None or not frame_path.exists():
        return None

    frame = cv2.imread(str(frame_path), cv2.IMREAD_COLOR)
    if frame is None:
        return None

    height, width = frame.shape[:2]
    detection = detect_selection_cover_quad(frame)
    quad = detection["quad"]
    bgra = cv2.cvtColor(frame, cv2.COLOR_BGR2BGRA)

    target_width = NORMALIZED_COVER_WIDTH
    target_height = NORMALIZED_COVER_HEIGHT
    skew = int(target_width * COVER_SKEW_RATIO)
    target_quad = [
        [skew, 0],
        [target_width - 1, 0],
        [target_width - 1 - skew, target_height - 1],
        [0, target_height - 1],
    ]

    matrix = cv2.getPerspectiveTransform(
        np.array(quad, dtype="float32"),
        np.array(target_quad, dtype="float32"),
    )
    cover = cv2.warpPerspective(
        bgra,
        matrix,
        (target_width, target_height),
        flags=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=(0, 0, 0, 0),
    )

    mask = np.zeros((target_height, target_width), dtype="uint8")
    cv2.fillConvexPoly(mask, np.array(target_quad, dtype="int32"), 255)
    cover[:, :, 3] = cv2.bitwise_and(cover[:, :, 3], mask)

    DEBUG_DIR.mkdir(exist_ok=True)
    cv2.imwrite(str(LATEST_COVER), cover)

    return {
        "ok": True,
        "sourceQuad": quad,
        "sourceBBox": _quad_bbox(quad),
        "detectionMethod": detection["method"],
        "detected": detection["detected"],
        "targetQuad": target_quad,
        "width": target_width,
        "height": target_height,
        "skew": skew,
        "transform": "perspective-to-hud-parallelogram",
        "url": f"/debug/latest_cover.png?t={int(time.time() * 1000)}",
    }


def match_cover_from_library(cover):
    if not cover:
        return None
    return {
        "matched": False,
        "reason": "cover library is not implemented",
    }


def recognize_song(slot, capture):
    song = MOCK_SONGS[slot % len(MOCK_SONGS)].copy()
    cover = extract_song_cover() if capture.get("ok") else None
    match = match_cover_from_library(cover)
    song["coverImage"] = cover["url"] if cover else capture.get("frameUrl")
    song["coverCrop"] = cover
    song["coverMatch"] = match
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
                    "platform": platform.system(),
                    "backend": _camera_backend_name(),
                    "scanLimit": DEFAULT_CAMERA_SCAN_LIMIT,
                    "cwd": str(ROOT_DIR),
                },
            )
            return
        if self.path.startswith("/api/cameras"):
            _json_response(self, HTTPStatus.OK, list_cameras())
            return
        if self.path == "/api/samples":
            _json_response(self, HTTPStatus.OK, list_sample_frames())
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
            sample_key = _sample_key_for(kind, body.get("sampleFrame"))
            selected_index = body.get("cameraIndex")
            if selected_index in ("", None):
                selected_index = None
            else:
                selected_index = int(selected_index)
            if body.get("cameraIndices"):
                indices = body.get("cameraIndices")
            elif selected_index is not None:
                indices = [selected_index]
            else:
                indices = _camera_candidates()
            camera_indices = [int(value) for value in indices]

            capture = capture_sample_frame(sample_key) if sample_key else None
            if capture is None:
                capture = capture_frame(camera_indices)
            capture["requestedCameraIndex"] = selected_index
            capture["cameraIndices"] = camera_indices

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

    server = HTTPServer((args.host, args.port), AppHandler)
    print(f"Serving HUD and API at http://{args.host}:{args.port}/")
    print("API: POST /api/recognize {kind: song|score, slot: number}")
    if cv2 is None:
        print("OpenCV is not installed; API will use mock recognition without camera frames.")
    server.serve_forever()


if __name__ == "__main__":
    main()
