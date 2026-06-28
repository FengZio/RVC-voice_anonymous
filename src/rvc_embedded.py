from __future__ import annotations

import os
import shutil
import sys
from pathlib import Path
from threading import Lock
from typing import Optional

from scipy.io import wavfile

from src.rvc_runtime import DEFAULT_RVC_ROOT


class EmbeddedRvcError(RuntimeError):
    pass


class EmbeddedRvcEngine:
    def __init__(self, rvc_root: Path) -> None:
        self.rvc_root = rvc_root.resolve()
        self._config = None
        self._vc = None
        self._loaded_model_name: Optional[str] = None
        self._lock = Lock()

    def available(self) -> bool:
        return self.rvc_root.exists() and (self.rvc_root / "infer" / "modules" / "vc" / "modules.py").exists()

    def infer(
        self,
        input_audio: Path,
        output_audio: Path,
        model_path: Path,
        index_path: Optional[Path],
        transpose: int = 0,
        f0_method: str = "rmvpe",
    ) -> str:
        with self._lock:
            return self._infer_locked(
                input_audio=input_audio,
                output_audio=output_audio,
                model_path=model_path,
                index_path=index_path,
                transpose=transpose,
                f0_method=f0_method,
            )

    def _infer_locked(
        self,
        input_audio: Path,
        output_audio: Path,
        model_path: Path,
        index_path: Optional[Path],
        transpose: int,
        f0_method: str,
    ) -> str:
        if not self.available():
            raise EmbeddedRvcError(f"Embedded RVC root is not available: {self.rvc_root}")

        previous_cwd = Path.cwd()
        previous_argv = sys.argv[:]
        try:
            os.chdir(str(self.rvc_root))
            if str(self.rvc_root) not in sys.path:
                sys.path.insert(0, str(self.rvc_root))
            sys.argv = [sys.argv[0]]
            os.environ.setdefault("weight_root", str(self.rvc_root / "assets" / "weights"))
            os.environ.setdefault("index_root", str(self.rvc_root / "logs"))

            vc = self._get_vc()
            model_name = self._ensure_weight_visible(model_path)
            if self._loaded_model_name != model_name:
                vc.get_vc(model_name, 0.5, 0.33)
                self._loaded_model_name = model_name

            index_value = str(index_path) if index_path and index_path.exists() else ""
            info, audio = vc.vc_single(
                0,
                str(input_audio),
                transpose,
                None,
                f0_method,
                index_value,
                "",
                0.75 if index_value else 0,
                3,
                0,
                0.25,
                0.33,
            )
            sample_rate, data = audio
            if sample_rate is None or data is None:
                raise EmbeddedRvcError(info)

            output_audio.parent.mkdir(parents=True, exist_ok=True)
            wavfile.write(str(output_audio), sample_rate, data)
            return "embedded"
        except Exception as exc:
            raise EmbeddedRvcError(str(exc)) from exc
        finally:
            sys.argv = previous_argv
            os.chdir(str(previous_cwd))

    def _get_vc(self):
        if self._vc is None:
            from configs.config import Config
            from infer.modules.vc.modules import VC

            self._config = Config()
            self._vc = VC(self._config)
        return self._vc

    def _ensure_weight_visible(self, model_path: Path) -> str:
        weights_dir = self.rvc_root / "assets" / "weights"
        weights_dir.mkdir(parents=True, exist_ok=True)
        visible_model = weights_dir / model_path.name
        if not visible_model.exists() or visible_model.stat().st_size != model_path.stat().st_size:
            shutil.copy2(str(model_path), str(visible_model))
        return visible_model.name


_ENGINE: Optional[EmbeddedRvcEngine] = None


def get_embedded_engine() -> EmbeddedRvcEngine:
    global _ENGINE
    if _ENGINE is None:
        rvc_root = Path(os.environ.get("RVC_ROOT", str(DEFAULT_RVC_ROOT)))
        _ENGINE = EmbeddedRvcEngine(rvc_root)
    return _ENGINE


def embedded_available() -> bool:
    return embedded_status()["available"]


def embedded_status() -> dict:
    try:
        engine = get_embedded_engine()
        if not engine.available():
            return {"available": False, "error": f"RVC root not available: {engine.rvc_root}"}

        previous_cwd = Path.cwd()
        previous_argv = sys.argv[:]
        try:
            os.chdir(str(engine.rvc_root))
            if str(engine.rvc_root) not in sys.path:
                sys.path.insert(0, str(engine.rvc_root))
            sys.argv = [sys.argv[0]]
            from configs.config import Config  # noqa: F401
            from infer.modules.vc.modules import VC  # noqa: F401
            return {"available": True, "error": ""}
        finally:
            sys.argv = previous_argv
            os.chdir(str(previous_cwd))
    except Exception as exc:
        return {"available": False, "error": str(exc)}
