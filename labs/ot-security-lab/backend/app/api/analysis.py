from fastapi import APIRouter, HTTPException
from app.services.storage_service import get_capture_packets
from app.analysis.statistics import build_statistics
from app.analysis.conversations import build_conversations
from app.analysis.sessions import build_sessions
from app.analysis.ioc import detect_iocs
from app.analysis.timeline import build_timeline
from fastapi.responses import FileResponse
from app.services.pcap_generator import generate_pcap_from_packets

router = APIRouter()


@router.get("/statistics/{capture_id}")
def get_statistics(capture_id: int):
    capture = get_capture_packets(capture_id)

    if not capture:
        raise HTTPException(status_code=404, detail="Capture not found")

    return {
        "captureId": capture_id,
        "filename": capture["filename"],
        "statistics": build_statistics(capture["packets"]),
    }

@router.get("/conversations/{capture_id}")
def get_conversations(capture_id: int):
    capture = get_capture_packets(capture_id)

    if not capture:
        raise HTTPException(status_code=404, detail="Capture not found")

    return {
        "captureId": capture_id,
        "filename": capture["filename"],
        "conversations": build_conversations(capture["packets"]),
    }

@router.get("/sessions/{capture_id}")
def get_sessions(capture_id: int):

    capture = get_capture_packets(capture_id)

    if not capture:
        raise HTTPException(
            status_code=404,
            detail="Capture not found",
        )

    return {
        "captureId": capture_id,
        "filename": capture["filename"],
        "sessions": build_sessions(
            capture["packets"]
        ),
    }

@router.get("/iocs/{capture_id}")
def get_iocs(capture_id: int):
    capture = get_capture_packets(capture_id)

    if not capture:
        raise HTTPException(status_code=404, detail="Capture not found")

    return {
        "captureId": capture_id,
        "filename": capture["filename"],
        "iocs": detect_iocs(capture["packets"]),
    }

@router.get("/timeline/{capture_id}")
def get_timeline(capture_id: int):
    capture = get_capture_packets(capture_id)

    if not capture:
        raise HTTPException(status_code=404, detail="Capture not found")

    return {
        "captureId": capture_id,
        "filename": capture["filename"],
        "timeline": build_timeline(capture["packets"]),
    }

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
