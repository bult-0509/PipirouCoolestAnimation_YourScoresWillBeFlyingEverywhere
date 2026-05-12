import cv2


def main():
    print("尝试打开默认摄像头 (Index 0)...")
    cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)

    if not cap.isOpened():
        print("Index 0 打开失败，尝试 Index 1...")
        cap = cv2.VideoCapture(1, cv2.CAP_DSHOW)

    if not cap.isOpened():
        print("无法找到或打开摄像头！请确保 iVCam 正在运行且作为虚拟摄像头可用。")
        return

    # 清空缓冲区，抓取最新的一帧
    for _ in range(5):
        ret, frame = cap.read()

    cap.release()

    if ret:
        cv2.imwrite("test_frame.jpg", frame)
        print(f"成功截取一帧画面，分辨率: {frame.shape[1]}x{frame.shape[0]}")
        print("已保存为当前目录下的 test_frame.jpg")
    else:
        print("打开了摄像头，但无法读取画面。")


if __name__ == "__main__":
    main()
