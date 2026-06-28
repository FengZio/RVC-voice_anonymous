from __future__ import annotations

import asyncio
import json
import os
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

from fastapi import FastAPI, File, Form, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from src.audio_utils import AudioError, convert_to_wav
from src.auth_store import authenticate_user, create_user, get_user_by_token, initialize_db, issue_session, revoke_session
from src.pipeline import PipelineError, VoiceAnonymousPipeline
from src.rvc_embedded import embedded_status
from src.rvc_runtime import configure_default_rvc_command
from src.rvc_adapter import RvcError, RvcInferenceConfig, find_model_by_display_name, list_rvc_models
from src.rvc_logging import append_log, read_tail
import base64
import tempfile
from src.rvc_session import RealtimeRvcSession, RealtimeRvcSessionConfig, RealtimeRvcSessionError
from src.clinic_store import (
    admin_summary_payload,
    append_chat_message,
    chat_detail,
    config_map,
    create_appointment,
    create_chat,
    create_questionnaire_submission,
    doctor_analytics_payload,
    doctor_pricing_get,
    doctor_pricing_upsert,
    doctor_queue_rows,
    doctor_row,
    doctor_schedule_get,
    doctor_schedule_upsert,
    doctors_rows,
    emr_create,
    emr_get,
    initialize_clinic_db,
    knowledge_rows,
    list_appointments,
    list_chats,
    patient_profile_get,
    patient_emrs_rows,
    patient_questionnaire_submissions,
    patient_profile_get,
    patient_profile_upsert,
    questionnaire_row,
    questionnaire_rows,
    records_rows,
    review_rows,
    summary_payload,
    approve_profile_draft,
    get_doctor_profile,
    profile_draft_rows,
    reject_profile_draft,
    submit_profile_draft,
)


ROOT_DIR = Path(__file__).resolve().parent
MODELS_DIR = ROOT_DIR / "models" / "rvc"
OUTPUTS_DIR = ROOT_DIR / "outputs"
UPLOADS_DIR = ROOT_DIR / "uploads"
FRONTEND_DIST = ROOT_DIR / "frontend" / "dist"
REALTIME_WORKERS = max(1, int(os.environ.get("RVC_REALTIME_WORKERS", "2")))
REALTIME_GPU_LIMIT = max(1, int(os.environ.get("RVC_REALTIME_GPU_LIMIT", "1")))
REALTIME_QUEUE_MAX = max(2, int(os.environ.get("RVC_REALTIME_QUEUE_MAX", "6")))
REALTIME_TIMEOUT_SECONDS = max(5, int(os.environ.get("RVC_REALTIME_TIMEOUT_SECONDS", "60")))

realtime_executor = ThreadPoolExecutor(max_workers=REALTIME_WORKERS)
realtime_gpu_semaphore = asyncio.Semaphore(REALTIME_GPU_LIMIT)
realtime_sessions: Dict[str, RealtimeRvcSession] = {}
realtime_session_cache: Dict[str, RealtimeRvcSession] = {}


webrtc_rooms: Dict[str, Dict[str, WebSocket]] = {}


app = FastAPI(title="RVC Voice Anonymous API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Access-Control-Allow-Private-Network"],
)



# Private Network Access header for Chrome
@app.middleware("http")
async def _private_network_header(request, call_next):
    response = await call_next(request)
    response.headers["Access-Control-Allow-Private-Network"] = "true"
    return response


def _ensure_dirs() -> None:
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)


def _public_path(path: Path) -> str:
    return f"/api/files/{path.resolve().relative_to(ROOT_DIR.resolve()).as_posix()}"


def _realtime_cache_key(model_path: Path, index_path: Optional[Path], transpose: int, f0_method: str) -> str:
    index_text = str(index_path.resolve()) if index_path else ""
    return f"{model_path.resolve()}::{index_text}::{transpose}::{f0_method}"


async def _get_or_create_realtime_session(
    model: Any,
    transpose: int,
    f0_method: str,
    session_id: str,
) -> RealtimeRvcSession:
    rvc_root = Path(os.environ.get("RVC_ROOT", str(Path(r"E:\RVC1006Nvidia"))))
    key = _realtime_cache_key(model.model_path, model.index_path, transpose, f0_method)
    cached = realtime_session_cache.get(key)
    if cached and cached.proc.returncode is None:
        return cached

    if cached:
        try:
            await cached.close()
        finally:
            realtime_session_cache.pop(key, None)

    session = await RealtimeRvcSession.start(
        RealtimeRvcSessionConfig(
            project_root=ROOT_DIR,
            rvc_root=rvc_root,
            model_path=model.model_path,
            index_path=model.index_path,
            transpose=transpose,
            f0_method=f0_method,
        ),
        session_id,
    )
    realtime_session_cache[key] = session
    return session


