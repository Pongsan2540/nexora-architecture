"""
AI Login System — FastAPI Backend
Stack: FastAPI + MongoDB (Motor) + JWT
"""

from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr
from typing import Optional
import jwt
import bcrypt
import statistics
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv
import argparse
import uvicorn

load_dotenv()

# ─────────────────────────────────────────
#  Config
# ─────────────────────────────────────────
MONGODB_URL  = os.getenv("MONGODB_URL", "mongodb://root:example@172.16.1.31:27017/?authSource=admin")
#MONGODB_URL  = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DB_NAME      = os.getenv("DB_NAME", "ai_login")
JWT_SECRET   = os.getenv("JWT_SECRET", "change-this-secret-in-production")
JWT_EXPIRE_H = int(os.getenv("JWT_EXPIRE_HOURS", "24"))

app = FastAPI(title="AI Login API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # ใน production ให้ระบุ domain จริง
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer()

# ─────────────────────────────────────────
#  DB
# ─────────────────────────────────────────
client: AsyncIOMotorClient = None
db = None

@app.on_event("startup")
async def startup():
    global client, db
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DB_NAME]
    # Indexes
    await db.users.create_index("email", unique=True)
    await db.biometric_profiles.create_index("user_id")
    await db.login_sessions.create_index("user_id")
    print("✅ Connected to MongoDB")

@app.on_event("shutdown")
async def shutdown():
    client.close()

# ─────────────────────────────────────────
#  Schemas
# ─────────────────────────────────────────
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str
    biometric_samples: Optional[list[list[float]]] = None  # 3 รอบจาก enrollment

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class BiometricData(BaseModel):
    """Keystroke timing data จาก frontend"""
    keystroke_intervals: list[float]   # ms ระหว่างแต่ละ key
    wpm: float
    consistency: float                  # 0-100
    risk_score: float                   # 0-100 จาก Phase 1
    biometric_score: float              # 0-100 จาก Phase 2

class VerifyBiometricRequest(BaseModel):
    email: EmailStr
    biometric: BiometricData

# ─────────────────────────────────────────
#  Helpers
# ─────────────────────────────────────────
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def check_password(pw: str, hashed: str) -> bool:
    return bcrypt.checkpw(pw.encode(), hashed.encode())

def create_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRE_H),
        "iat": datetime.utcnow(),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=["HS256"])
        user = await db.users.find_one({"_id": payload["sub"]})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def compute_biometric_profile(intervals: list[float]) -> dict:
    """คำนวณ biometric statistics จาก keystroke intervals"""
    if len(intervals) < 3:
        return {}
    avg = statistics.mean(intervals)
    std = statistics.stdev(intervals) if len(intervals) > 1 else 0
    rhythm_score = max(0, 100 - (std / avg * 100)) if avg > 0 else 0
    return {
        "avg_interval_ms": round(avg, 2),
        "std_dev_ms": round(std, 2),
        "rhythm_score": round(rhythm_score, 2),
        "sample_count": len(intervals),
    }

def compare_biometric(current: list[float], stored_profiles: list[dict]) -> float:
    """
    เปรียบเทียบ biometric ปัจจุบันกับ profile ที่เคย enroll ไว้
    Returns confidence score 0-100 หรือ None ถ้าไม่มีข้อมูล
    """
    if len(current) < 3:
        return None  # ข้อมูลน้อยเกิน → ไม่คำนวณ
    if not stored_profiles:
        return None  # ไม่มี profile เลย (ไม่ได้ enroll biometric ตอนสมัคร)

    current_avg = statistics.mean(current)
    current_std = statistics.stdev(current) if len(current) > 1 else 0

    scores = []
    for profile in stored_profiles[-5:]:   # ใช้ 5 session ล่าสุด
        stored_avg = profile.get("avg_interval_ms", current_avg)
        stored_std = profile.get("std_dev_ms", current_std)

        avg_diff = abs(current_avg - stored_avg) / max(stored_avg, 1)
        std_diff = abs(current_std - stored_std) / max(stored_std, 1)

        score = max(0, 100 - (avg_diff * 60) - (std_diff * 40))
        scores.append(score)

    return round(statistics.mean(scores), 2)

