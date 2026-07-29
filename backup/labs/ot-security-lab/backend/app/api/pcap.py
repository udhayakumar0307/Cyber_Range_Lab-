import os
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from app.services.pcap_parser import parse_pcap_file
from app.services.storage_service import save_capture, list_captures, get_capture_packets
from app.services.pcap_generator import generate_pcap_from_packets

router = APIRouter()

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/upload")
async def upload_pcap(file: UploadFile = File(...)):
    file_path = os.path.join(UPLOAD_DIR, file.filename)

    file_bytes = await file.read()

    with open(file_path, "wb") as buffer:
        buffer.write(file_bytes)

    packets = parse_pcap_file(file_path)

    capture_id = save_capture(
        filename=file.filename,
        file_size=len(file_bytes),
        packets=packets,
    )

    return {
        "captureId": capture_id,
        "filename": file.filename,
        "packetCount": len(packets),
        "packets": packets,
    }


@router.get("/captures")
def get_captures():
    return list_captures()


@router.get("/captures/{capture_id}")
def get_capture(capture_id: int):
    capture = get_capture_packets(capture_id)

    if not capture:
        raise HTTPException(status_code=404, detail="Capture not found")

    return capture

@router.post("/generate")
def generate_pcap(payload: dict):
    packets = payload.get("packets", [])
    filename = payload.get("filename")

    result = generate_pcap_from_packets(packets, filename)

    return {
        "message": "PCAP generated",
        "filename": result["filename"],
        "packetCount": result["packetCount"],
        "downloadUrl": f"/api/pcap/download/{result['filename']}",
    }


@router.get("/download/{filename}")
def download_pcap(filename: str):
    file_path = os.path.join("reports", filename)

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="PCAP not found")

    return FileResponse(
        file_path,
        media_type="application/vnd.tcpdump.pcap",
        filename=filename,
    )
