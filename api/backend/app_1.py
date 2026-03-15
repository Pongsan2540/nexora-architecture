from fastapi import FastAPI, HTTPException, Query, APIRouter, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
import argparse
import uvicorn
from pymongo import MongoClient
from pprint import pprint
from pydantic import BaseModel

from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from minio import Minio
from minio.error import S3Error
import io
import mimetypes

import base64
from datetime import datetime

client = MongoClient("mongodb://localhost:27017")
#client = MongoClient("mongodb://root:example@localhost:27017/?authSource=admin")
db = client["ai_login"]
collection_users = db["users"]
collection_location = db["location"]
collection_event = db["event"]

collection_prompt = db["ai-prompt"]
collection_prompt_all = db["ai-prompt-all"]


client = Minio(
    "localhost:9000",
    access_key="minioadmin",
    secret_key="minioadmin",
    secure=False
)


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

BUCKET_NAME = "ai-video"
FOLDER = "video"

@app.get("/videos")
def list_videos():
    try:
        prefix = "video/"
        objects = client.list_objects(BUCKET_NAME, prefix=prefix, recursive=True)

        result = []
        for obj in objects:
            # เอาเฉพาะไฟล์ video
            if obj.object_name.lower().endswith((".mp4", ".avi", ".mov", ".mkv", ".webm")):
                result.append({
                    "file_name": obj.object_name.split("/")[-1],
                    "object_name": obj.object_name,
                    "size": obj.size,
                    "url": f"/video/{obj.object_name}"
                })

        print(result)

        return {
            "bucket": BUCKET_NAME,
            "prefix": prefix,
            "total": len(result),
            "videos": result
        }

    except S3Error as e:
        raise HTTPException(status_code=404, detail=f"MinIO error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/video/{file_path:path}")
def get_video(file_path: str):
    try:
        stat = client.stat_object(BUCKET_NAME, file_path)
        data = client.get_object(BUCKET_NAME, file_path)

        return StreamingResponse(
            data,
            media_type="video/mp4",
            headers={
                "Content-Length": str(stat.size),
                "Content-Disposition": f'inline; filename="{file_path.split("/")[-1]}"'
            }
        )

    except S3Error as e:
        raise HTTPException(status_code=404, detail=f"MinIO error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

def ensure_bucket():
    if not client.bucket_exists(BUCKET_NAME):
        client.make_bucket(BUCKET_NAME)

@api.post("/upload-video")
async def upload_video(file: UploadFile = File(...)):
    try:
        ensure_bucket()

        file_data = await file.read()
        file_size = len(file_data)

        if file_size == 0:
            raise HTTPException(status_code=400, detail="ไฟล์ว่าง")

        now = datetime.now().strftime("%Y%m%d_%H%M%S")
        encoded_filename = base64.b64encode(file.filename.encode()).decode()

        file_name = file.filename
        ext = file_name.split(".")[-1]

        print(f"{now}_{encoded_filename}", ext)

        # path ใน MinIO
        # object_name = f"{FOLDER}/{file.filename}"

        object_name = f"{FOLDER}/{now}.{ext}"
        try:
            client.put_object(
                BUCKET_NAME,
                object_name,
                io.BytesIO(file_data),
                length=file_size,
                content_type=file.content_type
            )

            print("Upload success:", object_name)

            doc = {
                "id_cam": object_name,
                "status_prompt": False,
                "config_prompt": None,
                "use_prompt": False,
                "status_detect": False,
                "config_detect": None,
                "use_detect": False,
                "status_sub_prompt": False,
                "use_sub_prompt": False,
                "model_prompt": None,
                "model_detect": None,
            }

            result = collection_prompt.insert_one(doc)

            if result.inserted_id:
                print("Insert success:", result.inserted_id)
            else:
                print("Insert failed")

        except Exception as e:
            print("Upload failed:", e)


        return {
            "status": "uploaded",
            "bucket": BUCKET_NAME,
            "object": object_name,
            "url": f"/video/{object_name}"
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))






from typing import Optional
from pydantic import BaseModel, Field, ConfigDict

@api.get("/listSetting")
async def list_setting(id_cam: Optional[str] = Query(default=None)):

    if id_cam:

        docs = list(collection_prompt.find({"id_cam": id_cam}))
        
        print(docs)

        result = []
        for d in docs:
            d["_id"] = str(d["_id"])
            result.append(d)

        print(result)

    return result


    
app.include_router(api)

if __name__ == "__main__":

    parser = argparse.ArgumentParser(description="MongoDB Read API")
    parser.add_argument("--host", type=str, default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8002)
    parser.add_argument("--reload", action="store_true")
    args = parser.parse_args()

    print(f"Server running on http://{args.host}:{args.port}")
    print(f"Swagger UI: http://{args.host}:{args.port}{API_PREFIX}/docs")
    print(f"OpenAPI JSON: http://{args.host}:{args.port}{API_PREFIX}/openapi.json")

    uvicorn.run(app, host=args.host, port=args.port, reload=args.reload)