# ─────────────────────────────────────────
#  Routes — Auth
# ─────────────────────────────────────────
@app.post("/api/register", status_code=201)
async def register(req: RegisterRequest):
    existing = await db.users.find_one({"email": req.email})
    if existing:
        raise HTTPException(400, "Email already registered")

    from bson import ObjectId
    user_id = str(ObjectId())
    user_doc = {
        "_id": user_id,
        "email": req.email,
        "name": req.name,
        "password_hash": hash_password(req.password),
        "created_at": datetime.utcnow(),
        "login_count": 0,
        "last_login": None,
    }

    await db.users.insert_one(user_doc)

    # บันทึก biometric profiles จาก enrollment (ถ้ามี)
    if req.biometric_samples:
        enroll_docs = []
        for sample in req.biometric_samples:
            if len(sample) < 3:
                continue
            profile = compute_biometric_profile(sample)
            elapsed_min = len(sample) / 5 / max(1, 0.001)
            sample_wpm = round((len(sample) / 5) / max((sum(sample) / 1000 / 60), 0.001))
            enroll_docs.append({
                "user_id": user_id,
                "created_at": datetime.utcnow(),
                "source": "enrollment",       # บอกว่ามาจากตอนสมัคร
                "wpm": sample_wpm,
                "consistency": profile.get("rhythm_score", 0),
                "risk_score": 100,            # enrollment ถือว่า trusted เต็ม
                "biometric_score": 100,
                "match_score": None,          # ยังไม่มีอะไรเปรียบเทียบ
                "overall_score": 100,
                "risk_level": "LOW",
                **profile,
            })
        if enroll_docs:
            await db.biometric_profiles.insert_many(enroll_docs)

    return {"message": "Registered successfully", "user_id": user_id}


@app.post("/api/login")
async def login(req: LoginRequest):
    """Phase 1 — ตรวจ email + password"""
    user = await db.users.find_one({"email": req.email})
    if not user or not check_password(req.password, user["password_hash"]):
        raise HTTPException(401, "Invalid credentials")

    return {
        "status": "password_ok",
        "user_id": user["_id"],
        "name": user["name"],
        "message": "Proceed to biometric verification",
    }


@app.post("/api/verify-biometric")
async def verify_biometric(req: VerifyBiometricRequest):
    """Phase 2 — วิเคราะห์ biometric และออก JWT"""
    user = await db.users.find_one({"email": req.email})
    if not user:
        raise HTTPException(404, "User not found")

    # ดึง biometric profiles เดิม
    profiles_cursor = db.biometric_profiles.find(
        {"user_id": user["_id"]},
        {"avg_interval_ms": 1, "std_dev_ms": 1}
    ).sort("created_at", -1).limit(10)
    stored_profiles = await profiles_cursor.to_list(10)

    # Compare biometric
    match_score = compare_biometric(req.biometric.keystroke_intervals, stored_profiles)
    is_first_session = match_score is None

    # คำนวณ overall risk (ถ้ายังไม่มี match ให้ใช้แค่ risk + biometric)
    if is_first_session:
        overall_score = (req.biometric.risk_score * 0.4 + req.biometric.biometric_score * 0.6)
        match_score = -1  # sentinel สำหรับ N/A
    else:
        overall_score = (req.biometric.risk_score * 0.3 + req.biometric.biometric_score * 0.4 + match_score * 0.3)
    risk_level = "LOW" if overall_score >= 75 else "MEDIUM" if overall_score >= 50 else "HIGH"

    # บันทึก biometric profile session นี้
    profile = compute_biometric_profile(req.biometric.keystroke_intervals)
    session_doc = {
        "user_id": user["_id"],
        "created_at": datetime.utcnow(),
        "wpm": req.biometric.wpm,
        "consistency": req.biometric.consistency,
        "risk_score": req.biometric.risk_score,
        "biometric_score": req.biometric.biometric_score,
        "match_score": None if match_score == -1 else match_score,
        "overall_score": round(overall_score, 2),
        "risk_level": risk_level,
        **profile,
    }
    await db.biometric_profiles.insert_one(session_doc)

    # Update user stats
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$inc": {"login_count": 1}, "$set": {"last_login": datetime.utcnow()}}
    )

    # บล็อกถ้า match_score ต่ำเกิน (pattern ไม่ตรง) — เช็คเฉพาะเมื่อมี profile แล้ว
    if not is_first_session and match_score < 70:
        raise HTTPException(403, f"Biometric mismatch — typing pattern not recognized (match: {round(match_score)}%)")

    # บล็อกถ้า WPM เบี่ยงเบินจาก avg ของเจ้าของเกิน ±5%
    if len(stored_profiles) >= 3:
        wpm_history = [p["wpm"] for p in stored_profiles if p.get("wpm", 0) > 0]
        if wpm_history:
            avg_wpm = statistics.mean(wpm_history)
            wpm_diff_pct = abs(req.biometric.wpm - avg_wpm) / avg_wpm * 100
            if wpm_diff_pct > 5:
                raise HTTPException(403, 
                    f"WPM anomaly — expected ~{round(avg_wpm)} wpm "
                    f"but got {round(req.biometric.wpm)} wpm "
                    f"(diff: {round(wpm_diff_pct, 1)}%)"
                )

    # บล็อกถ้า overall risk สูง
    if risk_level == "HIGH" and len(stored_profiles) >= 3:
        raise HTTPException(403, f"Access denied — risk too high (score: {round(overall_score)}%)")

    token = create_token(user["_id"], user["email"])

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": user["_id"], "email": user["email"], "name": user["name"]},
        "auth_result": {
            "match_score": match_score,
            "overall_score": round(overall_score, 2),
            "risk_level": risk_level,
            "biometric_score": req.biometric.biometric_score,
            "wpm": req.biometric.wpm,
        }
    }

