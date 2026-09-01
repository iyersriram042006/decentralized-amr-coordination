from fastapi import FastAPI, APIRouter
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List
import uuid
from datetime import datetime, timezone


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class DemoRequestCreate(BaseModel):
    name: str
    email: str
    org: str = ""
    message: str = ""


class DemoRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: str
    org: str = ""
    message: str = ""
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class SimRunCreate(BaseModel):
    seed: int
    trials: int
    task_count: int
    baseline_avg: float
    system_avg: float
    improvement: float
    baseline_collisions: int
    system_collisions: int


class SimRun(SimRunCreate):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "AMR Fleet Coordination API"}


@api_router.post("/demo-requests", response_model=DemoRequest)
async def create_demo_request(payload: DemoRequestCreate):
    obj = DemoRequest(**payload.model_dump())
    await db.demo_requests.insert_one(obj.model_dump())
    return obj


@api_router.get("/demo-requests", response_model=List[DemoRequest])
async def list_demo_requests():
    rows = await db.demo_requests.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return rows


@api_router.post("/sim-runs", response_model=SimRun)
async def create_sim_run(payload: SimRunCreate):
    obj = SimRun(**payload.model_dump())
    await db.sim_runs.insert_one(obj.model_dump())
    return obj


@api_router.get("/sim-runs", response_model=List[SimRun])
async def list_sim_runs():
    rows = await db.sim_runs.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return rows

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()