from __future__ import annotations

import os
import shlex
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional


class RvcError(RuntimeError):
    pass


@dataclass(frozen=True)
class RvcModel:
    model_path: Path
    index_path: Optional[Path] = None

    @property
    def display_name(self) -> str:
        if self.index_path:
            return f"{self.model_path.stem} + index"
        return self.model_path.stem

    def run_inference(self, config: "RvcInferenceConfig") -> str:
        if os.environ.get("RVC_EMBEDDED", "0") == "1":
            try:
                from src.rvc_embedded import get_embedded_engine

                return get_embedded_engine().infer(
                    input_audio=config.input_audio,
                    output_audio=config.output_audio,
                    model_path=config.model.model_path,
                    index_path=config.model.index_path,
                    transpose=config.transpose,
                    f0_method=config.f0_method,
                )
            except Exception as exc:
                if not os.environ.get("RVC_INFER_COMMAND"):
                    raise RvcError(f"Embedded RVC inference failed: {exc}") from exc

        command_template = os.environ.get("RVC_INFER_COMMAND", "").strip()
        if command_template:
            return _run_external_command(command_template, config)

        if os.environ.get("RVC_ALLOW_PASSTHROUGH") == "1":
            shutil.copy2(str(config.input_audio), str(config.output_audio))
            return "passthrough"

        raise RvcError(
            "RVC_INFER_COMMAND is not configured. Set it to an RVC inference "
            "command template, or set RVC_ALLOW_PASSTHROUGH=1 only for testing."
        )


@dataclass(frozen=True)
class RvcInferenceConfig:
    model: RvcModel
    input_audio: Path
    output_audio: Path
    transpose: int = 0
    f0_method: str = "rmvpe"
    session_id: Optional[str] = None
    log_root: Optional[Path] = None


def list_rvc_models(models_dir: Path) -> List[RvcModel]:
    if not models_dir.exists():
        return []

    models = []
    for model_path in sorted(models_dir.glob("*.pth")):
        index_candidates = sorted(models_dir.glob(f"{model_path.stem}*.index"))
        index_path = index_candidates[0] if index_candidates else None
        models.append(RvcModel(model_path=model_path, index_path=index_path))
    return models


def find_model_by_display_name(models_dir: Path, display_name: str) -> RvcModel:
    for model in list_rvc_models(models_dir):
        if model.display_name == display_name:
            return model
    raise RvcError(f"RVC model not found: {display_name}")


def _run_external_command(command_template: str, config: RvcInferenceConfig) -> str:
    config.output_audio.parent.mkdir(parents=True, exist_ok=True)
    values = {
        "input": str(config.input_audio),
        "output": str(config.output_audio),
        "model": str(config.model.model_path),
        "index": str(config.model.index_path or ""),
        "transpose": str(config.transpose),
        "f0_method": config.f0_method,
    }
    command_text = command_template.format(**values)
    command = shlex.split(command_text, posix=True)
    completed = subprocess.run(command, capture_output=True, text=True)
    if config.log_root and config.session_id:
        from src.rvc_logging import append_log

        append_log(config.log_root, config.session_id, f"$ {command_text}")
        if completed.stdout:
            append_log(config.log_root, config.session_id, completed.stdout)
        if completed.stderr:
            append_log(config.log_root, config.session_id, completed.stderr)
    if completed.returncode != 0:
        stderr = completed.stderr.strip() or completed.stdout.strip()
        raise RvcError(f"RVC inference failed: {stderr}")
    if not config.output_audio.exists():
        raise RvcError(f"RVC command finished but output was not created: {config.output_audio}")
    return "external_command"
