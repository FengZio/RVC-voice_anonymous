from __future__ import annotations

import os
import threading
from datetime import datetime
from pathlib import Path
from typing import Optional


LOG_DIR_NAME = "rvc_logs"
_LOCK = threading.Lock()


def _log_dir(root_dir: Path) -> Path:
    return root_dir / LOG_DIR_NAME


def log_path(root_dir: Path, session_id: str) -> Path:
    return _log_dir(root_dir) / f"{session_id}.log"


def append_log(root_dir: Path, session_id: str, message: str) -> Path:
    path = log_path(root_dir, session_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{timestamp}] {message.rstrip()}\n"
    with _LOCK:
        with path.open("a", encoding="utf-8") as file:
            file.write(line)
    return path


def read_tail(root_dir: Path, session_id: str, max_lines: int = 200) -> str:
    path = log_path(root_dir, session_id)
    if not path.exists():
        return ""
    with path.open("r", encoding="utf-8", errors="ignore") as file:
        lines = file.readlines()
    return "".join(lines[-max_lines:])

