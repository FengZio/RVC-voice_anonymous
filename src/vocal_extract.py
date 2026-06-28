from __future__ import annotations

import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class VocalExtractionResult:
    audio_path: Path
    status: str
    message: str


def extract_vocals(input_wav: Path, output_dir: Path) -> VocalExtractionResult:
    output_dir.mkdir(parents=True, exist_ok=True)
    if not shutil.which("python"):
        return VocalExtractionResult(input_wav, "skipped", "python command not found.")

    command = [
        "python",
        "-m",
        "demucs.separate",
        "--two-stems",
        "vocals",
        "-o",
        str(output_dir),
        str(input_wav),
    ]

    completed = subprocess.run(command, capture_output=True, text=True)
    if completed.returncode != 0:
        message = completed.stderr.strip() or completed.stdout.strip()
        return VocalExtractionResult(input_wav, "failed_fallback_original", message)

    vocals = list(output_dir.rglob("vocals.wav"))
    if not vocals:
        return VocalExtractionResult(
            input_wav,
            "failed_fallback_original",
            "Demucs finished but vocals.wav was not found.",
        )

    return VocalExtractionResult(vocals[0], "ok", "Vocals extracted with Demucs.")

