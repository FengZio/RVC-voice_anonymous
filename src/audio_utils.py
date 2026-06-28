from __future__ import annotations

import shutil
import subprocess
from pathlib import Path


SUPPORTED_AUDIO_SUFFIXES = {".wav", ".mp3", ".flac", ".m4a", ".aac", ".ogg", ".webm", ".weba", ".mp4"}


class AudioError(RuntimeError):
    pass


def ensure_ffmpeg() -> str:
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise AudioError("ffmpeg was not found on PATH.")
    return ffmpeg


def validate_audio_path(path: Path) -> None:
    if not path.exists():
        raise AudioError(f"Input audio does not exist: {path}")
    if path.suffix.lower() not in SUPPORTED_AUDIO_SUFFIXES:
        supported = ", ".join(sorted(SUPPORTED_AUDIO_SUFFIXES))
        raise AudioError(f"Unsupported audio format. Supported: {supported}")


def convert_to_wav(input_path: Path, output_path: Path, sample_rate: int = 44100) -> Path:
    validate_audio_path(input_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    ffmpeg = ensure_ffmpeg()
    command = [
        ffmpeg,
        "-y",
        "-i",
        str(input_path),
        "-vn",
        "-ac",
        "1",
        "-ar",
        str(sample_rate),
        "-sample_fmt",
        "s16",
        str(output_path),
    ]
    completed = subprocess.run(command, capture_output=True, text=True)
    if completed.returncode != 0:
        raise AudioError(f"ffmpeg conversion failed: {completed.stderr.strip()}")
    return output_path


def copy_file(source: Path, destination: Path) -> Path:
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(str(source), str(destination))
    return destination
