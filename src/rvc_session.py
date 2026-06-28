from __future__ import annotations

import asyncio
import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from src.rvc_logging import append_log
from src.rvc_runtime import find_rvc_python


@dataclass(frozen=True)
class RealtimeRvcSessionConfig:
    project_root: Path
    rvc_root: Path
    model_path: Path
    index_path: Optional[Path]
    transpose: int
    f0_method: str
    index_rate: float = 0.75
    filter_radius: int = 3
    resample_sr: int = 0
    rms_mix_rate: float = 0.25
    protect: float = 0.33


class RealtimeRvcSessionError(RuntimeError):
    pass


class RealtimeRvcSession:
    def __init__(self, config: RealtimeRvcSessionConfig, process: asyncio.subprocess.Process, session_id: str) -> None:
        self.config = config
        self.proc = process
        self.session_id = session_id
        self._lock = asyncio.Lock()
        self._stderr_task: Optional[asyncio.Task[None]] = None

    @classmethod
    async def start(cls, config: RealtimeRvcSessionConfig, session_id: str) -> "RealtimeRvcSession":
        python_exe = find_rvc_python(config.rvc_root)
        if not python_exe:
            raise RealtimeRvcSessionError(f"RVC python not found in {config.rvc_root}")

        worker_script = config.project_root / "tools" / "rvc_session_worker.py"
        if not worker_script.exists():
            raise RealtimeRvcSessionError(f"Worker script not found: {worker_script}")

        env = os.environ.copy()
        env["OPENBLAS_NUM_THREADS"] = "1"
        env["no_proxy"] = "localhost, 127.0.0.1, ::1"

        args = [
            str(python_exe),
            str(worker_script),
            "--rvc-root",
            str(config.rvc_root),
            "--model",
            str(config.model_path),
            "--transpose",
            str(config.transpose),
            "--f0-method",
            config.f0_method,
            "--index-rate",
            str(config.index_rate),
            "--filter-radius",
            str(config.filter_radius),
            "--resample-sr",
            str(config.resample_sr),
            "--rms-mix-rate",
            str(config.rms_mix_rate),
            "--protect",
            str(config.protect),
        ]
        if config.index_path and config.index_path.exists():
            args.extend(["--index", str(config.index_path)])

        append_log(config.project_root, session_id, f"Start realtime worker: {' '.join(args)}")
        process = await asyncio.create_subprocess_exec(
            *args,
            cwd=str(config.rvc_root),
            env=env,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        session = cls(config=config, process=process, session_id=session_id)
        session._stderr_task = asyncio.create_task(session._drain_stderr())
        payload = await session._read_json_message(expected_type="ready")

        append_log(config.project_root, session_id, "Realtime worker ready")
        return session

    async def process_chunk(self, input_audio: Path, output_audio: Path, chunk_index: int) -> dict:
        async with self._lock:
            request = {
                "cmd": "process",
                "chunk": chunk_index,
                "input": str(input_audio),
                "output": str(output_audio),
            }
            assert self.proc.stdin is not None
            assert self.proc.stdout is not None
            self.proc.stdin.write((json.dumps(request, ensure_ascii=True) + "\n").encode("utf-8"))
            await self.proc.stdin.drain()
            append_log(self.config.project_root, self.session_id, f"Sent chunk={chunk_index} to worker")
            payload = await self._read_json_message()
            if payload.get("status") != "ok":
                raise RealtimeRvcSessionError(str(payload))
            append_log(self.config.project_root, self.session_id, f"Worker completed chunk={chunk_index}")
            return payload

    async def close(self) -> None:
        try:
            if self.proc.returncode is None and self.proc.stdin is not None:
                self.proc.stdin.write(b'{"cmd":"stop"}\n')
                await self.proc.stdin.drain()
        except Exception:
            pass
        try:
            if self.proc.returncode is None:
                self.proc.terminate()
        except Exception:
            pass
        if self._stderr_task:
            self._stderr_task.cancel()

    async def _drain_stderr(self) -> None:
        assert self.proc.stderr is not None
        while True:
            line = await self.proc.stderr.readline()
            if not line:
                break
            text = line.decode("utf-8", errors="ignore").rstrip()
            if text:
                append_log(self.config.project_root, self.session_id, text)

    async def _consume_stderr_tail(self) -> str:
        return "See rvc_logs for details."

    async def _read_json_message(self, expected_type: Optional[str] = None) -> dict:
        assert self.proc.stdout is not None
        while True:
            line = await self.proc.stdout.readline()
            if not line:
                stderr_text = await self._consume_stderr_tail()
                raise RealtimeRvcSessionError(f"Worker stopped unexpectedly. {stderr_text}")

            text = line.decode("utf-8", errors="ignore").strip()
            if not text:
                continue

            try:
                payload = json.loads(text)
            except json.JSONDecodeError:
                append_log(self.config.project_root, self.session_id, f"[worker-stdout] {text}")
                continue

            if expected_type and payload.get("type") != expected_type:
                append_log(self.config.project_root, self.session_id, f"[worker-stdout-json] {payload}")
                continue
            return payload
