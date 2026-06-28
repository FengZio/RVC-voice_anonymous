from __future__ import annotations

from pathlib import Path
from typing import List, Tuple

from src.pipeline import PipelineError, VoiceAnonymousPipeline
from src.rvc_adapter import list_rvc_models


ROOT_DIR = Path(__file__).resolve().parent
MODELS_DIR = ROOT_DIR / "models" / "rvc"
OUTPUTS_DIR = ROOT_DIR / "outputs"
UPLOADS_DIR = ROOT_DIR / "uploads"


def _model_choices() -> List[str]:
    return [model.display_name for model in list_rvc_models(MODELS_DIR)]


def _refresh_models() -> Tuple[List[str], str]:
    choices = _model_choices()
    value = choices[0] if choices else ""
    return choices, value


def _refresh_model_dropdown():
    try:
        import gradio as gr
    except ImportError as exc:
        raise RuntimeError("Gradio is not installed.") from exc

    choices, value = _refresh_models()
    return gr.update(choices=choices, value=value)


def _run_conversion(
    input_audio: str,
    model_name: str,
    transpose: int,
    use_vocal_extract: bool,
    f0_method: str,
) -> Tuple[str, str, str, str, str, str]:
    if not input_audio:
        raise ValueError("Please upload an audio file.")
    if not model_name:
        raise ValueError("No RVC model found. Place a .pth file in models/rvc first.")

    pipeline = VoiceAnonymousPipeline(
        root_dir=ROOT_DIR,
        models_dir=MODELS_DIR,
        uploads_dir=UPLOADS_DIR,
        outputs_dir=OUTPUTS_DIR,
    )

    try:
        result = pipeline.run(
            input_audio=Path(input_audio),
            model_display_name=model_name,
            transpose=transpose,
            use_vocal_extract=use_vocal_extract,
            f0_method=f0_method,
        )
    except PipelineError as exc:
        raise ValueError(str(exc))

    report = result.report
    similarity = report.get("speaker_similarity")
    text_similarity = report.get("text_similarity")
    speaker_text = "unavailable" if similarity is None else f"{similarity:.4f}"
    text_score = "unavailable" if text_similarity is None else f"{text_similarity:.4f}"

    summary = (
        f"Speaker similarity: {speaker_text}\n"
        f"Text similarity: {text_score}\n"
        f"Vocal extraction: {report.get('vocal_extraction_status')}\n"
        f"RVC status: {report.get('rvc_status')}"
    )

    return (
        str(result.output_audio),
        str(result.output_audio),
        report.get("original_text") or "",
        report.get("anonymous_text") or "",
        summary,
        str(result.report_path),
    )


def build_app():
    try:
        import gradio as gr
    except ImportError as exc:
        raise RuntimeError(
            "Gradio is not installed. Install dependencies with: "
            "python -m pip install -r requirements.txt"
        ) from exc

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

    model_choices = _model_choices()
    initial_model = model_choices[0] if model_choices else ""

    with gr.Blocks(title="RVC Voice Anonymous") as demo:
        gr.Markdown("# RVC Voice Anonymous")

        with gr.Row():
            with gr.Column():
                input_audio = gr.Audio(
                    label="Original audio",
                    type="filepath",
                )
                model_dropdown = gr.Dropdown(
                    label="RVC model",
                    choices=model_choices,
                    value=initial_model,
                    interactive=True,
                )
                refresh_button = gr.Button("Refresh models")
                transpose = gr.Slider(
                    label="Transpose",
                    minimum=-24,
                    maximum=24,
                    step=1,
                    value=0,
                )
                f0_method = gr.Dropdown(
                    label="F0 method",
                    choices=["rmvpe", "harvest", "crepe", "pm"],
                    value="rmvpe",
                )
                use_vocal_extract = gr.Checkbox(
                    label="Extract vocals before conversion",
                    value=True,
                )
                run_button = gr.Button("Anonymize", variant="primary")

            with gr.Column():
                output_audio = gr.Audio(label="Anonymous audio", type="filepath")
                output_file = gr.File(label="Download anonymous audio")
                original_text = gr.Textbox(label="Original ASR text", lines=6)
                anonymous_text = gr.Textbox(label="Anonymous ASR text", lines=6)
                summary = gr.Textbox(label="Evaluation summary", lines=5)
                report_file = gr.File(label="Download JSON report")

        refresh_button.click(
            fn=_refresh_model_dropdown,
            inputs=[],
            outputs=[model_dropdown],
        )
        run_button.click(
            fn=_run_conversion,
            inputs=[input_audio, model_dropdown, transpose, use_vocal_extract, f0_method],
            outputs=[output_audio, output_file, original_text, anonymous_text, summary, report_file],
        )

    return demo


if __name__ == "__main__":
    app = build_app()
    app.launch()
