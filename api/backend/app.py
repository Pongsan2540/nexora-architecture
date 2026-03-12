from fastapi import FastAPI, HTTPException, Query, APIRouter, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
import argparse
import uvicorn
from pymongo import MongoClient
from pprint import pprint
from pydantic import BaseModel

# client = MongoClient("mongodb://localhost:27017")
client = MongoClient("mongodb://root:example@localhost:27017/?authSource=admin")
db = client["ai_login"]
collection_users = db["users"]
collection_location = db["location"]
collection_event = db["event"]

collection_prompt = db["ai-prompt"]



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

@api.get("/listEventsA")
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
    pprint(cameras)
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

        print(result)

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
 
    pprint(update_fields)

    return {
        "ok": True,
        "updated_id": payload.id,
        "modified": result.modified_count,
    }

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