async def _warmup_realtime_session(model: Any, transpose: int, f0_method: str) -> Dict[str, Any]:
    session_id = f"warmup-{uuid.uuid4().hex}"
    session = await _get_or_create_realtime_session(model, transpose, f0_method, session_id)
    return {
        "status": "ok",
        "sessionId": session_id,
        "model": model.display_name,
        "cached": True,
        "workerAlive": session.proc.returncode is None,
    }


@dataclass
class RealtimeChunk:
    chunk_path: Path
    chunk_index: int
    received_at: float


@app.on_event("startup")
def startup() -> None:
    _ensure_dirs()
    initialize_db()
    initialize_clinic_db()
    configure_default_rvc_command(ROOT_DIR)


def _current_user(token: str) -> Dict[str, Any]:
    if not token:
        raise HTTPException(status_code=401, detail="Missing token.")
    try:
        return get_user_by_token(token)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc))


def _require_roles(user: Dict[str, Any], *roles: str) -> None:
    allowed = set(roles)
    if user.get("role") not in allowed:
        raise HTTPException(status_code=403, detail="Forbidden.")


@app.get("/api/health")
def health() -> Dict[str, str]:
    rvc_embedded = embedded_status()
    return {
        "status": "ok",
        "rvcEmbeddedAvailable": "true" if rvc_embedded["available"] else "false",
        "rvcEmbeddedEnabled": os.environ.get("RVC_EMBEDDED", "0"),
        "rvcEmbeddedError": str(rvc_embedded["error"]),
        "rvcExternalFallback": os.environ.get("RVC_EXTERNAL_FALLBACK", "1"),
        "rvcCommandConfigured": "true" if os.environ.get("RVC_INFER_COMMAND") else "false",
        "rvcRoot": os.environ.get("RVC_ROOT", str(Path(r"E:\RVC1006Nvidia"))),
    }


@app.post("/api/auth/register")
def register(
    username: str = Form(...),
    password: str = Form(...),
    display_name: str = Form(...),
    role: str = Form(...),
    title: str = Form(""),
    department: str = Form(""),
) -> Dict[str, Any]:
    try:
        user = create_user(
            username=username,
            password=password,
            display_name=display_name,
            role=role,
            title=title or None,
            department=department or None,
        )
        session = issue_session(user["id"])
        return {"user": user, "token": session["token"], "expiresAt": session["expiresAt"]}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/api/auth/login")
def login(
    username: str = Form(...),
    password: str = Form(...),
) -> Dict[str, Any]:
    try:
        user = authenticate_user(username=username, password=password)
        session = issue_session(user["id"])
        return {"user": user, "token": session["token"], "expiresAt": session["expiresAt"]}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.get("/api/auth/me")
def me(token: str = "") -> Dict[str, Any]:
    if not token:
      raise HTTPException(status_code=401, detail="Missing token.")
    try:
        user = get_user_by_token(token)
        return {"user": user}
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc))


@app.post("/api/auth/logout")
def logout(token: str = Form(...)) -> Dict[str, str]:
    revoke_session(token)
    return {"status": "ok"}


@app.get("/api/models")
def models() -> Dict[str, Any]:
    _ensure_dirs()
    return {
        "models": [
            {
                "name": model.display_name,
                "modelPath": str(model.model_path),
                "indexPath": str(model.index_path) if model.index_path else None,
            }
            for model in list_rvc_models(MODELS_DIR)
        ]
    }


@app.get("/api/patient/summary")
def patient_summary(token: str = "") -> Dict[str, Any]:
    user = _current_user(token)
    _require_roles(user, "patient", "doctor", "admin")
    return summary_payload(user["id"], user["role"])


@app.get("/api/questionnaires")
def questionnaires(token: str = "") -> Dict[str, Any]:
    user = _current_user(token)
    _require_roles(user, "patient", "doctor", "admin")
    return {"questionnaires": questionnaire_rows()}


@app.get("/api/questionnaires/{questionnaire_id}")
def questionnaire_detail(questionnaire_id: str, token: str = "") -> Dict[str, Any]:
    user = _current_user(token)
    _require_roles(user, "patient", "doctor", "admin")
    return {"questionnaire": questionnaire_row(questionnaire_id)}


@app.post("/api/questionnaires/{questionnaire_id}/submissions")
def questionnaire_submit(
    questionnaire_id: str,
    token: str = Form(...),
    score: int = Form(...),
    max_score: int = Form(...),
    risk: str = Form(...),
    answers: str = Form("[]"),
) -> Dict[str, Any]:
    user = _current_user(token)
    _require_roles(user, "patient", "doctor", "admin")
    return {
        "submission": create_questionnaire_submission(
            user["id"],
            questionnaire_id,
            score,
            max_score,
            risk,
            json.loads(answers),
        )
    }


@app.get("/api/doctors")
def doctors(token: str = "") -> Dict[str, Any]:
    user = _current_user(token)
    _require_roles(user, "patient", "doctor", "admin")
    return {"doctors": doctors_rows()}


