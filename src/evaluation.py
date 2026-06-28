from __future__ import annotations

import difflib
import os
from pathlib import Path
from typing import Dict, Optional

import numpy as np


def transcribe_audio(audio_path: Path, model_size: str = "small") -> Dict[str, Optional[str]]:
    try:
        from faster_whisper import WhisperModel
    except Exception as exc:
        return {"text": None, "error": f"faster-whisper import failed: {exc}"}

    try:
        model = WhisperModel(model_size, device="auto", compute_type="default")
        segments, _info = model.transcribe(str(audio_path), vad_filter=True)
        text = "".join(segment.text for segment in segments).strip()
        return {"text": text, "error": None}
    except Exception as exc:
        return {"text": None, "error": f"ASR failed: {exc}"}


def speaker_similarity(original_audio: Path, anonymous_audio: Path) -> Dict[str, Optional[float]]:
    try:
        from resemblyzer import VoiceEncoder, preprocess_wav
    except Exception as exc:
        return {"score": None, "error": f"resemblyzer import failed: {exc}"}

    try:
        encoder = VoiceEncoder()
        original_wav = preprocess_wav(str(original_audio))
        anonymous_wav = preprocess_wav(str(anonymous_audio))
        original_embed = encoder.embed_utterance(original_wav)
        anonymous_embed = encoder.embed_utterance(anonymous_wav)
        denominator = np.linalg.norm(original_embed) * np.linalg.norm(anonymous_embed)
        if denominator == 0:
            return {"score": None, "error": "speaker embedding norm is zero"}
        score = float(np.dot(original_embed, anonymous_embed) / denominator)
        return {"score": score, "error": None}
    except Exception as exc:
        return {"score": None, "error": f"speaker similarity failed: {exc}"}


def text_similarity(original_text: Optional[str], anonymous_text: Optional[str]) -> Optional[float]:
    if not original_text or not anonymous_text:
        return None
    return difflib.SequenceMatcher(None, original_text, anonymous_text).ratio()


def evaluate_pair(original_audio: Path, anonymous_audio: Path, run_asr: bool = False) -> Dict[str, object]:
    if run_asr or os.environ.get("RVC_ENABLE_ASR", "0") == "1":
        original_asr = transcribe_audio(original_audio)
        anonymous_asr = transcribe_audio(anonymous_audio)
    else:
        original_asr = {"text": None, "error": "ASR skipped. Set RVC_ENABLE_ASR=1 or enable ASR in the UI."}
        anonymous_asr = {"text": None, "error": "ASR skipped. Set RVC_ENABLE_ASR=1 or enable ASR in the UI."}
    speaker = speaker_similarity(original_audio, anonymous_audio)
    text_score = text_similarity(original_asr.get("text"), anonymous_asr.get("text"))

    return {
        "original_text": original_asr.get("text"),
        "anonymous_text": anonymous_asr.get("text"),
        "original_asr_error": original_asr.get("error"),
        "anonymous_asr_error": anonymous_asr.get("error"),
        "speaker_similarity": speaker.get("score"),
        "speaker_similarity_error": speaker.get("error"),
        "text_similarity": text_score,
    }
