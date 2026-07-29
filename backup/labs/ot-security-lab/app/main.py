from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import pcap, analysis
from app.database import engine
from app.models import Base

app = FastAPI(title="OT Cybersecurity Simulator Backend")

@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(pcap.router, prefix="/api/pcap", tags=["PCAP"])
app.include_router(analysis.router, prefix="/api/analysis", tags=["Analysis"])

@app.get("/")
def root():
    return {"status": "backend running"}

@app.get("/api/health")
def health():
    return {"status": "ok"}
