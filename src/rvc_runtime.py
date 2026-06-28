from __future__ import annotations

import os
import shutil
from pathlib import Path
from typing import Optional


DEFAULT_RVC_ROOT = Path(r"E:\RVC1006Nvidia")


def find_rvc_python(rvc_root: Path) -> Optional[Path]:
    candidates = [
        rvc_root / "runtime" / "python.exe",
        rvc_root / ".venv" / "Scripts" / "python.exe",
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    python = shutil.which("python")
    return Path(python) if python else None


def configure_default_rvc_command(project_root: Path) -> Optional[str]:
    if os.environ.get("RVC_INFER_COMMAND"):
        return os.environ["RVC_INFER_COMMAND"]
    if os.environ.get("RVC_EXTERNAL_FALLBACK", "1") != "1":
        return None

    rvc_root = Path(os.environ.get("RVC_ROOT", str(DEFAULT_RVC_ROOT))).resolve()
    bridge = project_root / "tools" / "rvc_cli_bridge.py"
    rvc_python = find_rvc_python(rvc_root)
    if not rvc_root.exists() or not bridge.exists() or not rvc_python:
        return None

    command = (
        f'"{rvc_python}" "{bridge}" '
        f'--rvc-root "{rvc_root}" '
        '--input "{input}" '
        '--output "{output}" '
        '--model "{model}" '
        '--index "{index}" '
        '--transpose {transpose} '
        '--f0-method {f0_method}'
    )
    os.environ["RVC_INFER_COMMAND"] = command
    return command
