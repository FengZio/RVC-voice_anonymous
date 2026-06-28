import os

BT = chr(96)
DL = chr(36)
SQ = chr(39)
NL = chr(10)

BP = '{'  # brace for JSX
BC = '}'  # closing brace

filepath = r'E:\RVC-voice_anonymous\frontend\src\pages\PatientDashboard\index.jsx'

# We'll build incrementally
lines = []
def L(text):
    lines.append(text)

L("import React from 'react';")
L("import {")
L("  CalendarDays,")
L("  ClipboardList,")
L("  FileUser,")
L("  HeartPulse,")
L("  Home,")
L("  MessageSquare,")
L("  ShieldCheck,")
L("  Send,")
L("  Mic,")
L("  Sparkles,")
L("  Stethoscope,")
L("  UserRound,")
L("} from 'lucide-react';")
L("import { StatCard } from '../../components/StatCard.jsx';")
L("import { StatusBadge } from '../../components/StatusBadge.jsx';")
L("import { WorkspaceShell } from '../../components/WorkspaceShell.jsx';")
L("import { SectionCard } from '../../components/SectionCard.jsx';")
L("import { apiForm, apiJson } from '../../utils/api.js';")
L("import { STORAGE_TOKEN_KEY } from '../../constants.js';")
L("import styles from './PatientDashboard.module.css';")
L("")
L("const MODULES = [")
L("  { key: 'overview', label: '总览', hint: '今日状态与关键入口', icon: Home },")
L("  { key: 'questionnaire', label: '问卷评估', hint: '量表、分值与建议', icon: ShieldCheck },")
L("  { key: 'appointment', label: '咨询预约', hint: '医生筛选、预约与聊天', icon: CalendarDays },")
L("  { key: 'chat', label: '聊天详情', hint: '会话内容与继续预约', icon: MessageSquare },")
L("  { key: 'records', label: '个人中心', hint: '诊疗记录与趋势', icon: FileUser },")
L("];")
L("")
L("const MODE_OPTIONS = ['现场面诊', '视频门诊', '电话咨询'];")
L("")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(NL.join(lines))

print(f'Wrote {len(lines)} lines ({os.path.getsize(filepath)} bytes)')
