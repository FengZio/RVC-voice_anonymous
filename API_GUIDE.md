# SerenePath 前端功能总结与后端 API 开发指导

> 版本：2026-06-24 | 基于 `E:\RVC-voice_anonymous` 项目当前代码

---

## 一、项目概述

SerenePath 是一个在线心理健康平台，前端基于 React/Vite，后端基于 FastAPI + SQLite。系统支持三种角色：**患者（patient）**、**医生（doctor）**、**管理员（admin）**。

### 前端技术栈

- React 18 + Vite
- CSS Modules（`.module.css`）
- lucide-react（图标）
- WebSocket（RVC 实时变声）

### 前端文件结构

| 路径 | 说明 |
|------|------|
| `frontend/src/main.jsx` | 入口，路由分发（73行） |
| `frontend/src/constants.js` | 存储键名、API 地址 |
| `frontend/src/utils/api.js` | apiForm / apiJson 工具 |
| `frontend/src/utils/audio.js` | WAV 编码工具 |
| `frontend/src/pages/AuthScreen/index.jsx` | 登录/注册页面 |
| `frontend/src/pages/PatientDashboard/index.jsx` | 患者端（~39KB） |
| `frontend/src/pages/PatientDashboard/PatientDashboard.module.css` | 患者端样式 |
| `frontend/src/pages/DoctorDashboard/index.jsx` | 医生端（~19KB） |
| `frontend/src/pages/DoctorDashboard/DoctorDashboard.module.css` | 医生端样式 |
| `frontend/src/pages/AdminDashboard/index.jsx` | 管理端（~8KB） |
| `frontend/src/pages/AdminDashboard/AdminDashboard.module.css` | 管理端样式 |
| `frontend/src/patient/patientData.js` | 患者端 Mock 数据 |
| `frontend/src/components/*` | 通用组件 |

---

## 二、现有后端 API 端点完整清单

### 2.1 系统

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查，返回 RVC 嵌入状态 |

### 2.2 认证（auth）

| 方法 | 路径 | 参数 | 说明 |
|------|------|------|------|
| POST | `/api/auth/register` | `username`, `password`, `display_name`, `role`, `title`(opt), `department`(opt) | 注册 |
| POST | `/api/auth/login` | `username`, `password` | 登录 |
| GET | `/api/auth/me` | `token`(query) | 获取当前用户信息 |
| POST | `/api/auth/logout` | `token` | 登出 |

### 2.3 患者端

| 方法 | 路径 | 参数 | 说明 |
|------|------|------|------|
| GET | `/api/patient/summary` | `token` | 患者总览数据 |
| GET | `/api/questionnaires` | — | 问卷列表 |
| GET | `/api/questionnaires/{id}` | — | 问卷详情（含题目） |
| POST | `/api/questionnaires/{id}/submissions` | `token`, `answers`(JSON), `score`(opt) | 提交问卷 |
| GET | `/api/doctors` | — | 医生列表 |
| GET | `/api/doctors/{id}` | — | 医生详情 |
| GET | `/api/appointments` | `token` | 预约列表 |
| POST | `/api/appointments` | `token`, `doctor_id`, `mode`, `appointment_time`, `reason`(opt) | 创建预约 |
| GET | `/api/chats` | `token` | 聊天列表 |
| GET | `/api/chats/{id}` | `token` | 聊天详情（含消息） |
| POST | `/api/chats/{id}/messages` | `token`, `content` | 发送消息 |
| GET | `/api/patient/records` | `token` | 诊疗记录列表 |
| GET | `/api/patient/records/{id}` | `token` | 诊疗记录详情 |

### 2.4 医生端

| 方法 | 路径 | 参数 | 说明 |
|------|------|------|------|
| GET | `/api/doctor/summary` | `token` | 医生总览（含仪表盘数据） |
| GET | `/api/doctor/queue` | `token` | 待接诊队列 |
| GET | `/api/doctor/records` | `token` | 患者诊疗记录 |
| GET | `/api/doctor/schedule` | `token` | 当前排班 |
| GET | `/api/doctor/chats` | `token` | 医生聊天列表 |
| POST | `/api/doctor/chats/{id}/messages` | `token`, `content` | 医生发送消息 |
| GET | `/api/doctor/analytics` | `token` | 统计数据（完成率、响应时间等） |

### 2.5 管理端

| 方法 | 路径 | 参数 | 说明 |
|------|------|------|------|
| GET | `/api/admin/summary` | `token` | 管理总览 |
| GET | `/api/admin/reviews` | `token` | 资质审核列表 |
| POST | `/api/admin/reviews/{id}/approve` | `token` | 审核通过 |
| POST | `/api/admin/reviews/{id}/reject` | `token` | 审核驳回 |
| GET | `/api/admin/knowledge` | `token` | 知识库列表 |
| PUT | `/api/admin/knowledge` | `token`, `title`, `content`, `category` | 更新知识库 |
| GET | `/api/admin/config` | `token` | 系统配置 |
| PUT | `/api/admin/config` | `token`, `riskThreshold`, `allowAnonymousAudio`, `allowSelfBooking` | 更新配置 |

