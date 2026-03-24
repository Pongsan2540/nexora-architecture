"""
CCTV Natural Language Command — FastAPI Backend (Ollama version)
ใช้งาน: uvicorn main:app --reload --port 8000
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json, os, traceback, requests
from datetime import datetime
from db import get_cameras_collection, log_command
from config_manager import read_config, write_config

app = FastAPI(title="CCTV NLC API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

OLLAMA_URL   = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:7b")

SYSTEM_PROMPT = """คุณคือ AI ที่แปลงคำสั่งภาษาธรรมดา (ไทย/อังกฤษ) เป็น structured action
สำหรับระบบกล้อง CCTV backend ที่ใช้ Python + JSON config + MongoDB

ตอบ ONLY valid JSON ไม่มี markdown backtick ไม่มีข้อความอื่น:
{
  "action": "set_value | toggle_device | get_status | get_report",
  "targets": ["camera_1", "camera_2"],
  "parameters": {
    "field": "brightness | fps | resolution | exposure | motion_detect",
    "value": 80,
    "state": "on | off"
  },
  "response_th": "ข้อความตอบกลับภาษาไทย",
  "confidence": 0.95
}

กฎ:
- targets ใช้รูปแบบ camera_N (N คือหมายเลขกล้อง)
- ถ้าไม่ระบุกล้อง ให้ targets = ["all"]
- set_value ใช้สำหรับปรับค่าตัวเลข
- toggle_device ใช้สำหรับเปิด/ปิด
- get_status ใช้สำหรับดูสถานะ
- get_report ใช้สำหรับดึง log/รายงาน"""


class CommandRequest(BaseModel):
    command: str


class CommandResponse(BaseModel):
    success: bool
    parsed: dict
    result: dict
    response_th: str


@app.get("/")
def root():
    return {"status": "online", "service": "CCTV NLC API", "model": OLLAMA_MODEL}


@app.get("/cameras")
def list_cameras():
    col = get_cameras_collection()
    cameras = list(col.find({}, {"_id": 0}))
    return {"cameras": cameras}


@app.post("/command", response_model=CommandResponse)
def process_command(req: CommandRequest):
    if not req.command.strip():
        raise HTTPException(status_code=400, detail="กรุณาระบุคำสั่ง")

    parsed = parse_command_with_ai(req.command)
    result = execute_action(parsed)

    try:
        log_command(req.command, parsed, result)
    except Exception as e:
        print(f"[warn] log_command failed: {e}")

    return CommandResponse(
        success=result.get("success", False),
        parsed=parsed,
        result=result,
        response_th=parsed.get("response_th", "ดำเนินการเสร็จสิ้น")
    )


@app.get("/logs")
def get_logs(limit: int = 20):
    from db import get_logs_collection
    col = get_logs_collection()
    logs = list(col.find({}, {"_id": 0}).sort("timestamp", -1).limit(limit))
    return {"logs": logs}


@app.get("/config")
def get_config():
    return read_config()


def parse_command_with_ai(command: str) -> dict:
    """ส่งคำสั่งไปให้ Ollama แปล"""
    try:
        resp = requests.post(
            f"{OLLAMA_URL}/api/chat",
            json={
                "model": OLLAMA_MODEL,
                "stream": False,
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user",   "content": command}
                ],
                "options": {"temperature": 0.1}
            },
            timeout=60
        )
        resp.raise_for_status()
        raw = resp.json()["message"]["content"].strip()
        raw = raw.replace("```json", "").replace("```", "").strip()
        return json.loads(raw)
    except requests.exceptions.ConnectionError:
        raise HTTPException(status_code=503, detail="ไม่สามารถเชื่อมต่อ Ollama — รัน `ollama serve` ก่อนครับ")
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"AI parse error: {str(e)}")


def execute_action(parsed: dict) -> dict:
    action  = parsed.get("action")
    targets = parsed.get("targets", [])
    params  = parsed.get("parameters", {})

    if action == "set_value":
        return _set_value(targets, params)
    elif action == "toggle_device":
        return _toggle_device(targets, params)
    elif action == "get_status":
        return _get_status(targets)
    elif action == "get_report":
        return _get_report(targets, params)
    else:
        return {"success": False, "error": f"ไม่รู้จัก action: {action}"}


def _set_value(targets: list, params: dict) -> dict:
    col    = get_cameras_collection()
    config = read_config()
    field  = params.get("field", "brightness")
    value  = params.get("value")

    if value is None:
        return {"success": False, "error": "ไม่พบค่าที่ต้องการตั้ง"}

    updated  = []
    cam_list = _resolve_targets(targets, col)

    for cam_id in cam_list:
        col.update_one(
            {"camera_id": cam_id},
            {"$set": {f"settings.{field}": value, "updated_at": datetime.utcnow().isoformat()}},
            upsert=True
        )
        config["cameras"].setdefault(cam_id, {"settings": {}})["settings"][field] = value
        updated.append(cam_id)

    write_config(config)
    return {"success": True, "updated": updated, "field": field, "value": value}


def _toggle_device(targets: list, params: dict) -> dict:
    col       = get_cameras_collection()
    config    = read_config()
    state     = params.get("state", "on")
    is_active = state.lower() in ("on", "เปิด", "true", "1")

    updated  = []
    cam_list = _resolve_targets(targets, col)

    for cam_id in cam_list:
        col.update_one(
            {"camera_id": cam_id},
            {"$set": {"is_active": is_active, "updated_at": datetime.utcnow().isoformat()}},
            upsert=True
        )
        config["cameras"].setdefault(cam_id, {})["is_active"] = is_active
        updated.append(cam_id)

    write_config(config)
    return {"success": True, "updated": updated, "state": state, "is_active": is_active}


def _get_status(targets: list) -> dict:
    col      = get_cameras_collection()
    cam_list = _resolve_targets(targets, col)

    statuses = []
    for cam_id in cam_list:
        doc = col.find_one({"camera_id": cam_id}, {"_id": 0})
        statuses.append(doc if doc else {"camera_id": cam_id, "status": "ไม่พบข้อมูล"})

    return {"success": True, "cameras": statuses}


def _get_report(targets: list, params: dict) -> dict:
    from db import get_logs_collection
    col   = get_logs_collection()
    query = {}
    if targets and "all" not in targets:
        query["targets"] = {"$in": targets}

    logs = list(col.find(query, {"_id": 0}).sort("timestamp", -1).limit(50))
    return {"success": True, "total": len(logs), "logs": logs}


def _resolve_targets(targets: list, col) -> list:
    if "all" in targets:
        docs = list(col.find({}, {"camera_id": 1, "_id": 0}))
        return [d["camera_id"] for d in docs] if docs else [f"camera_{i}" for i in range(1, 5)]
    return targets