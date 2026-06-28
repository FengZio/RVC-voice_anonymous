from __future__ import annotations

import argparse
import io
import json
import os
import shutil
import tempfile
import sys
import contextlib
from contextlib import redirect_stdout
from pathlib import Path

import numpy as np
from scipy.io import wavfile


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Persistent RVC realtime worker.")
    parser.add_argument("--rvc-root", required=True)
    parser.add_argument("--model", required=True)
    parser.add_argument("--index", default="")
    parser.add_argument("--transpose", type=int, default=0)
    parser.add_argument("--f0-method", default="rmvpe")
    parser.add_argument("--index-rate", type=float, default=0.75)
    parser.add_argument("--filter-radius", type=int, default=3)
    parser.add_argument("--resample-sr", type=int, default=0)
    parser.add_argument("--rms-mix-rate", type=float, default=0.25)
    parser.add_argument("--protect", type=float, default=0.33)
    return parser.parse_args()


def configure_rvc_environment(rvc_root: Path) -> None:
    os.environ.setdefault("weight_root", str(rvc_root / "assets" / "weights"))
    os.environ.setdefault("weight_uvr5_root", str(rvc_root / "assets" / "uvr5_weights"))
    os.environ.setdefault("index_root", str(rvc_root / "logs"))
    os.environ.setdefault("rmvpe_root", str(rvc_root / "assets" / "rmvpe"))
    os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")
    os.environ.setdefault("no_proxy", "localhost, 127.0.0.1, ::1")


def ensure_weight_visible(rvc_root: Path, model_path: Path) -> str:
    weights_dir = rvc_root / "assets" / "weights"
    weights_dir.mkdir(parents=True, exist_ok=True)
    visible_model = weights_dir / model_path.name
    if not visible_model.exists() or visible_model.stat().st_size != model_path.stat().st_size:
        shutil.copy2(str(model_path), str(visible_model))
    return visible_model.name


def emit(payload: dict) -> None:
    print(json.dumps(payload, ensure_ascii=True), flush=True)


def warmup_inference(vc, args: argparse.Namespace, index_path: Optional[Path]) -> None:
    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_root = Path(tmp_dir)
        input_path = tmp_root / "warmup.wav"
        output_path = tmp_root / "warmup_out.wav"
        sample_rate = 16000
        silence = np.zeros(int(sample_rate * 0.5), dtype=np.int16)
        wavfile.write(str(input_path), sample_rate, silence)

        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            info, audio = vc.vc_single(
                0,
                str(input_path),
                args.transpose,
                None,
                args.f0_method,
                str(index_path) if index_path and index_path.exists() else "",
                "",
                args.index_rate if index_path and index_path.exists() else 0,
                args.filter_radius,
                args.resample_sr,
                args.rms_mix_rate,
                args.protect,
            )
        extra = buf.getvalue().strip()
        if extra:
            print(extra, file=sys.stderr, flush=True)

        sample_rate, data = audio
        if sample_rate is None or data is None:
            raise RuntimeError(info)
        wavfile.write(str(output_path), sample_rate, data)


def main() -> int:
    args = parse_args()
    rvc_root = Path(args.rvc_root).resolve()
    model_path = Path(args.model).resolve()
    index_path = Path(args.index).resolve() if args.index.strip() else None

    if not rvc_root.exists():
        raise FileNotFoundError(f"RVC root not found: {rvc_root}")
    if not model_path.exists():
        raise FileNotFoundError(f"RVC model not found: {model_path}")

    os.chdir(str(rvc_root))
    sys.path.insert(0, str(rvc_root))
    sys.argv = [sys.argv[0]]
    configure_rvc_environment(rvc_root)

    from configs.config import Config
    from infer.modules.vc.modules import VC

    model_name = ensure_weight_visible(rvc_root, model_path)
    config = Config()
    vc = VC(config)
    init_buf = io.StringIO()
    with contextlib.redirect_stdout(init_buf):
        vc.get_vc(model_name, 0.5, args.protect)
    init_extra = init_buf.getvalue().strip()
    if init_extra:
        print(init_extra, file=sys.stderr, flush=True)

    try:
        warmup_inference(vc, args, index_path)
        print("Warmup inference completed.", file=sys.stderr, flush=True)
    except Exception as exc:
        print(f"Warmup inference failed: {exc}", file=sys.stderr, flush=True)

    emit({"type": "ready", "model": model_name})
    while True:
        line = sys.stdin.readline()
        if not line:
            break

        payload = json.loads(line)
        cmd = payload.get("cmd")
        if cmd == "stop":
            emit({"type": "stopped"})
            break
        if cmd != "process":
            emit({"status": "error", "error": f"Unknown cmd: {cmd}"})
            continue

        input_path = Path(payload["input"])
        output_path = Path(payload["output"])
        chunk = payload.get("chunk")
        try:
            buf = io.StringIO()
            with redirect_stdout(buf):
                info, audio = vc.vc_single(
                    0,
                    str(input_path),
                    args.transpose,
                    None,
                    args.f0_method,
                    str(index_path) if index_path and index_path.exists() else "",
                    "",
                    args.index_rate if index_path and index_path.exists() else 0,
                    args.filter_radius,
                    args.resample_sr,
                    args.rms_mix_rate,
                    args.protect,
                )
            extra = buf.getvalue().strip()
            if extra:
                print(extra, file=sys.stderr, flush=True)

            sample_rate, data = audio
            if sample_rate is None or data is None:
                raise RuntimeError(info)

            output_path.parent.mkdir(parents=True, exist_ok=True)
            wavfile.write(str(output_path), sample_rate, data)
            emit({"status": "ok", "chunk": chunk, "info": info, "sampleRate": sample_rate})
        except Exception as exc:
            emit({"status": "error", "chunk": chunk, "error": str(exc)})

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
