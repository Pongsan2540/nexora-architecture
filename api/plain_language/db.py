"""
db.py — MongoDB connection สำหรับ CCTV NLC
"""

from pymongo import MongoClient
from datetime import datetime
import os

MONGO_URI = os.getenv("MONGO_URI", "mongodb://root:example@localhost:27017/?authSource=admin")
DB_NAME = "cctv_system"

_client = None


def get_client() -> MongoClient:
    global _client
    if _client is None:
        _client = MongoClient(MONGO_URI)
    return _client


def get_db():
    return get_client()[DB_NAME]


def get_cameras_collection():
    return get_db()["cameras"]


def get_logs_collection():
    return get_db()["command_logs"]


def log_command(raw_command: str, parsed: dict, result: dict):
    """บันทึก log ทุกคำสั่งที่รัน"""
    col = get_logs_collection()
    col.insert_one({
        "timestamp": datetime.utcnow().isoformat(),
        "raw_command": raw_command,
        "action": parsed.get("action"),
        "targets": parsed.get("targets", []),
        "parameters": parsed.get("parameters", {}),
        "confidence": parsed.get("confidence"),
        "success": result.get("success", False),
        "result_summary": {k: v for k, v in result.items() if k != "logs"}
    })


def seed_cameras(count: int = 6):
    """สร้างข้อมูลกล้องตัวอย่างถ้า collection ว่าง"""
    col = get_cameras_collection()
    if col.count_documents({}) > 0:
        return

    cameras = []
    locations = ["ประตูหน้า", "ล็อบบี้", "ทางเดิน A", "ที่จอดรถ", "ห้องเซิร์ฟเวอร์", "ทางออกฉุกเฉิน"]
    for i in range(1, count + 1):
        cameras.append({
            "camera_id": f"camera_{i}",
            "name": f"กล้อง {i} - {locations[i-1]}",
            "location": locations[i-1],
            "is_active": True,
            "settings": {
                "brightness": 70,
                "fps": 25,
                "resolution": "1080p",
                "exposure": 100,
                "motion_detect": True
            },
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        })

    col.insert_many(cameras)
    print(f"[seed] สร้างกล้องตัวอย่าง {count} ตัว")
