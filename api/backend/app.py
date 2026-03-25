from fastapi import FastAPI, HTTPException, Query, APIRouter, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
import argparse
import uvicorn
from pymongo import MongoClient
from pprint import pprint
from pydantic import BaseModel

client = MongoClient("mongodb://localhost:27017")
#client = MongoClient("mongodb://root:example@localhost:27017/?authSource=admin")
db = client["ai_login"]
collection_users = db["users"]
collection_location = db["location"]
collection_event = db["event"]

collection_prompt = db["ai-prompt"]
collection_prompt_all = db["ai-prompt-all"]

collection_history_search = db["history"]


API_PREFIX = "/nexora/api"

app = FastAPI(
    title="Nexora Architecture API",
    docs_url=f"{API_PREFIX}/docs",
    redoc_url=f"{API_PREFIX}/redoc",
    openapi_url=f"{API_PREFIX}/openapi.json",
    version="0.0.1",
)

# เผื่อหน้าเว็บกับ API อยู่คนละ port
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # ตอน dev ใช้ * ได้ก่อน
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api = APIRouter(prefix=API_PREFIX)


@api.get("/users", tags=["nexora-user"])
def get_users():

    docs = list(collection_users.find())

    pprint(docs)

    list_data = []
    for idx, i in enumerate(docs):
        _id = int(i["_id"], 16)
        firstName = i["name"]
        lastName = ""
        email = i["email"]
        role = "Admin"
        phone = ""
        status = "Active"
        time_obj =i["created_at"]
        formatted = time_obj.strftime("%d/%m/%Y %H:%M:%S")

        json = {
                    "id": _id,
                    "firstName": firstName,
                    "lastName": lastName,
                    "email": email,
                    "role": role,
                    "phone": phone,
                    "date": formatted,
                    "status": status,
                }
        
        list_data.append(json)

    print("="*50)
    print("==== Log List All User ===")
    pprint(list_data)
    print("="*50)

    return list_data

@api.get("/listPlaces", tags=["nexora-user"])
def get_places():

    docs_loction = list(collection_location.find())

    list_loction = []
    for i in docs_loction:
        i["_id"] = str(i["_id"])
        list_loction.append(i)

    print("="*50)
    print("==== Log List All Location ===")
    pprint(list_loction)
    print("="*50)

    return list_loction

@api.post("/addPlaces")
async def create_place(place: dict):

    try:
        collection_location.insert_one(place)
        return {"status": "ok"}
    except Exception as e :
        return {"status": "failed"}

def serialize_doc(doc):
    doc["_id"] = str(doc["_id"])
    return doc

@api.get("/listEvents")
async def list_events(): 

    docs_event = list(collection_event.find())

    list_evebt = []
    for i in docs_event:
        i["_id"] = str(i["_id"])
        list_evebt.append(i)

    return list_evebt 


@api.get("/listCam")
async def list_events():

    docs_event = list(collection_location.find())
    cameras = []
    for i in docs_event:
        cam = {
            "name": i.get("name"),
            "id_cam": i.get("id_cam"),
            "name_cam": i.get("name_cam"),
            "type_event": i.get("type_event"),
            "hls": i.get("hls"),
        }
        cameras.append(cam)
    #pprint(cameras)
    return cameras


@api.get("/listEventCam")
async def list_event(id_cam: str | None = None):
    query = {}

    if id_cam:
        query["id_cam"] = id_cam

    docs = list(collection_event.find(query))

    result = []
    for d in docs:
        d["_id"] = str(d["_id"])
        result.append(d)

    return result



mock_settings = [
    {
        "_id": "set001",
        "id_cam": "camA_hls",
        "name": "Temple Detection",
        "sub": "AAAAAAGrand Palace, Bangkok",
        "tag": "Event Detect",
        "level": "Normal",
        "hours": "08:30 – 15:30",
        "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Wat_Phra_Kaew_3.jpg/1280px-Wat_Phra_Kaew_3.jpg",
        "desc": "Monitor temple entrance activity",
        "lat": 13.7516,
        "lng": 100.4918,
    },
    {
        "_id": "set002",
        "id_cam": "camA_hls",
        "name": "Temple Secondary Rule",
        "sub": "Bangkok inner zone",
        "tag": "Security",
        "level": "Warning",
        "hours": "10:00 – 16:00",
        "img": "",
        "desc": "Secondary detection rule for CAM-A",
        "lat": 13.7516,
        "lng": 100.4918,
    },
    {
        "_id": "set003",
        "id_cam": "camB_hls",
        "name": "VVVVMarket Crowd Rule",
        "sub": "Chatuchak",
        "tag": "Crowd Detect",
        "level": "Warning",
        "hours": "09:00 – 18:00",
        "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/Chatuchak_Market.jpg/1280px-Chatuchak_Market.jpg",
        "desc": "Monitor crowd density for CAM-B",
        "lat": 13.7999,
        "lng": 100.5500,
    },
]

