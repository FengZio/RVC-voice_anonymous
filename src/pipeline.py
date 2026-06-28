from __future__ import annotations

import json
import shutil
import uuid
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Dict

from src.audio_utils import AudioError, convert_to_wav, validate_audio_path
from src.evaluation import evaluate_pair
from src.rvc_adapter import RvcError, RvcInferenceConfig, RvcModel, find_model_by_display_name
from src.vocal_extract import VocalExtractionResult, extract_vocals


class PipelineError(RuntimeError):
    pass


@dataclass
class PipelineResult:
    output_audio: Path
    report_path: Path
    report: Dict[str, object]


class VoiceAnonymousPipeline:
    def __init__(self, root_dir: Path, models_dir: Path, uploads_dir: Path, outputs_dir: Path) -> None:
        self.root_dir = root_dir
        self.models_dir = models_dir
        self.uploads_dir = uploads_dir
        self.outputs_dir = outputs_dir

    def run(
        self,
        input_audio: Path,
        model_display_name: str,
        transpose: int = 0,
        use_vocal_extract: bool = True,
        f0_method: str = "rmvpe",
        run_asr: bool = False,
    ) -> PipelineResult:
        self.uploads_dir.mkdir(parents=True, exist_ok=True)
        self.outputs_dir.mkdir(parents=True, exist_ok=True)

        try:
            validate_audio_path(input_audio)
            model = find_model_by_display_name(self.models_dir, model_display_name)
        except (AudioError, RvcError) as exc:
            raise PipelineError(str(exc)) from exc

        job_id = datetime.now().strftime("%Y%m%d_%H%M%S") + "_" + uuid.uuid4().hex[:8]
        job_dir = self.outputs_dir / job_id
        job_dir.mkdir(parents=True, exist_ok=True)

        uploaded_copy = self.uploads_dir / f"{job_id}{input_audio.suffix.lower()}"
        shutil.copy2(str(input_audio), str(uploaded_copy))

        original_wav = job_dir / "original.wav"
        try:
            convert_to_wav(uploaded_copy, original_wav)
        except AudioError as exc:
            raise PipelineError(str(exc)) from exc

        if use_vocal_extract:
            vocal_result = extract_vocals(original_wav, job_dir / "vocals")
        else:
            vocal_result = VocalExtractionResult(
                audio_path=original_wav,
                status="disabled",
                message="Vocal extraction disabled.",
            )

        anonymous_audio = job_dir / "anonymous.wav"
        config = RvcInferenceConfig(
            model=model,
            input_audio=vocal_result.audio_path,
            output_audio=anonymous_audio,
            transpose=transpose,
            f0_method=f0_method,
        )

        try:
            rvc_status = model.run_inference(config)
        except RvcError as exc:
            raise PipelineError(str(exc)) from exc

        evaluation = evaluate_pair(original_wav, anonymous_audio, run_asr=run_asr)
        report = {
            "job_id": job_id,
            "input_audio": str(uploaded_copy),
            "original_wav": str(original_wav),
            "vocal_audio": str(vocal_result.audio_path),
            "anonymous_audio": str(anonymous_audio),
            "model": model.display_name,
            "transpose": transpose,
            "f0_method": f0_method,
            "vocal_extraction_status": vocal_result.status,
            "vocal_extraction_message": vocal_result.message,
            "rvc_status": rvc_status,
            "asr_enabled": run_asr,
        }
        report.update(evaluation)

        report_path = job_dir / "report.json"
        report_path.write_text(json.dumps(report, indent=2, ensure_ascii=True), encoding="utf-8")
        return PipelineResult(output_audio=anonymous_audio, report_path=report_path, report=report)
