from fastapi import FastAPI, HTTPException, Query, APIRouter, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
import argparse
import uvicorn
from pymongo import MongoClient
from pprint import pprint

# client = MongoClient("mongodb://localhost:27017")
client = MongoClient("mongodb://root:example@localhost:27017/?authSource=admin")
db = client["ai_login"]
collection_users = db["users"]
collection_location = db["location"]
collection_event = db["event"]
                                                                               
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
