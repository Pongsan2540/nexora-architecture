# AI Login System — FastAPI + MongoDB + Behavioral Biometrics

## Project Structure

```
ai-login/
├── backend/
│   ├── main.py              # FastAPI app (all routes)
│   ├── requirements.txt
│   └── .env.example         # Copy → .env และแก้ค่า
└── frontend/
    ├── login.html           # Login page (Phase 1 + Phase 2)
    └── dashboard.html       # Dashboard + biometric stats
```

---

## Setup

### 1. MongoDB
```bash
# ถ้ายังไม่มี MongoDB
brew install mongodb-community   # macOS
# หรือ docker run -d -p 27017:27017 mongo
```

### 2. Backend
```bash
cd backend
cp .env.example .env        # แก้ JWT_SECRET ด้วย!
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

API docs จะอยู่ที่ → http://localhost:8000/docs

### 3. Frontend
```bash
cd frontend
# เปิด static server ง่ายๆ
python -m http.server 3000
# หรือ live-server ถ้ามี node
```

เปิด browser → http://localhost:3000/login.html

---

## Auth Flow

```
[login.html]
  Phase 1: Email + Password → POST /api/login
               ↓ password_ok
  Phase 2: Keystroke Dynamics → POST /api/verify-biometric
               ↓ JWT token + auth_result (stored in localStorage)
               ↓
[dashboard.html]
  Load data → GET /api/dashboard (Bearer token)
  แสดง biometric history, charts, risk distribution
```

---

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/register | ❌ | สมัครสมาชิก |
| POST | /api/login | ❌ | ตรวจ email/password (Phase 1) |
| POST | /api/verify-biometric | ❌ | วิเคราะห์ biometric + ออก JWT |
| GET | /api/dashboard | ✅ JWT | ดึงข้อมูล user + history |
| GET | /api/health | ❌ | Health check |

---

## Biometric Scoring

ระบบเก็บ `keystroke_intervals` ของทุก session แล้วนำมา compare:

- **match_score** — เปรียบเทียบ avg/std กับ 5 session ล่าสุด
- **overall_score** = risk×30% + biometric×40% + match×30%
- **risk_level** = LOW / MEDIUM / HIGH

Session แรก (ยังไม่มี profile) จะได้ match_score = 70 (moderate)
และจะแม่นขึ้นเรื่อยๆ ทุกครั้งที่ login

---

## Production Checklist

- [ ] เปลี่ยน `JWT_SECRET` เป็น random string ยาวๆ
- [ ] ตั้ง `MONGODB_URL` เป็น production URI (Atlas ฯลฯ)
- [ ] เปลี่ยน `allow_origins=["*"]` เป็น domain จริง
- [ ] เพิ่ม HTTPS / SSL
- [ ] เพิ่ม rate limiting (slowapi)
- [ ] เก็บ `access_token` ใน httpOnly cookie แทน localStorage
