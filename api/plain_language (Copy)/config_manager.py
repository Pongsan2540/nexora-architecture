"""
config_manager.py — อ่าน/เขียน JSON config file
"""

import json
import os

CONFIG_PATH = os.getenv("CONFIG_PATH", "config.json")

DEFAULT_CONFIG = {
    "system": {
        "name": "CCTV NLC System",
        "version": "1.0.0",
        "timezone": "Asia/Bangkok"
    },
    "cameras": {}
}


def read_config() -> dict:
    """อ่าน config จาก JSON file"""
    if not os.path.exists(CONFIG_PATH):
        write_config(DEFAULT_CONFIG)
        return DEFAULT_CONFIG.copy()

    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def write_config(config: dict):
    """เขียน config ลง JSON file"""
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(config, f, ensure_ascii=False, indent=2)


def get_camera_config(camera_id: str) -> dict:
    """ดึง config ของกล้องตัวเดียว"""
    config = read_config()
    return config.get("cameras", {}).get(camera_id, {})


def set_camera_setting(camera_id: str, field: str, value):
    """ตั้งค่า setting ของกล้องใน config file"""
    config = read_config()
    if camera_id not in config["cameras"]:
        config["cameras"][camera_id] = {"settings": {}}
    config["cameras"][camera_id].setdefault("settings", {})[field] = value
    write_config(config)
