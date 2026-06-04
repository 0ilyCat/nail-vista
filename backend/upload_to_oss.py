"""
将本地 static/ 目录下的已有图片批量上传到阿里云 OSS（UUID 重命名）

运行方式:
    python upload_to_oss.py
"""
import sys
sys.path.insert(0, ".")

import os
import uuid
from pathlib import Path
from app.core.config import settings
from app.services.oss_service import upload_bytes

STATIC_DIR = Path(__file__).parent / "static"
DIRS = ["styles", "hands", "merchants", "posts", "avatars", "results"]


def main():
    if not settings.OSS_ACCESS_KEY_ID:
        print("❌ OSS 未配置")
        return

    total = 0
    success = 0

    for dirname in DIRS:
        d = STATIC_DIR / dirname
        if not d.exists():
            continue
        for f in d.iterdir():
            if not f.is_file():
                continue
            total += 1
            ext = f.suffix.lower() or ".png"
            mime = "image/png" if ext in (".png",) else "image/jpeg"
            new_key = f"{dirname}/{uuid.uuid4().hex}{ext}"
            try:
                with open(f, "rb") as fh:
                    upload_bytes(fh.read(), new_key, mime)
                print(f"  ✅ {f.name} -> {new_key}")
                success += 1
            except Exception as e:
                print(f"  ❌ {f.name}: {e}")

    print(f"\n完成: {success}/{total}")
    print("⚠️ 请手动更新数据库中对应的 image_url 为新的 OSS key")


if __name__ == "__main__":
    main()