# --------------------------------------------------
# SETTINGS API  <-- อันนี้แท็บ Stats จะใช้
# --------------------------------------------------
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict

@api.get("/listSetting")
async def list_setting(id_cam: Optional[str] = Query(default=None)):

    if id_cam:

        docs = list(collection_prompt.find({"id_cam": id_cam}))

        result = []
        for d in docs:
            d["_id"] = str(d["_id"])
            result.append(d)

        #print(result)

    return result

class UpdateSettingPayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
 
    id: str = Field(alias="_id")
    id_cam: str
    model_prompt: str
    config_prompt: str
    use_prompt: bool
    use_sub_prompt: bool
    model_detect: str
    config_detect: float
    use_detect: bool
 
@api.put("/updateSetting")
async def update_setting(payload: UpdateSettingPayload):
    from bson import ObjectId
    from bson.errors import InvalidId
 
    # แปลง _id เป็น ObjectId (รองรับทั้ง hex string และ string ธรรมดา)
    try:
        doc_id = ObjectId(payload.id)
    except (InvalidId, Exception):
        doc_id = payload.id  # fallback ถ้าไม่ใช่ ObjectId format
 
    print(payload.use_prompt)

    update_fields = {
        "model_prompt":   payload.model_prompt,
        "config_prompt":  payload.config_prompt,
        "use_prompt":     payload.use_prompt,
        "use_sub_prompt": payload.use_sub_prompt,
        "model_detect":   payload.model_detect,
        "config_detect":  payload.config_detect,
        "use_detect":     payload.use_detect,
    }
 
    if payload.use_prompt == True :
        update_fields["status_prompt"] = True
    elif payload.use_prompt == False :
        update_fields["status_prompt"] = False

    if payload.use_sub_prompt == True :
        update_fields["status_sub_prompt"] = True
    elif payload.use_sub_prompt == False :
        update_fields["status_sub_prompt"] = False

    if payload.use_detect == True :
        update_fields["status_detect"] = True
    elif payload.use_detect == False :
        update_fields["status_detect"] = False

    result = collection_prompt.update_one(
        {"_id": doc_id, "id_cam": payload.id_cam},
        {"$set": update_fields},
    )
 
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="setting not found")
 
    #pprint(update_fields)

    return {
        "ok": True,
        "updated_id": payload.id,
        "modified": result.modified_count,
    }


from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from pprint import pprint

class RuleRequest(BaseModel):
    rules: List[Dict[str, Any]] = Field(..., min_length=1)

@api.post("/addRule")
async def add_rule(data: RuleRequest):

    if not data.rules:
        raise HTTPException(status_code=400, detail="rules is required")

    doc = {
        "rules": data.rules
    }

    print("rules:")
    pprint(doc["rules"])

    result = collection_prompt_all.insert_one(doc)

    return {
        "status": "ok",
        "message": "rules saved",
        "inserted_id": str(result.inserted_id),
        "count": len(doc["rules"])
    }


from datetime import datetime
from bson import ObjectId

class Req(BaseModel):
    input: str
    mode: str
    user_search: bool   # 👈 เปลี่ยนเป็น bool

@api.post("/dataSearch")
async def search(req: Req):

    timestamp_input = datetime.now() 

    user_search = req.user_search
    input_search = req.input

    message = "อย่ารอคอยโอกาส จงสร้างมัน"
    timestamp_output = datetime.now() 

    data_json = {
                    "input": input_search,
                    "mode": req.mode,
                    "user_search": user_search,
                    "message": message
                }
    
    list_search_input = {
        "type_search": req.mode,
        "text": input_search,
        "image": None, 
        "time_search": timestamp_input,
        "type_message": "input",
        "tag": {}
    }

    list_search_output = {
        "type_search": req.mode,
        "text": message,
        "image": None, 
        "time_search": timestamp_output,
        "type_message": "output",
        "tag": {}
    }


    print('----', user_search)

    list_data = []
    if user_search == True :
        name_title = input_search
        record_time = timestamp_input
        list_data.append(list_search_input)
        list_data.append(list_search_output)

        search_data = {
            "time_stamp": record_time,
            "name_title": name_title,
            "list_data": list_data
        }
        
        pprint(search_data)

        result = collection_history_search.insert_one(search_data)
        print("Inserted ID:", result.inserted_id)
    else:
        list_data.append(list_search_input)
        list_data.append(list_search_output)

        collection_history_search.update_one(
            {"_id": ObjectId("69c40740274442923ce2112e")},
            {
                "$push": {
                    "list_data": {
                        "$each": list_data
                    }
                }
            }
        )

    return {
        "input": req.input,
        "mode": req.mode,
        "user_search": req.user_search,
        "message": message
    }





