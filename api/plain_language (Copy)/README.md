# CCTV — Natural Language Command System

แปลงคำสั่งภาษาธรรมดา → action บนระบบกล้อง CCTV อัตโนมัติ

## โครงสร้างโปรเจค

```
cctv_nlc/
├── backend/
│   ├── main.py           ← FastAPI app (entry point)
│   ├── db.py             ← MongoDB connection + helpers
│   ├── config_manager.py ← อ่าน/เขียน JSON config
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    └── index.html        ← UI (เปิดบน browser ได้เลย)
```

## ติดตั้งและรัน

### 1. ติดตั้ง dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. ตั้งค่า Environment

```bash
cp .env.example .env
# แก้ไข .env ใส่ ANTHROPIC_API_KEY และ MONGO_URI ของคุณ
```

### 3. รัน MongoDB (ถ้ายังไม่มี)

```bash
# Docker
docker run -d -p 27017:27017 --name mongo mongo:7

# หรือ install โดยตรง
brew install mongodb-community   # macOS
sudo apt install mongodb         # Ubuntu
```

### 4. Seed ข้อมูลกล้องตัวอย่าง (optional)

```python
# รันใน Python REPL
from db import seed_cameras
seed_cameras(6)
```

### 5. รัน Backend

```bash
cd backend
uvicorn main:app --reload --port 8000
```

API จะอยู่ที่ http://localhost:8000
Docs อัตโนมัติที่ http://localhost:8000/docs

### 6. เปิด Frontend

เปิดไฟล์ `frontend/index.html` ใน browser โดยตรง
(หรือ serve ด้วย `python -m http.server 3000` ใน folder frontend)

---

## API Endpoints

| Method | Path | ทำอะไร |
|--------|------|---------|
| GET | /cameras | ดึงรายการกล้องทั้งหมด |
| POST | /command | ส่งคำสั่งภาษาธรรมดา |
| GET | /logs | ดึง command log ล่าสุด |
| GET | /config | อ่าน config file |

### ตัวอย่าง POST /command

```bash
curl -X POST http://localhost:8000/command \
  -H "Content-Type: application/json" \
  -d '{"command": "ปรับค่าความสว่างกล้อง 1 เป็น 80"}'
```

Response:
```json
{
  "success": true,
  "parsed": {
    "action": "set_value",
    "targets": ["camera_1"],
    "parameters": {"field": "brightness", "value": 80},
    "response_th": "ปรับความสว่างกล้อง 1 เป็น 80 เรียบร้อย",
    "confidence": 0.97
  },
  "result": {
    "success": true,
    "updated": ["camera_1"],
    "field": "brightness",
    "value": 80
  },
  "response_th": "ปรับความสว่างกล้อง 1 เป็น 80 เรียบร้อย"
}
```

---

## Action Types

| action | ทำอะไร | ตัวอย่างคำสั่ง |
|--------|---------|----------------|
| `set_value` | ตั้งค่าตัวเลข | "ปรับ FPS กล้อง 2 เป็น 30" |
| `toggle_device` | เปิด/ปิดกล้อง | "ปิดกล้อง 3 และ 5" |
| `get_status` | ดูสถานะ | "แสดงสถานะกล้องทั้งหมด" |
| `get_report` | ดู log/รายงาน | "รายงาน log คำสั่งล่าสุด" |

## Fields ที่รองรับ

- `brightness` — ความสว่าง (0-100)
- `fps` — เฟรมต่อวินาที
- `resolution` — ความละเอียด (720p, 1080p, 4K)
- `exposure` — ค่า exposure
- `motion_detect` — เปิด/ปิด motion detection