@app.get("/api/doctors/{doctor_id}")
def doctor_detail(doctor_id: str, token: str = "") -> Dict[str, Any]:
    user = _current_user(token)
    _require_roles(user, "patient", "doctor", "admin")
    return {"doctor": doctor_row(doctor_id)}


@app.get("/api/appointments")
def appointments(token: str = "") -> Dict[str, Any]:
    user = _current_user(token)
    _require_roles(user, "patient", "doctor", "admin")
    return {"appointments": list_appointments(user["id"])}


@app.post("/api/appointments")
def appointment_create(
    token: str = Form(...),
    doctor_id: str = Form(...),
    mode: str = Form(...),
    appointment_date: str = Form(...),
    appointment_slot: str = Form(...),
    reason: str = Form(...),
) -> Dict[str, Any]:
    user = _current_user(token)
    _require_roles(user, "patient", "doctor", "admin")
    return {
        "appointment": create_appointment(
            user["id"],
            doctor_id,
            mode,
            appointment_date,
            appointment_slot,
            reason,
        )
    }


@app.post("/api/chats")
def create_chat_endpoint(
    token: str = Form(...),
    doctor_id: str = Form(...),
) -> Dict[str, Any]:
    user = _current_user(token)
    _require_roles(user, "patient")
    return {"chat": create_chat(user["id"], doctor_id)}


@app.get("/api/chats")
def chats(token: str = "") -> Dict[str, Any]:
    user = _current_user(token)
    _require_roles(user, "patient", "doctor", "admin")
    return {"chats": list_chats(user["id"], user["role"])}


@app.get("/api/chats/{chat_id}")
def chats_detail(chat_id: str, token: str = "") -> Dict[str, Any]:
    user = _current_user(token)
    _require_roles(user, "patient", "doctor", "admin")
    return {"chat": chat_detail(chat_id)}


@app.post("/api/chats/{chat_id}/messages")
def chats_message(
    chat_id: str,
    token: str = Form(...),
    content: str = Form(...),
) -> Dict[str, Any]:
    user = _current_user(token)
    _require_roles(user, "patient", "doctor", "admin")
    return {
        "message": append_chat_message(chat_id, user["role"], user["displayName"], content)
    }


@app.get("/api/patient/records")
def patient_records(token: str = "") -> Dict[str, Any]:
    user = _current_user(token)
    _require_roles(user, "patient", "doctor", "admin")
    return {"records": records_rows(user["id"])}


@app.get("/api/patient/emrs")
def patient_emrs(token: str = "") -> Dict[str, Any]:
    user = _current_user(token)
    _require_roles(user, "patient")
    return {"emrs": patient_emrs_rows(user["id"])}


@app.get("/api/patient/records/{record_id}")
def patient_record_detail(record_id: str, token: str = "") -> Dict[str, Any]:
    user = _current_user(token)
    _require_roles(user, "patient", "doctor", "admin")
    records = records_rows(user["id"])
    for record in records:
        if record["id"] == record_id:
            return {"record": record}
    raise HTTPException(status_code=404, detail="Record not found.")


@app.get("/api/doctor/summary")
def doctor_summary(token: str = "") -> Dict[str, Any]:
    user = _current_user(token)
    _require_roles(user, "doctor", "admin")
    return {"summary": summary_payload(user["id"], user["role"])["overview"], "dashboard": admin_summary_payload()}


@app.get("/api/doctor/queue")
def doctor_queue(token: str = "") -> Dict[str, Any]:
    user = _current_user(token)
    _require_roles(user, "doctor", "admin")
    return {"queue": doctor_queue_rows(user["id"])}


@app.get("/api/doctor/records")
def doctor_records(token: str = "") -> Dict[str, Any]:
    user = _current_user(token)
    _require_roles(user, "doctor", "admin")
    return {"records": records_rows()}


@app.get("/api/doctor/schedule")
def doctor_schedule(token: str = "", date: str = "") -> Dict[str, Any]:
    user = _current_user(token)
    _require_roles(user, "doctor", "admin")
    if not date:
        from datetime import date as dt_date
        date = dt_date.today().isoformat()
    return doctor_schedule_get(user["id"], date)


@app.get("/api/doctor/chats")
def doctor_chats(token: str = "") -> Dict[str, Any]:
    user = _current_user(token)
    _require_roles(user, "doctor", "admin")
    return {"chats": list_chats(user["id"], "doctor")}


@app.post("/api/doctor/chats/{chat_id}/messages")
def doctor_chat_message(
    chat_id: str,
    token: str = Form(...),
    content: str = Form(...),
) -> Dict[str, Any]:
    user = _current_user(token)
    _require_roles(user, "doctor", "admin")
    return {"message": append_chat_message(chat_id, "doctor", user["displayName"], content)}


@app.get("/api/doctor/analytics")
def doctor_analytics(token: str = "") -> Dict[str, Any]:
    user = _current_user(token)
    _require_roles(user, "doctor", "admin")
    return {"analytics": doctor_analytics_payload(user["id"])}


