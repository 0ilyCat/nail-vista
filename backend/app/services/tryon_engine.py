"""
美甲AI试戴引擎 — Mock版本
基于 MediaPipe 手部关键点检测 + OpenCV 图像处理
不需要真实调用AI图生模型
"""
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
import io
import logging

logger = logging.getLogger(__name__)

# 尝试导入 MediaPipe，如果不可用则使用模拟
try:
    import mediapipe as mp
    MEDIAPIPE_AVAILABLE = True
except ImportError:
    MEDIAPIPE_AVAILABLE = False
    logger.warning("MediaPipe 不可用，使用模拟手部检测")


class TryOnEngine:
    """美甲试戴引擎"""

    def __init__(self):
        self.mp_hands = None
        self.mp_drawing = None
        if MEDIAPIPE_AVAILABLE:
            self.mp_hands = mp.solutions.hands
            self.mp_drawing = mp.solutions.drawing_utils

    def detect_hand_landmarks(self, image: np.ndarray) -> list[dict]:
        """
        检测手部关键点
        返回 21 个关键点坐标列表
        """
        if not MEDIAPIPE_AVAILABLE or self.mp_hands is None:
            # Fallback: 返回模拟的关键点
            h, w = image.shape[:2]
            return self._mock_landmarks(h, w)

        with self.mp_hands.Hands(
            static_image_mode=True,
            max_num_hands=1,
            min_detection_confidence=0.5,
        ) as hands:
            image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            results = hands.process(image_rgb)

            if not results.multi_hand_landmarks:
                return []

            landmarks = []
            for hand_landmarks in results.multi_hand_landmarks:
                h, w = image.shape[:2]
                for lm in hand_landmarks.landmark:
                    landmarks.append({
                        "x": lm.x * w,
                        "y": lm.y * h,
                        "z": lm.z,
                    })
            return landmarks

    def _mock_landmarks(self, h: int, w: int) -> list[dict]:
        """生成模拟手部关键点（用于开发测试）"""
        # 简化的21点手部模型（掌心朝下姿势）
        points = [
            (0.30, 0.20),  # 0: wrist
            (0.35, 0.18), (0.40, 0.15), (0.45, 0.12), (0.50, 0.10),  # thumb
            (0.35, 0.22), (0.45, 0.20), (0.52, 0.18), (0.58, 0.16),  # index
            (0.38, 0.28), (0.50, 0.28), (0.58, 0.26), (0.65, 0.25),  # middle
            (0.40, 0.35), (0.52, 0.35), (0.60, 0.34), (0.68, 0.33),  # ring
            (0.42, 0.42), (0.52, 0.43), (0.60, 0.43), (0.68, 0.42),  # pinky
        ]
        return [{"x": p[0] * w, "y": p[1] * h, "z": 0} for p in points]

    def get_fingertip_landmarks(self, landmarks: list[dict]) -> list[dict]:
        """提取指尖关键点 (index 4, 8, 12, 16, 20)"""
        fingertip_indices = [4, 8, 12, 16, 20]  # MediaPipe 指尖索引
        if len(landmarks) < 21:
            return []
        return [landmarks[i] for i in fingertip_indices]

    def estimate_nail_regions(self, landmarks: list[dict], image_shape: tuple) -> list[dict]:
        """
        根据手部关键点估算指甲区域
        返回指甲区域的边界框列表
        """
        if len(landmarks) < 21:
            return []

        h, w = image_shape[:2]
        fingertips = self.get_fingertip_landmarks(landmarks)
        nail_regions = []

        # 每个手指的指甲区域估算（指尖 + 下方关键点）
        finger_bases = {
            4: 3,   # thumb: tip=4, base=3
            8: 6,   # index: tip=8, base=6 (PIP)
            12: 10, # middle: tip=12, base=10
            16: 14, # ring: tip=16, base=14
            20: 18, # pinky: tip=20, base=18
        }

        for tip_idx, base_idx in finger_bases.items():
            if tip_idx >= len(landmarks) or base_idx >= len(landmarks):
                continue
            tip = landmarks[tip_idx]
            base = landmarks[base_idx]

            # 估算指甲区域
            nail_length = abs(tip["y"] - base["y"]) * 2.0
            nail_width = nail_length * 0.7
            cx, cy = (tip["x"] + base["x"]) / 2, (tip["y"] + base["y"]) / 2

            nail_regions.append({
                "finger": tip_idx,
                "center": (cx, cy),
                "width": nail_width,
                "height": nail_length,
                "angle": self._calc_angle(tip, base),
                "tip": tip,
                "base": base,
            })

        return nail_regions

    def _calc_angle(self, tip: dict, base: dict) -> float:
        """计算指尖方向角度"""
        dx = tip["x"] - base["x"]
        dy = tip["y"] - base["y"]
        return np.degrees(np.arctan2(dy, dx))

    def apply_nail_overlay(
        self,
        hand_image: np.ndarray,
        style_image: np.ndarray,
        nail_region: dict,
        alpha: float = 0.85,
    ) -> np.ndarray:
        """
        将美甲款式图叠加到手部照片的指甲区域
        """
        h, w = hand_image.shape[:2]
        nh, nw = int(nail_region["height"]), int(nail_region["width"])
        cx, cy = nail_region["center"]

        # 确保尺寸有效
        if nh <= 0 or nw <= 0:
            return hand_image

        # 缩放款式图到指甲大小
        style_resized = cv2.resize(style_image, (nw, nh))

        # 计算旋转矩阵
        angle = nail_region["angle"]
        M = cv2.getRotationMatrix2D((nw / 2, nh / 2), angle - 90, 1.0)
        style_rotated = cv2.warpAffine(style_resized, M, (nw, nh))

        # 创建椭圆形遮罩（模拟指甲形状）
        mask = np.zeros((nh, nw), dtype=np.uint8)
        cv2.ellipse(
            mask,
            (nw // 2, nh // 2),
            (nw // 2, nh // 2),
            0, 0, 360, 255, -1,
        )
        mask = cv2.GaussianBlur(mask, (5, 5), 3)  # 边缘羽化

        # 计算叠加位置
        x1 = int(cx - nw / 2)
        y1 = int(cy - nh / 2)
        x2, y2 = x1 + nw, y1 + nh

        # 边界裁剪
        x1_c = max(0, x1)
        y1_c = max(0, y1)
        x2_c = min(w, x2)
        y2_c = min(h, y2)

        if x2_c <= x1_c or y2_c <= y1_c:
            return hand_image

        # 叠加
        mask_crop = mask[
            max(0, -y1):nh - max(0, y2 - h),
            max(0, -x1):nw - max(0, x2 - w),
        ]
        style_crop = style_rotated[
            max(0, -y1):nh - max(0, y2 - h),
            max(0, -x1):nw - max(0, x2 - w),
        ]

        if mask_crop.shape[:2] != style_crop.shape[:2]:
            return hand_image

        mask_3ch = cv2.cvtColor(mask_crop, cv2.COLOR_GRAY2BGR) / 255.0 * alpha
        roi = hand_image[y1_c:y2_c, x1_c:x2_c].astype(np.float32)
        overlay = style_crop.astype(np.float32)

        blended = overlay * mask_3ch + roi * (1 - mask_3ch)
        hand_image[y1_c:y2_c, x1_c:x2_c] = blended.astype(np.uint8)

        return hand_image

    def process_tryon(
        self,
        hand_image_bytes: bytes,
        style_image_bytes: bytes,
    ) -> bytes:
        """
        完整的试戴处理流程
        hand_image_bytes: 用户手部照片
        style_image_bytes: 美甲款式图
        返回: 合成后的图像字节
        """
        # 加载图像
        hand_np = np.frombuffer(hand_image_bytes, np.uint8)
        hand_img = cv2.imdecode(hand_np, cv2.IMREAD_COLOR)
        style_np = np.frombuffer(style_image_bytes, np.uint8)
        style_img = cv2.imdecode(style_np, cv2.IMREAD_UNCHANGED)

        if hand_img is None or style_img is None:
            raise ValueError("无法加载图像")

        # 处理款式图透明度
        if style_img.shape[2] == 4:
            style_img = cv2.cvtColor(style_img, cv2.COLOR_BGRA2BGR)

        # 检测手部关键点
        landmarks = self.detect_hand_landmarks(hand_img)
        if not landmarks:
            logger.warning("未检测到手部关键点，返回原图")
            _, buf = cv2.imencode(".png", hand_img)
            return buf.tobytes()

        # 估算指甲区域
        nail_regions = self.estimate_nail_regions(landmarks, hand_img.shape)

        # 对每个指甲区域叠加款式
        result = hand_img.copy()
        for region in nail_regions:
            result = self.apply_nail_overlay(result, style_img, region)

        # 编码输出
        _, buf = cv2.imencode(".png", result)
        return buf.tobytes()


# 单例
tryon_engine = TryOnEngine()
