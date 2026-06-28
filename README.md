# RVC 语音匿名与实时心理导诊演示系统

这是一个基于 React 前端、FastAPI 本地后端和 Electron 便携桌面壳的语音隐私保护演示项目。系统使用用户提供的 RVC 模型，将原始人声转换为统一、中立的匿名声线，并提供离线音频转换、声纹相似度对比、ASR 文本对比，以及准实时麦克风匿名化链路。

## 功能特性

- React 前端，用于音频上传、实时麦克风演示和结果展示。
- FastAPI 后端，用于本地音频处理、RVC 调用和文件服务。
- Electron 便携桌面入口，支持打包为 Windows portable 程序。
- 上传音频文件并转换为匿名化音频。
- 可选人声提取，转换前尽量分离背景声。
- 使用本地 RVC 模型进行声线匿名化。
- 输出转换前后声纹相似度，评估匿名化强度。
- 可选输出转换前后 ASR 文本，辅助验证语义内容是否明显丢失。
- 下载匿名化音频和 JSON 报告。
- 实时麦克风模式：边缘网关脱敏、医生端缓冲播放、分片交叉淡入淡出。

## Python 版本

项目目标运行环境为 Python 3.9.5。当前机器可以安装其他 Python 版本，但建议使用 Python 3.9.5 创建虚拟环境后再安装依赖。

## 安装

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
npm install
```

如果 `requirements.txt` 中固定的 PyTorch wheel 与本机 CUDA 或 CPU 环境不匹配，请根据官方 PyTorch 安装选择器替换合适版本。

## 模型目录

请将 RVC 模型放入：

```text
models/rvc/
```

系统会扫描 `.pth` 文件；如果存在同名或同前缀的 `.index` 文件，会自动配对使用。

## RVC 推理命令

本项目默认使用官方完整包自带的 RVC 运行环境，避免把 RVC 的旧依赖混入当前 FastAPI 后端环境。

当前默认连接：

```text
E:\RVC1006Nvidia\
```

如果该目录存在，并且其中包含 `runtime\python.exe`，后端启动时会自动生成 `RVC_INFER_COMMAND`。推理时会使用：

```text
E:\RVC1006Nvidia\runtime\python.exe
```

并调用本项目的桥接脚本：

```text
tools/rvc_cli_bridge.py
```

如果你的官方 RVC 完整包放在其他位置，可以启动后端前设置：

```powershell
$env:RVC_ROOT = "E:\你的\RVC\目录"
python backend_api.py
```

也可以完全手动设置 `RVC_INFER_COMMAND` 环境变量覆盖自动配置。

默认配置相当于：

```powershell
$env:RVC_EXTERNAL_FALLBACK = "1"
python backend_api.py
```

如果你想尝试把 RVC 直接导入当前后端进程，可以设置：

```powershell
$env:RVC_EMBEDDED = "1"
python backend_api.py
```

但不推荐默认使用内嵌模式，因为 RVC 的依赖栈和当前 FastAPI 后端可能冲突。

健康检查接口会显示当前状态：

```text
http://127.0.0.1:7860/api/health
```

可用占位符：

- `{input}`：预处理后的输入 wav。
- `{output}`：匿名化输出 wav 路径。
- `{model}`：选中的 `.pth` 模型路径。
- `{index}`：选中的 `.index` 路径；没有时为空字符串。
- `{transpose}`：变调参数。
- `{f0_method}`：F0 提取方法，默认 `rmvpe`。

示例：

```powershell
$env:RVC_INFER_COMMAND = 'python path\to\rvc_cli.py --input "{input}" --output "{output}" --model "{model}" --index "{index}" --transpose {transpose} --f0-method {f0_method}'
python backend_api.py
```

仅测试流程时，可以开启 passthrough：

```powershell
$env:RVC_ALLOW_PASSTHROUGH = "1"
```

注意：passthrough 只是复制预处理后的音频，不会匿名化声纹，不能用于隐私演示结论。

## 实时隐私网关

实时链路采用适合文件式 RVC 推理的“准实时”工程方案：

- 患者端麦克风默认每 `800ms` 发送一个音频分片。
- FastAPI 事件循环不直接执行 RVC。
- 实时 RVC 运行在专用 `ThreadPoolExecutor` 中。
- 全局 GPU 并发默认限制为 `1`，避免多个 RVC 子进程抢占显存。
- 医生端使用 Web Audio 播放队列，默认约 `1500ms` 初始缓冲。
- 相邻分片播放时使用短交叉淡入淡出，减少爆音和“机关枪式”卡顿。
- 队列积压时执行背压，丢弃最旧未处理分片，避免延迟无限增长。

可调环境变量：

```powershell
$env:RVC_REALTIME_WORKERS = "2"
$env:RVC_REALTIME_GPU_LIMIT = "1"
$env:RVC_REALTIME_QUEUE_MAX = "6"
$env:RVC_REALTIME_TIMEOUT_SECONDS = "60"
```

## ASR 文本验证

ASR 文本验证默认关闭，因为 `faster-whisper` 首次使用会从 Hugging Face 下载模型，例如 `Systran/faster-whisper-small`。如果当前网络无法访问 Hugging Face，转换流程可能会在 ASR 阶段报错或变慢。

如需启用文本验证，可以在前端勾选：

```text
Run ASR text check
```

也可以启动后端前设置：

```powershell
$env:RVC_ENABLE_ASR = "1"
python backend_api.py
```

如果没有代理或本地缓存，建议保持关闭；RVC 匿名音频转换和声纹相似度评估不依赖 ASR。

## RVC 日志

实时麦克风模式下，后端会把 RVC 推理日志同步保存到：

```text
rvc_logs/
```

你也可以通过接口读取最近日志：

```text
GET /api/rvc-logs/{sessionId}?lines=200
```

前端实时面板里也有 `Refresh logs` 按钮可以直接查看最近输出。

## 运行开发版

先启动后端：

```powershell
python backend_api.py
```

另开一个终端启动前端：

```powershell
npm run dev
```

浏览器打开：

```text
http://127.0.0.1:5173
```

## 桌面程序

开发模式运行 Electron：

```powershell
python backend_api.py
npm run desktop:dev
```

打包 Windows 便携程序：

```powershell
npm run dist
```

打包结果会生成在 `dist/` 目录下。

## 备用 Gradio 入口

`app.py` 保留为简单备用 UI。如需使用，请额外安装兼容版本的 Gradio：

```powershell
python -m pip install "gradio>=3.50,<4.45"
python app.py
```

## 隐私说明

V1 版本用于论文、项目展示和工程验证，不等同于真实医疗生产系统。若用于真实心理导诊场景，还需要补充用户鉴权、端到端审计、数据留存策略、医生资质流程、危机干预机制和合规评估。