from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pymongo import MongoClient, DESCENDING
from pymongo.errors import ConnectionFailure
from bson import ObjectId
from bson.errors import InvalidId
from datetime import datetime, timezone
from typing import Optional
import os


# ─── HELPERS ───────────────────────────────────────────────────────────────────
def to_str_id(doc: dict) -> dict:
    """Convert ObjectId → string so JSON serialisation works."""
    if doc and "_id" in doc:
        doc["_id"] = str(doc["_id"])
    return doc
 
def parse_oid(id_str: str) -> ObjectId:
    try:
        return ObjectId(id_str)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=400, detail=f"Invalid id: '{id_str}'")
 
def now_utc() -> datetime:
    return datetime.now(timezone.utc)
 
# ─── ROUTES ────────────────────────────────────────────────────────────────────
 
# ── Health check ───────────────────────────────────────────────────────────────
@app.get(f"{API_PREFIX}/health")
def health():
    return {"status": "ok", "time": now_utc().isoformat()}
 
 
# ── GET all sessions ───────────────────────────────────────────────────────────
@app.get(f"{API_PREFIX}/history")
def list_history(
    limit: int  = Query(default=50,  ge=1, le=500,  description="Max sessions to return"),
    skip:  int  = Query(default=0,   ge=0,            description="Offset for pagination"),
    name:  Optional[str] = Query(default=None,        description="Filter by name_title (partial match)"),
):
    """
    Return all history sessions, newest first.
    Optional ?name=xxx for title search.
    """
    query: dict = {}
    if name:
        query["name_title"] = {"$regex": name, "$options": "i"}
 
    cursor = (
        collection_history_search.find(query)
           .sort("time_stamp", DESCENDING)
           .skip(skip)
           .limit(limit)
    )
    docs = [to_str_id(doc) for doc in cursor]
    return docs
 
 
# ── GET single session ─────────────────────────────────────────────────────────
@app.get(f"{API_PREFIX}/history/{{session_id}}")
def get_session(session_id: str):
    """Return one session by its MongoDB _id."""
    doc = collection_history_search.find_one({"_id": parse_oid(session_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Session not found")
    return to_str_id(doc)
 
 
# ── POST create session ────────────────────────────────────────────────────────
@app.post(f"{API_PREFIX}/history", status_code=201)
def create_session(body: dict):
    """
    Create a new history session.
 
    Expected body:
    {
      "name_title": "my session",
      "list_data": [
        {
          "type_search": "search",
          "text": "...",
          "image": null,
          "type_message": "input",   // "input" | "output"
          "tag": {}
        }
      ]
    }
    """
    name_title = body.get("name_title", "Untitled")
    list_data  = body.get("list_data", [])
 
    # stamp every message that has no time_search
    ts = now_utc()
    for msg in list_data:
        if not msg.get("time_search"):
            msg["time_search"] = ts
 
    doc = {
        "time_stamp": ts,
        "name_title": name_title,
        "list_data":  list_data,
    }
    result = collection_history_search.insert_one(doc)
    return {"_id": str(result.inserted_id), "created": True}
 
 
# ── PUT append messages ─────────────────────────────────────────────────────────
@app.put(f"{API_PREFIX}/history/{{session_id}}")
def append_messages(session_id: str, body: dict):
    """
    Append one or more messages to an existing session's list_data.
 
    Expected body:
    {
      "list_data": [ { ...msg }, ... ]
    }
    """
    oid      = parse_oid(session_id)
    new_msgs = body.get("list_data", [])
    if not new_msgs:
        raise HTTPException(status_code=400, detail="list_data is empty")
 
    ts = now_utc()
    for msg in new_msgs:
        if not msg.get("time_search"):
            msg["time_search"] = ts
 
    result = collection_history_search.update_one(
        {"_id": oid},
        {"$push": {"list_data": {"$each": new_msgs}}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"_id": session_id, "appended": len(new_msgs)}
 
 
# ── DELETE session ─────────────────────────────────────────────────────────────
@app.delete(f"{API_PREFIX}/history/{{session_id}}")
def delete_session(session_id: str):
    result = collection_history_search.delete_one({"_id": parse_oid(session_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"_id": session_id, "deleted": True}
 



app.include_router(api)

if __name__ == "__main__":

    parser = argparse.ArgumentParser(description="MongoDB Read API")
    parser.add_argument("--host", type=str, default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8001)
    parser.add_argument("--reload", action="store_true")
    args = parser.parse_args()

    print(f"Server running on http://{args.host}:{args.port}")
    print(f"Swagger UI: http://{args.host}:{args.port}{API_PREFIX}/docs")
    print(f"OpenAPI JSON: http://{args.host}:{args.port}{API_PREFIX}/openapi.json")

    uvicorn.run(app, host=args.host, port=args.port, reload=args.reload)