### 2.6 RVC 变声

| 方法 | 路径 | 参数 | 说明 |
|------|------|------|------|
| GET | `/api/models` | — | RVC 模型列表 |
| POST | `/api/realtime/prewarm` | `model`, `transpose`, `f0_method` | 预热实时会话 |
| POST | `/api/convert` | `audio`(file), `model`, `transpose`, `use_vocal_extract`, `f0_method`, `run_asr` | 离线转换 |
| WebSocket | `/api/realtime` | — | 实时变声流 |
| GET | `/api/rvc-logs/{session_id}` | — | RVC 日志 |
| GET | `/api/files/{file_path}` | — | 静态文件服务 |

---

## 三、前端页面功能详细说明

### 3.1 患者端 — 5 个模块

#### 模块 1：总览（overview）
- **Hero 区域**：展示当前评估得分 + 进度条 + 风险等级徽章 + AI 建议
- **快速统计卡片**（4个可点击）：综合评分、最近评估、预约状态、下次复诊 — 点击可直达对应模块
- **底部双卡片**：历史问卷摘要 + 快捷操作按钮（填写问卷 / 预约咨询）
- **调用的 API**：`/api/patient/summary`

#### 模块 2：问卷评估（questionnaire）
- **左侧**：问卷类型卡片列表（PHQ-9 / GAD-7 / SDS / 应激量表），可切换
- **右侧**：问卷表单
  - 计分进度条（颜色随分数变化：绿→黄→红）
  - 每题：序号圆标 + 题目文本 + Range 滑块（0-4）+ 分数徽章（颜色编码）
  - 刻度标签：从不 / 偶尔 / 经常 / 频繁 / 总是
  - 提交按钮 + 帮助文本
- **结果面板**：评估结论卡片（综合得分 + 风险等级 + 建议文本）+ 历史记录列表
- **调用的 API**：`/api/questionnaires`、`/api/questionnaires/{id}`、`/api/questionnaires/{id}/submissions`

#### 模块 3：咨询预约（appointment）
- **筛选栏**：搜索医生名、科室下拉、职称筛选、排序方式
- **左侧**：医生迷你卡片列表（紧凑头像 + 姓名 + 评分 + 擅长标签）
- **右上方**：医生详情面板（满意度 + 擅长领域 + 排班 + 学历 + 个人介绍 + 患者评价 + 聊天入口按钮）
- **右下方**：预约面板
  - 就诊方式分段按钮：现场面诊 / 视频门诊 / 电话咨询
  - 日期选择器 + 时段下拉
  - 就诊原因 textarea
  - 预览行（医生名 + 就诊方式）
  - 提交按钮 + 预约数徽章
- **调用的 API**：`/api/doctors`、`/api/doctors/{id}`、`/api/appointments`（POST）

#### 模块 4：聊天详情（chat）
- **左侧主聊天区**：
  - 固定高度 580px，与右侧信息面板等高
  - 聊天气泡：医生消息（白/灰，左对齐）+ 患者消息（深青色渐变，右对齐）
  - 时间戳显示
  - 语音通话按钮（绿色渐变药丸按钮）
  - 底部输入区：textarea + 发送按钮
  - 支持 Enter 发送
- **右侧信息面板**（悬浮，等高）：
  - 医生 Profile 卡片（头像 + 姓名 + 职称 + 科室 + 评分 + 满意度）
  - 暖心提示卡片（隐私加密 / 匿名语音 / 随时预约 / 紧急热线）
  - 快速预约区 + 预约历史列表
- **调用的 API**：`/api/chats/{id}`、`/api/chats/{id}/messages`（POST）

#### 模块 5：个人中心（records）
- **左侧**：诊疗记录迷你卡片列表（标题 + 日期/医生 + 诊断标签）
- **右上方**：记录详情卡片（渐变头部 + 方案 / 处方 / 复诊 / 摘要 四宫格）
- **右下方**：档案概览（3 列大数字卡片：就诊次数 / 累计花费 / 最近报告数）
- **个人信息**：头像 + 姓名横幅 + 3 张信息卡片
- **调用的 API**：`/api/patient/records`、`/api/patient/records/{id}`

---

### 3.2 医生端 — 3 个模块

#### 模块 1：总览（overview）
整合了原"接诊工作台"和"数据看板"功能：
- **Hero 区域**：
  - 左侧：4 个统计卡片（今日预约 42 / 待评估 18 / 沟通中 11 / 风险复核 3）
  - 右侧：待处理患者计数卡片 + 匿名语音状态卡片