@app.get("/api/doctor/patients/{patient_id}/profile")
def doctor_patient_profile(patient_id: str, token: str = "") -> Dict[str, Any]:
    user = _current_user(token)
    _require_roles(user, "doctor", "admin")
    try:
        return patient_profile_get(patient_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@app.put("/api/doctor/patients/{patient_id}/profile")
def doctor_patient_profile_update(
    patient_id: str,
    token: str = Form(...),
    triage_report: str = Form(""),
    risk_level: str = Form("低风险"),
    medical_history: str = Form(""),
    historical_scores: str = Form("[]"),
) -> Dict[str, Any]:
    user = _current_user(token)
    _require_roles(user, "doctor", "admin")
    return patient_profile_upsert(
        patient_id,
        triage_report,
        risk_level,
        json.loads(historical_scores),
        medical_history,
    )


@app.get("/api/doctor/patients/{patient_id}/submissions")
def doctor_patient_submissions(patient_id: str, token: str = "") -> Dict[str, Any]:
    user = _current_user(token)
    _require_roles(user, "doctor", "admin")
    return {"submissions": patient_questionnaire_submissions(patient_id)}


@app.get("/api/doctor/patients/{patient_id}/emr")
def doctor_patient_emr_get(patient_id: str, token: str = "") -> Dict[str, Any]:
    user = _current_user(token)
    _require_roles(user, "doctor", "admin")
    try:
        return emr_get(patient_id, user["id"])
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@app.post("/api/doctor/patients/{patient_id}/emr")
def doctor_patient_emr_create(
    patient_id: str,
    token: str = Form(...),
    complaint: str = Form(""),
    impression: str = Form(""),
    plan: str = Form(""),
    referral: str = Form("否"),
    follow_up: str = Form(""),
) -> Dict[str, Any]:
    user = _current_user(token)
    _require_roles(user, "doctor", "admin")
    return emr_create(patient_id, user["id"], complaint, impression, plan, referral, follow_up)


@app.get("/api/doctor/pricing")
def doctor_pricing(token: str = "") -> Dict[str, Any]:
    user = _current_user(token)
    _require_roles(user, "doctor", "admin")
    return doctor_pricing_get(user["id"])


@app.put("/api/doctor/pricing")
def doctor_pricing_update(
    token: str = Form(...),
    pricing: str = Form("[]"),
) -> Dict[str, Any]:
    user = _current_user(token)
    _require_roles(user, "doctor", "admin")
    items = json.loads(pricing)
    return doctor_pricing_upsert(user["id"], items)


@app.put("/api/doctor/schedule")
def doctor_schedule_update(
    token: str = Form(...),
    date: str = Form(...),
    slots: str = Form("[]"),
) -> Dict[str, Any]:
    user = _current_user(token)
    _require_roles(user, "doctor", "admin")
    slots_list = json.loads(slots)
    return doctor_schedule_upsert(user["id"], date, slots_list)


# ── Doctor Profile Drafts ─────────────────────────────────────

@app.get("/api/doctor/profile")
def doctor_profile(token: str = "") -> Dict[str, Any]:
    user = _current_user(token)
    _require_roles(user, "doctor")
    return get_doctor_profile(user["id"])


@app.post("/api/doctor/profile")
def doctor_profile_submit(
    token: str = Form(...),
    name: str = Form(""),
    department: str = Form(""),
    title: str = Form(""),
    specialty: str = Form(""),
    schedule: str = Form(""),
    intro: str = Form(""),
    education: str = Form(""),
    experience: str = Form(""),
    publications: str = Form("[]"),
    reviews: str = Form("[]"),
    availabilities: str = Form("[]"),
) -> Dict[str, Any]:
    user = _current_user(token)
    _require_roles(user, "doctor")
    payload = {
        "name": name.strip(),
        "department": department.strip(),
        "title": title.strip(),
        "specialty": specialty.strip(),
        "schedule": schedule.strip(),
        "intro": intro.strip(),
        "education": education.strip(),
        "experience": experience.strip(),
        "publications": json.loads(publications),
        "reviews": json.loads(reviews),
        "availabilities": json.loads(availabilities),
    }
    # Remove empty fields
    payload = {k: v for k, v in payload.items() if v}
    return {"draft": submit_profile_draft(user["id"], payload)}


@app.get("/api/admin/profile-drafts")
def admin_profile_drafts(token: str = "", status: str = "pending") -> Dict[str, Any]:
    user = _current_user(token)
    _require_roles(user, "admin")
    return {"drafts": profile_draft_rows(status if status != "all" else None)}


@app.post("/api/admin/profile-drafts/{draft_id}/approve")
def admin_profile_draft_approve(draft_id: str, token: str = Form(...)) -> Dict[str, Any]:
    user = _current_user(token)
    _require_roles(user, "admin")
    return approve_profile_draft(draft_id, user["id"])


@app.post("/api/admin/profile-drafts/{draft_id}/reject")
def admin_profile_draft_reject(
    draft_id: str,
    token: str = Form(...),
    note: str = Form(""),
) -> Dict[str, Any]:
    user = _current_user(token)
    _require_roles(user, "admin")
    return reject_profile_draft(draft_id, user["id"], note)

@app.get("/api/admin/summary")
def admin_summary(token: str = "") -> Dict[str, Any]:
    user = _current_user(token)
    _require_roles(user, "admin")
    return admin_summary_payload()


@app.get("/api/admin/reviews")
def admin_reviews(token: str = "") -> Dict[str, Any]:
    user = _current_user(token)
    _require_roles(user, "admin")
    return {"reviews": review_rows()}


@app.post("/api/admin/reviews/{review_id}/approve")
def admin_review_approve(review_id: str, token: str = Form(...)) -> Dict[str, Any]:
    user = _current_user(token)
    _require_roles(user, "admin")
    return {"status": "ok", "reviewId": review_id, "action": "approved"}


@app.post("/api/admin/reviews/{review_id}/reject")
def admin_review_reject(review_id: str, token: str = Form(...)) -> Dict[str, Any]:
    user = _current_user(token)
    _require_roles(user, "admin")
    return {"status": "ok", "reviewId": review_id, "action": "rejected"}


@app.get("/api/admin/knowledge")
def admin_knowledge(token: str = "") -> Dict[str, Any]:
    user = _current_user(token)
    _require_roles(user, "admin")
    return {"knowledge": knowledge_rows()}


@app.put("/api/admin/knowledge")
def admin_knowledge_update(token: str = Form(...), title: str = Form(...), content: str = Form(...), category: str = Form(...)) -> Dict[str, Any]:
    user = _current_user(token)
    _require_roles(user, "admin")
    return {"status": "ok", "knowledge": {"title": title, "content": content, "category": category}}


@app.get("/api/admin/config")
def admin_config(token: str = "") -> Dict[str, Any]:
    user = _current_user(token)
    _require_roles(user, "admin")
    return {"config": config_map()}


@app.put("/api/admin/config")
def admin_config_update(token: str = Form(...), riskThreshold: float = Form(0.65), allowAnonymousAudio: bool = Form(True), allowSelfBooking: bool = Form(True)) -> Dict[str, Any]:
    user = _current_user(token)
    _require_roles(user, "admin")
    return {
        "status": "ok",
        "config": {
            "riskThreshold": riskThreshold,
            "allowAnonymousAudio": allowAnonymousAudio,
            "allowSelfBooking": allowSelfBooking,
        },
    }


@app.post("/api/realtime/prewarm")
async def realtime_prewarm(
    model: str = Form(...),
    transpose: int = Form(0),
    f0_method: str = Form("rmvpe"),
) -> Dict[str, Any]:
    _ensure_dirs()
    try:
        model_obj = find_model_by_display_name(MODELS_DIR, model)
        return await _warmup_realtime_session(model_obj, transpose, f0_method)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/api/convert")
async def convert(
    audio: UploadFile = File(...),
    model: str = Form(...),
    transpose: int = Form(0),
    use_vocal_extract: bool = Form(True),
    f0_method: str = Form("rmvpe"),
    run_asr: bool = Form(False),
) -> Dict[str, Any]:
    _ensure_dirs()
    suffix = Path(audio.filename or "upload.wav").suffix.lower() or ".wav"
    upload_path = UPLOADS_DIR / f"{uuid.uuid4().hex}{suffix}"
    with upload_path.open("wb") as file:
        file.write(await audio.read())

    pipeline = VoiceAnonymousPipeline(
        root_dir=ROOT_DIR,
        models_dir=MODELS_DIR,
        uploads_dir=UPLOADS_DIR,
        outputs_dir=OUTPUTS_DIR,
    )
    try:
        result = await asyncio.to_thread(
            pipeline.run,
            upload_path,
            model,
            transpose,
            use_vocal_extract,
            f0_method,
            run_asr,
        )
    except PipelineError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return {
        "audioUrl": _public_path(result.output_audio),
        "reportUrl": _public_path(result.report_path),
        "report": result.report,
    }


@app.get("/api/files/{file_path:path}")
def files(file_path: str) -> FileResponse:
    resolved = (ROOT_DIR / file_path).resolve()
    root = ROOT_DIR.resolve()
    if root not in resolved.parents and resolved != root:
        raise HTTPException(status_code=403, detail="Path is outside project root.")
    if not resolved.exists() or not resolved.is_file():
        raise HTTPException(status_code=404, detail="File not found.")
    return FileResponse(str(resolved))


def _process_realtime_chunk(
    chunk_path: Path,
    model_name: str,
    transpose: int,
    f0_method: str,
    chunk_index: int,
    session_dir: Path,
    session_id: str,
) -> Dict[str, Any]:
    started_at = time.time()
    wav_path = session_dir / f"chunk_{chunk_index:05d}.wav"
    output_path = session_dir / f"anonymous_{chunk_index:05d}.wav"
    try:
        convert_to_wav(chunk_path, wav_path, sample_rate=44100)
        model = find_model_by_display_name(MODELS_DIR, model_name)
        config = RvcInferenceConfig(
            model=model,
            input_audio=wav_path,
            output_audio=output_path,
            transpose=transpose,
            f0_method=f0_method,
            session_id=session_id,
            log_root=ROOT_DIR,
        )
        append_log(ROOT_DIR, session_id, f"Start realtime chunk={chunk_index} model={model.display_name}")
        status = model.run_inference(config)
        append_log(ROOT_DIR, session_id, f"Done realtime chunk={chunk_index} status={status}")
    except (AudioError, RvcError) as exc:
        append_log(ROOT_DIR, session_id, f"Error realtime chunk={chunk_index}: {exc}")
        return {"type": "processing_error", "message": str(exc), "chunk": chunk_index}

    return {
        "type": "anonymized_audio",
        "chunk": chunk_index,
        "status": status,
        "audioUrl": _public_path(output_path),
        "durationMs": None,
        "processedAt": time.time(),
        "processingMs": int((time.time() - started_at) * 1000),
        "sessionId": session_id,
    }


def _drop_oldest_pending(queue: "asyncio.Queue[Optional[RealtimeChunk]]") -> Optional[RealtimeChunk]:
    dropped = None
    kept = []
    while True:
        try:
            item = queue.get_nowait()
        except asyncio.QueueEmpty:
            break
        if dropped is None and item is not None:
            dropped = item
            queue.task_done()
            continue
        kept.append(item)
    for item in kept:
        queue.put_nowait(item)
    return dropped


async def _realtime_worker(
    input_queue: "asyncio.Queue[Optional[RealtimeChunk]]",
    output_queue: "asyncio.Queue[Dict[str, Any]]",
    session: RealtimeRvcSession,
    session_dir: Path,
    session_id: str,
) -> None:
    while True:
        item = await input_queue.get()
        if item is None:
            input_queue.task_done()
            break

        try:
            async with realtime_gpu_semaphore:
                output_path = session_dir / f"anonymous_{item.chunk_index:05d}.wav"
                result = await asyncio.wait_for(
                    session.process_chunk(
                        item.chunk_path,
                        output_path,
                        item.chunk_index,
                    ),
                    timeout=REALTIME_TIMEOUT_SECONDS,
                )
            result = {
                "type": "anonymized_audio",
                "chunk": item.chunk_index,
                "status": result.get("status", "ok"),
                "info": result.get("info"),
                "audioUrl": _public_path(output_path),
                "durationMs": None,
                "processedAt": time.time(),
                "processingMs": int(result.get("processingMs") or 0),
                "receivedAt": item.received_at,
                "latencyMs": int((time.time() - item.received_at) * 1000),
                "sessionId": session_id,
            }
            await output_queue.put(result)
        except asyncio.TimeoutError:
            await output_queue.put(
                {
                    "type": "processing_error",
                    "chunk": item.chunk_index,
                    "message": f"RVC realtime processing timed out after {REALTIME_TIMEOUT_SECONDS}s.",
                    "latencyMs": int((time.time() - item.received_at) * 1000),
                }
            )
        except Exception as exc:
            await output_queue.put(
                {
                    "type": "processing_error",
                    "chunk": item.chunk_index,
                    "message": str(exc),
                    "latencyMs": int((time.time() - item.received_at) * 1000),
                }
            )
        finally:
            input_queue.task_done()


async def _send_json(websocket: WebSocket, send_lock: asyncio.Lock, payload: Dict[str, Any]) -> None:
    async with send_lock:
        await websocket.send_json(payload)


async def _realtime_sender(
    websocket: WebSocket,
    output_queue: "asyncio.Queue[Dict[str, Any]]",
    send_lock: asyncio.Lock,
) -> None:
    pending: Dict[int, Dict[str, Any]] = {}
    next_chunk = 0
    while True:
        result = await output_queue.get()
        if result.get("type") == "sender_stop":
            output_queue.task_done()
            break

        chunk = result.get("chunk")
        if isinstance(chunk, int):
            pending[chunk] = result
            while next_chunk in pending:
                await _send_json(websocket, send_lock, pending.pop(next_chunk))
                next_chunk += 1
        else:
            await _send_json(websocket, send_lock, result)
        output_queue.task_done()


@app.websocket("/api/realtime")
async def realtime(websocket: WebSocket) -> None:
    await websocket.accept()
    _ensure_dirs()

    config: Optional[Dict[str, Any]] = None
    input_queue: "asyncio.Queue[Optional[RealtimeChunk]]" = asyncio.Queue(maxsize=REALTIME_QUEUE_MAX)
    output_queue: "asyncio.Queue[Dict[str, Any]]" = asyncio.Queue()
    send_lock = asyncio.Lock()
    worker_task: Optional[asyncio.Task[Any]] = None
    sender_task: Optional[asyncio.Task[Any]] = None
    session: Optional[RealtimeRvcSession] = None
    session_dir = OUTPUTS_DIR / "realtime" / uuid.uuid4().hex
    session_dir.mkdir(parents=True, exist_ok=True)
    session_id = uuid.uuid4().hex
    chunk_index = 0

    try:
        while True:
            message = await websocket.receive()
            if "text" in message and message["text"] is not None:
                payload = json.loads(message["text"])
                if payload.get("type") == "config":
                    config = payload
                    chunk_ms = min(2500, max(400, int(payload.get("chunkMs") or 800)))
                    target_buffer_ms = min(2500, max(1000, int(payload.get("targetBufferMs") or 1500)))
                    config["chunkMs"] = chunk_ms
                    config["targetBufferMs"] = target_buffer_ms
                    model_name = str(config.get("model") or "")
                    model = find_model_by_display_name(MODELS_DIR, model_name)
                    session = await _get_or_create_realtime_session(
                        model,
                        int(config.get("transpose") or 0),
                        str(config.get("f0Method") or "rmvpe"),
                        session_id,
                    )
                    worker_task = asyncio.create_task(
                        _realtime_worker(
                            input_queue,
                            output_queue,
                            session,
                            session_dir,
                            session_id,
                        )
                    )
                    sender_task = asyncio.create_task(_realtime_sender(websocket, output_queue, send_lock))
                    await _send_json(
                        websocket,
                        send_lock,
                        {
                            "type": "ready",
                            "chunkMs": chunk_ms,
                            "targetBufferMs": target_buffer_ms,
                            "workerLimit": REALTIME_WORKERS,
                            "gpuLimit": REALTIME_GPU_LIMIT,
                            "queueLimit": REALTIME_QUEUE_MAX,
                            "sessionId": session_id,
                        }
                    )
                elif payload.get("type") == "stop":
                    await _send_json(websocket, send_lock, {"type": "stopped"})
                    break
                continue

            if "bytes" not in message or message["bytes"] is None:
                continue
            if not config:
                await _send_json(websocket, send_lock, {"type": "error", "message": "Realtime config was not sent."})
                continue

            chunk_path = session_dir / f"source_{chunk_index:05d}.wav"
            chunk_path.write_bytes(message["bytes"])
            append_log(ROOT_DIR, session_id, f"Receive realtime chunk={chunk_index} bytes={len(message['bytes'])}")
            item = RealtimeChunk(chunk_path=chunk_path, chunk_index=chunk_index, received_at=time.time())
            if input_queue.full():
                dropped = _drop_oldest_pending(input_queue)
                if dropped:
                    await output_queue.put(
                        {
                            "type": "chunk_dropped",
                            "chunk": dropped.chunk_index,
                            "message": "Chunk was dropped before processing because the realtime queue was full.",
                        }
                    )
                await _send_json(
                    websocket,
                    send_lock,
                    {
                        "type": "backpressure",
                        "droppedChunk": dropped.chunk_index if dropped else None,
                        "queueSize": input_queue.qsize(),
                        "message": "Realtime queue is full; dropped the oldest pending chunk.",
                    }
                )
            try:
                input_queue.put_nowait(item)
            except asyncio.QueueFull:
                await output_queue.put(
                    {
                        "type": "chunk_dropped",
                        "chunk": chunk_index,
                        "message": "Chunk was dropped before processing because the realtime queue stayed full.",
                    }
                )
                await _send_json(
                    websocket,
                    send_lock,
                    {
                        "type": "backpressure",
                        "droppedChunk": chunk_index,
                        "queueSize": input_queue.qsize(),
                        "message": "Realtime queue is still full; dropped the current chunk.",
                    }
                )
            chunk_index += 1
    except WebSocketDisconnect:
        return
    finally:
        if worker_task:
            try:
                input_queue.put_nowait(None)
            except asyncio.QueueFull:
                _drop_oldest_pending(input_queue)
                input_queue.put_nowait(None)
            worker_task.cancel()
        if sender_task:
            await output_queue.put({"type": "sender_stop"})
            sender_task.cancel()
        if session:
            await session.close()
        if session and config:
            try:
                model_name = str(config.get("model") or "")
                model = find_model_by_display_name(MODELS_DIR, model_name)
                key = _realtime_cache_key(
                    model.model_path,
                    model.index_path,
                    int(config.get("transpose") or 0),
                    str(config.get("f0Method") or "rmvpe"),
                )
                if realtime_session_cache.get(key) is session:
                    realtime_session_cache.pop(key, None)
            except Exception:
                pass

@app.websocket("/api/webrtc/signal/{chat_id}")
async def webrtc_signal(websocket: WebSocket, chat_id: str, token: str = "", role: str = "") -> None:
    """WebRTC signaling relay for voice calls."""
    await websocket.accept()

    # Authenticate
    try:
        user = get_user_by_token(token)
    except ValueError:
        await websocket.send_json({"type": "error", "message": "Invalid token."})
        await websocket.close()
        return

    if role not in ("patient", "doctor"):
        await websocket.send_json({"type": "error", "message": "Role must be patient or doctor."})
        await websocket.close()
        return

    room = webrtc_rooms.setdefault(chat_id, {})

    # Room capacity check
    if len(room) >= 2:
        await websocket.send_json({"type": "error", "message": "房间已满，请稍后重试"})
        await websocket.close()
        return

    # If same role already connected, replace it (e.g. page refresh)
    if role in room:
        try:
            await room[role].close()
        except Exception:
            pass

    room[role] = websocket

    # Replay buffered offer to newly connected peer
    buffered = room.get("_offer")
    if buffered and buffered.get("target_role") == role:
        await websocket.send_json(buffered["data"])
        room.pop("_offer", None)

    try:
        while True:
            data = await websocket.receive_json()

            if data.get("type") == "hangup":
                # Notify the peer
                other_role = "doctor" if role == "patient" else "patient"
                peer = room.get(other_role)
                if peer:
                    try:
                        await peer.send_json({"type": "hangup"})
                    except Exception:
                        pass
                room.pop("_offer", None)
                break

            # Buffer offer if peer not connected yet, otherwise relay
            if data.get("type") == "offer":
                other_role = "doctor" if role == "patient" else "patient"
                peer = room.get(other_role)
                if peer:
                    await peer.send_json(data)
                else:
                    room["_offer"] = {"target_role": other_role, "data": data}
                continue

            # Relay ICE / answer to peer
            other_role = "doctor" if role == "patient" else "patient"
            peer = room.get(other_role)
            if peer:
                await peer.send_json(data)
    except (WebSocketDisconnect, RuntimeError):
        pass
    finally:
        # Clean up
        room.pop(role, None)
        room.pop("_offer", None)
        if not room:
            webrtc_rooms.pop(chat_id, None)
        else:
            # Notify remaining peer
            other_role = "doctor" if role == "patient" else "patient"
            peer = room.get(other_role)
            if peer:
                try:
                    await peer.send_json({"type": "hangup"})
                except Exception:
                    pass
                room.pop(other_role, None)
            webrtc_rooms.pop(chat_id, None)
        try:
            await websocket.close()
        except Exception:
            pass


@app.websocket("/api/rvc/stream/{session_id}")
async def rvc_stream(websocket: WebSocket, session_id: str, model: str = "", transpose: int = 0, f0_method: str = "rmvpe") -> None:
    await websocket.accept()
    # Send immediate ack so browser knows connection is alive before worker starts
    await websocket.send_json({"type": "ready"})

    if not model:
        await websocket.send_json({"type": "error", "message": "model query param is required"})
        await websocket.close()
        return

    rvc_root = Path(os.environ.get("RVC_ROOT", str(Path(r"E:\\RVC1006Nvidia"))))
    try:
        rvc_model = find_model_by_display_name(MODELS_DIR, model)
    except RvcError as exc:
        await websocket.send_json({"type": "error", "message": str(exc)})
        await websocket.close()
        return

    try:
        rvc_session = await _get_or_create_realtime_session(rvc_model, transpose, f0_method, session_id)
    except RealtimeRvcSessionError as exc:
        await websocket.send_json({"type": "error", "message": f"RVC session failed: {exc}"})
        await websocket.close()
        return

    chunk_index = 0
    try:
        while True:
            data = await websocket.receive_json()

            if data.get("type") == "stop":
                await websocket.send_json({"type": "stopped"})
                break

            if data.get("type") != "chunk":
                continue

            b64_data = data.get("data", "")
            if not b64_data:
                continue

            try:
                raw = base64.b64decode(b64_data)
            except Exception:
                await websocket.send_json({"type": "error", "message": "Invalid base64 data"})
                continue

            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as infile:
                infile.write(raw)
                input_path = Path(infile.name)

            output_path = input_path.with_name(input_path.stem + "_out.wav")

            try:
                await rvc_session.process_chunk(input_path, output_path, chunk_index)
                out_data = output_path.read_bytes()
                out_b64 = base64.b64encode(out_data).decode("ascii")
                await websocket.send_json({
                    "type": "chunk",
                    "index": chunk_index,
                    "data": out_b64,
                    "status": "ok",
                })
            except RealtimeRvcSessionError as exc:
                await websocket.send_json({
                    "type": "error",
                    "message": str(exc),
                    "index": chunk_index,
                })
            finally:
                try:
                    input_path.unlink(missing_ok=True)
                    output_path.unlink(missing_ok=True)
                except Exception:
                    pass

            chunk_index += 1
    except (WebSocketDisconnect, RuntimeError):
        pass


@app.get("/api/rvc-logs/{session_id}")
def rvc_logs(session_id: str, lines: int = 200) -> Dict[str, str]:
    lines = max(10, min(1000, lines))
    return {"sessionId": session_id, "logs": read_tail(ROOT_DIR, session_id, lines)}


if FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIST), html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("backend_api:app", host="127.0.0.1", port=7860, reload=False)