# ─────────────────────────────────────────
#  Routes — Dashboard (Protected)
# ─────────────────────────────────────────
@app.get("/api/dashboard")
async def dashboard(user=Depends(get_current_user)):
    """ดึงข้อมูล user + biometric history สำหรับ dashboard"""
    # biometric history
    cursor = db.biometric_profiles.find(
        {"user_id": user["_id"]}
    ).sort("created_at", -1).limit(20)
    sessions = await cursor.to_list(20)

    history = []
    for s in sessions:
        history.append({
            "date": s["created_at"].isoformat(),
            "wpm": s.get("wpm", 0),
            "consistency": s.get("consistency", 0),
            "overall_score": s.get("overall_score", 0),
            "risk_level": s.get("risk_level", "UNKNOWN"),
            "match_score": s.get("match_score", 0),
            "avg_interval_ms": s.get("avg_interval_ms", 0),
        })

    # Stats summary
    if history:
        wpm_list = [h["wpm"] for h in history if h["wpm"] > 0]
        score_list = [h["overall_score"] for h in history]
        avg_wpm = round(statistics.mean(wpm_list), 1) if wpm_list else 0
        avg_score = round(statistics.mean(score_list), 1) if score_list else 0
        risk_counts = {"LOW": 0, "MEDIUM": 0, "HIGH": 0}
        for h in history:
            risk_counts[h["risk_level"]] = risk_counts.get(h["risk_level"], 0) + 1
    else:
        avg_wpm, avg_score = 0, 0
        risk_counts = {"LOW": 0, "MEDIUM": 0, "HIGH": 0}

    return {
        "user": {
            "id": user["_id"],
            "name": user["name"],
            "email": user["email"],
            "login_count": user.get("login_count", 0),
            "last_login": user.get("last_login", "").isoformat() if user.get("last_login") else None,
            "created_at": user["created_at"].isoformat(),
        },
        "summary": {
            "avg_wpm": avg_wpm,
            "avg_score": avg_score,
            "total_sessions": len(history),
            "risk_distribution": risk_counts,
        },
        "history": history,
    }

@app.get("/api/health")
async def health():
    return {"status": "ok", "time": datetime.utcnow().isoformat()}

if __name__ == "__main__":

    parser = argparse.ArgumentParser(description="MongoDB Read API")
    parser.add_argument("--host", type=str, default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--reload", action="store_true")
    args = parser.parse_args()

    print(f"Server running on http://{args.host}:{args.port}")
    # print(f"Swagger UI: http://{args.host}:{args.port}{API_PREFIX}/docs")
    # print(f"OpenAPI JSON: http://{args.host}:{args.port}{API_PREFIX}/openapi.json")

    uvicorn.run(app, host=args.host, port=args.port, reload=args.reload)