- **快捷统计**（4个可点击）：完成率 92% / 平均响应 4 分钟 / 风险复核 3 单 / 沟通中 11 人
- **患者队列布局**：
  - 左侧：患者卡片列表（姓名 + 备注 + 状态徽章），选中高亮
  - 右侧：选中患者详情面板（待接诊状态 / 优先复核 / 匿名语音方式 + 接诊备注 textarea）
- **底部双卡片**：实时动态 + 快捷操作按钮
- **调用的 API**：`/api/doctor/summary`、`/api/doctor/queue`、`/api/doctor/analytics`

#### 模块 2：诊疗工作流（workflow）
新版替代了原"诊疗记录"、"排版管理"、"与患者聊天"：
- **左侧 IM/音视频工作区**：
  - 顶部：患者信息 + 图文/语音通话按钮组
  - 中间：聊天气泡（患者消息 in / 医生消息 out）
  - 底部：textarea 输入 + 发送按钮
- **右侧患者画像面板**：
  - 头像 + 姓名 + 备注
  - 智能导诊报告摘要
  - 历史量表得分（GAD-7 / PHQ-9 / SDS + 分数）
  - 既往病史文字摘要
- **底部电子病历录入（EMR）**：
  - 主诉（文本输入）
  - 临床印象（文本输入）
  - 处置建议（textarea）
  - 是否需要转诊（下拉：否 / 精神科 / 睡眠门诊 / 心理咨询中心）
  - 复诊建议（文本输入）
  - 保存病历 + 暂存草稿按钮
- **需要的新 API**：见第四章

#### 模块 3：排班与服务管理（schedule-mgmt）
新版替代了原排班、聊天等模块：
- **排班日历**：
  - 2 周视图日历网格（月-火-水-木-金-土-日）
  - 日期点击选中，有排班的日期显示圆点标记
  - 周切换：← / 第 N 周 / →
  - 时段 Chip 列表（09:00-15:00，8个时段），点击切换开关
- **服务定价面板**：
  - 4 种服务类型：现场面诊(¥300) / 视频门诊(¥200) / 电话咨询(¥150) / 图文咨询(¥80)
  - 每项：服务名 + 描述 + ¥ 价格输入框
- **需要的新 API**：见第四章

---

### 3.3 管理端 — 4 个模块

#### 模块 1：总览（overview）
- 4 个统计卡片（待审核 12 / 量表条目 26 / 在线医生 8 / 系统健康 稳定）
- 系统提示卡片：匿名语音和自助预约状态
- **调用的 API**：`/api/admin/summary`

#### 模块 2：资质审核（review）
- 审核列表（待审核 / 已通过 / 待补充），选中查看详情
- 审核详情面板 + 通过 / 驳回按钮
- **调用的 API**：`/api/admin/reviews`、`/api/admin/reviews/{id}/approve`、`/api/admin/reviews/{id}/reject`

#### 模块 3：量表/知识库（knowledge）
- 知识条目列表（标题 + 分类 + 状态）
- 编辑区（分类下拉 + 标题 + 内容 textarea）
- 同步状态徽章
- **调用的 API**：`/api/admin/knowledge`（GET / PUT）

#### 模块 4：配置中心（config）
- 风险管理阈值滑块（0-1）
- 匿名语音开关
- 自助预约开关
- **调用的 API**：`/api/admin/config`（GET / PUT）

---

## 四、缺少的后端 API — 需新增

### 🔴 高优先级（前端已实现 UI，后端完全缺失）

| 方法 | 路径 | 参数 | 说明 | 对应前端模块 |
|------|------|------|------|-------------|
| GET | `/api/doctor/patients/{patient_id}/profile` | `token` | 获取患者画像（导诊报告、历史量表、既往病史） | 医生端 → 诊疗工作流 → 右侧患者画像 |
| GET | `/api/doctor/patients/{patient_id}/emr` | `token` | 获取患者电子病历 | 医生端 → 诊疗工作流 → EMR |
| POST | `/api/doctor/patients/{patient_id}/emr` | `token`, `complaint`, `impression`, `plan`, `referral`, `follow_up` | 保存/更新电子病历 | 医生端 → 诊疗工作流 → EMR |
| PUT | `/api/doctor/pricing` | `token`, `pricing`(JSON数组：`[{type, desc, price}]`) | 更新服务定价 | 医生端 → 排班与服务管理 → 服务定价 |
| PUT | `/api/doctor/schedule` | `token`, `schedule`(JSON：`{date: [slot1, slot2, ...]}`) | 更新排班时段 | 医生端 → 排班与服务管理 → 排班日历 |

### 🟡 中优先级（后端有基础路由但返回 Mock 数据）

