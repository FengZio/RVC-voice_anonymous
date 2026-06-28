from __future__ import annotations

import argparse
import os
import shutil
import sys
from pathlib import Path

from scipy.io import wavfile


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Bridge CLI for RVC WebUI inference.")
    parser.add_argument("--rvc-root", required=True)
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
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


def ensure_weight_visible(rvc_root: Path, model_path: Path) -> str:
    weights_dir = rvc_root / "assets" / "weights"
    weights_dir.mkdir(parents=True, exist_ok=True)
    visible_model = weights_dir / model_path.name
    if not visible_model.exists() or visible_model.stat().st_size != model_path.stat().st_size:
        shutil.copy2(str(model_path), str(visible_model))
    return visible_model.name


def configure_rvc_environment(rvc_root: Path) -> None:
    os.environ.setdefault("weight_root", str(rvc_root / "assets" / "weights"))
    os.environ.setdefault("weight_uvr5_root", str(rvc_root / "assets" / "uvr5_weights"))
    os.environ.setdefault("index_root", str(rvc_root / "logs"))
    os.environ.setdefault("rmvpe_root", str(rvc_root / "assets" / "rmvpe"))
    os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")
    os.environ.setdefault("no_proxy", "localhost, 127.0.0.1, ::1")


def main() -> int:
    args = parse_args()
    rvc_root = Path(args.rvc_root).resolve()
    input_path = Path(args.input).resolve()
    output_path = Path(args.output).resolve()
    model_path = Path(args.model).resolve()
    index_path = Path(args.index).resolve() if args.index.strip() else None

    if not rvc_root.exists():
        raise FileNotFoundError(f"RVC root not found: {rvc_root}")
    if not input_path.exists():
        raise FileNotFoundError(f"Input audio not found: {input_path}")
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
    vc.get_vc(model_name, 0.5, args.protect)

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

    sample_rate, data = audio
    if sample_rate is None or data is None:
        raise RuntimeError(info)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    wavfile.write(str(output_path), sample_rate, data)
    print(info)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