| 方法 | 路径 | 当前状态 | 需要完善 |
|------|------|----------|----------|
| GET | `/api/doctor/queue` | 返回固定 Mock 数据 | 需从 DB 读取真实待接诊队列 |
| GET | `/api/doctor/schedule` | 返回固定 `["09:00","10:30","13:00","15:30"]` | 需读写真实排班数据 |
| GET | `/api/doctor/analytics` | 返回固定值 `{completionRate:92, ...}` | 需从 DB 计算真实统计 |

### 🟢 低优先级（前端使用 Mock 数据，建议逐步对接）

| 功能 | 当前前端数据源 | 建议后端接口 |
|------|---------------|-------------|
| 患者端-问卷 | `patientData.js` 中的 `questionnaires` 数组 | `/api/questionnaires` 已有，需确认返回格式与前端一致 |
| 患者端-医生 | `patientData.js` 中的 `doctors` 数组 | `/api/doctors` 已有，需确认字段（rating, satisfaction, schedule, education, intro, reviews, availabilities） |
| 患者端-记录 | `patientData.js` 中的 `records` 数组 | `/api/patient/records` 已有，需确认字段（title, date, doctor, diagnosis, plan, prescription, followUp, report） |
| 患者端-档案概览 | `patientData.js` 中的 `archiveSummary` | 可在 `/api/patient/records` 中附带统计 |
| 患者端-总览 | 前端本地计算 | `/api/patient/summary` 已有 |
| 医生端-患者队列 | 前端 useState 初始数据 | `/api/doctor/queue` 已有（但返回 Mock） |
| 医生端-聊天 | 前端 useState 初始数据 | `/api/doctor/chats` 已有（但前端未对接） |
| 管理端-审核 | 前端 useState 初始数据 | `/api/admin/reviews` 已有 |

---

## 五、数据模型建议

### 5.1 患者画像（patient_profile）

```json
{
  "patient_id": "string",
  "name": "string",
  "triage_report": "string",
  "risk_level": "低风险|轻中度|中风险|高风险",
  "historical_scores": [
    { "questionnaire": "GAD-7", "date": "2026-06-20", "score": 12, "max_score": 20 },
    { "questionnaire": "PHQ-9", "date": "2026-06-12", "score": 10, "max_score": 20 }
  ],
  "medical_history": "string"
}
```

### 5.2 电子病历（emr）

```json
{
  "id": "string",
  "patient_id": "string",
  "doctor_id": "string",
  "complaint": "string",
  "impression": "string",
  "plan": "string",
  "referral": "否|精神科|睡眠门诊|心理咨询中心",
  "follow_up": "string",
  "status": "草稿|已保存",
  "created_at": "ISO8601",
  "updated_at": "ISO8601"
}
```

### 5.3 排班（doctor_schedule）

```json
{
  "doctor_id": "string",
  "date": "2026-06-24",
  "slots": ["09:00", "09:30", "10:00", "14:00", "14:30"]
}
```

### 5.4 服务定价（service_pricing）

```json
{
  "doctor_id": "string",
  "items": [
    { "type": "现场面诊", "desc": "线下门诊咨询", "price": 300 },
    { "type": "视频门诊", "desc": "远程视频咨询", "price": 200 },
    { "type": "电话咨询", "desc": "电话沟通（30分钟）", "price": 150 },
    { "type": "图文咨询", "desc": "在线图文回复", "price": 80 }
  ]
}
```

---

## 六、前端 API 调用方式

所有请求通过 `utils/api.js` 中的两个函数发出：

```js
import { apiForm, apiJson } from './utils/api.js';

// FormData 请求（POST/PUT）
apiForm('/api/auth/login', formData)
  .then(data => { /* data.user, data.token */ })
  .catch(err => { /* 错误处理 */ });

// JSON 请求（GET）
apiJson(`/api/auth/me?token=${encodeURIComponent(token)}`)
  .then(data => { /* data.user */ })
  .catch(err => { /* 错误处理 */ });
```

**Token 传递**：GET 请求通过 URL query `?token=xxx`，POST 请求通过 FormData `token` 字段。

---

## 七、设计规范速查

| 元素 | 规范 |
|------|------|
| 主色 | `#2f6277` / `#4a7b90`（深青） |
| 成功色 | `#5a9e6f` |
| 文字 | `#154c60`（标题）/ `#2f4350`（正文）/ `#7a8b94`（辅助） |
| 圆角 | 16px（面板）/ 12px（按钮）/ 8px（输入框） |
| 渐变按钮 | `linear-gradient(135deg, #2f6277, #4a7b90)` |
| 面板边框 | `1px solid rgba(192,199,204,0.5)` |
| 面板头部 | `linear-gradient(135deg, #f0f7f9, #f7fafb)` |
| 滚动条 | 宽 4px，thumb `rgba(192,199,204,0.5)`，圆角 2px |
| 过渡 | `all 0.2s ease` / hover `translateY(-1px)` |
