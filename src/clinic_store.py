from __future__ import annotations

import json
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional


ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT_DIR / "data"
DB_PATH = DATA_DIR / "serenepath.db"


def _connect() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False)


def _loads(value: Optional[str], default: Any) -> Any:
    if not value:
        return default
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return default


DEFAULT_QUESTIONNAIRES = [
    {
        "id": "phq9",
        "name": "PHQ-9 抑郁筛查量表",
        "tag": "抑郁",
        "items": 9,
        "scale": "0-4 分",
        "description": "国际通用的抑郁症状快速筛查工具，用于评估近两周情绪状态。",
        "questions": [
            "做事时提不起劲或没有兴趣",
            "感到心情低落、沮丧或绝望",
            "入睡困难、睡不安稳或睡眠过多",
            "感觉疲倦或没有活力",
            "食欲不振或吃太多",
            "觉得自己很糟——或觉得自己很失败，或让自己或家人失望",
            "对事物专注有困难，例如阅读报纸或看电视时",
            "动作或说话速度缓慢到别人已经觉察？或正好相反——变得比平日更烦躁或坐立不安，走来走去",
            "有不如死掉或用某种方式伤害自己的念头",
        ],
        "advice": "总分≥15 建议尽快就诊；总分 10-14 可结合临床判断；总分 5-9 为轻度，建议观察并随访。",
    },
    {
        "id": "gad7",
        "name": "GAD-7 广泛性焦虑筛查量表",
        "tag": "焦虑",
        "items": 7,
        "scale": "0-4 分",
        "description": "用于识别广泛性焦虑障碍及其严重程度，评估近两周状态。",
        "questions": [
            "感觉紧张、焦虑或烦躁",
            "无法停止或控制担忧",
            "对各种各样的事情担忧过多",
            "很难放松下来",
            "由于不安而无法静坐",
            "变得容易烦恼或急躁",
            "感到害怕，好像可怕的事情会发生",
        ],
        "advice": "总分≥15 提示中重度焦虑，建议尽快就诊；总分 10-14 为中度，可考虑心理干预；总分 5-9 为轻度，建议随访。",
    },
    {
        "id": "isi",
        "name": "ISI 失眠严重程度指数",
        "tag": "睡眠",
        "items": 7,
        "scale": "0-4 分",
        "description": "评估近两周失眠的严重程度及其对日间功能的影响。",
        "questions": [
            "入睡困难的程度",
            "维持睡眠困难（夜间易醒或早醒）",
            "早醒且无法再入睡的问题",
            "对当前睡眠模式的满意程度",
            "睡眠问题在多大程度上干扰了日间功能（如疲劳、注意力、情绪等）",
            "睡眠问题在多大程度上被他人注意到并影响了生活质量",
            "因睡眠问题而感到担忧或痛苦的程度",
        ],
        "advice": "总分≥22 为重度失眠；15-21 为中度；8-14 为轻度；0-7 为无明显失眠。中重度建议就诊睡眠专科。",
    },
    {
        "id": "pcl6",
        "name": "PCL-6 创伤后应激障碍简版筛查",
        "tag": "创伤",
        "items": 6,
        "scale": "0-4 分",
        "description": "简版创伤后应激障碍筛查，评估过去一个月与创伤经历相关的症状。",
        "questions": [
            "反复出现关于创伤经历的不安回忆、想法或画面",
            "当某些事物让你想起创伤经历时，感到非常不安",
            "回避让你想起创伤经历的活动或情境",
            "感到与他人疏远或隔阂",
            "容易发怒或出现愤怒爆发",
            "过度警觉、戒备或处于紧张状态",
        ],
        "advice": "总分≥14 建议进一步专业评估；如伴自杀念头或严重功能损害，应立即就诊。",
    },
    {
        "id": "sds",
        "name": "SDS 抑郁自评量表（简版）",
        "tag": "情绪",
        "items": 10,
        "scale": "0-4 分",
        "description": "Zung 抑郁自评量表简版，评估抑郁情绪及相关躯体症状。",
        "questions": [
            "我觉得闷闷不乐、情绪低落",
            "一天中早晨的心情最好",
            "我会一阵阵哭出来或觉得想哭",
            "我晚上睡眠不好",
            "我吃得跟以前一样多",
            "我的体重在下降",
            "我的心跳比平时快",
            "我无缘无故感到疲劳",
            "我的头脑跟以前一样清楚",
            "我觉得自己是个有用且被需要的人",
        ],
        "advice": "总分标准分≥50 提示抑郁状态；建议结合临床表现综合判断，必要时转诊。",
    },
]


DEFAULT_DOCTORS = [
    {
        "id": "d1",
        "name": "林安澜",
        "department": "心理科",
        "title": "主任医师",
        "rating": 4.9,
        "satisfaction": 98,
        "specialty": "焦虑障碍、抑郁障碍、睡眠问题",
        "schedule": "周一 / 周三 / 周五 09:00-12:00",
        "intro": "擅长结合量表、访谈和长期随访制定个体化诊疗方案。",
        "education": "精神卫生硕士，省级心理治疗培训结业。",
        "experience": "18 年临床经验，长期负责门诊与住院联动管理。",
        "publications": ["《焦虑障碍门诊策略》", "《睡眠障碍综合干预》"],
        "reviews": ["沟通耐心，能把复杂问题讲清楚。", "评估细致，复诊安排很清晰。"],
        "availabilities": ["09:00", "09:30", "10:30", "11:00"],
    },
    {
        "id": "d2",
        "name": "周宁",
        "department": "心理科",
        "title": "副主任医师",
        "rating": 4.8,
        "satisfaction": 96,
        "specialty": "青少年情绪问题、亲子沟通、创伤后反应",
        "schedule": "周二 / 周四 13:30-17:00",
        "intro": "以情绪评估、家庭支持与短程心理治疗见长。",
        "education": "医学博士，完成 CBT 与家庭治疗进修。",
        "experience": "15 年临床经验，兼顾门诊与学校心理支持。",
        "publications": ["《青少年焦虑干预路径》"],
        "reviews": ["很会引导青少年表达真实感受。", "家长也能听懂，沟通顺畅。"],
        "availabilities": ["13:30", "14:00", "15:00", "16:30"],
    },
]


DEFAULT_RECORDS = [
    {
        "id": "r1",
        "patientUserId": None,
        "date": "2026-06-18",
        "doctorId": "d1",
        "title": "初诊评估",
        "diagnosis": "焦虑状态待观察",
        "plan": "建议完成 PHQ-9 与 GAD-7 复测，先做睡眠卫生干预。",
        "prescription": "短期对症用药，按需复诊。",
        "report": "已记录睡眠缩短、反复担心、工作压力上升。",
        "followUp": "2 周后复诊，必要时提前联系。",
    },
    {
        "id": "r2",
        "patientUserId": None,
        "date": "2026-05-27",
        "doctorId": "d2",
        "title": "复诊随访",
        "diagnosis": "情绪波动改善中",
        "plan": "继续心理治疗，增加家庭沟通支持。",
        "prescription": "维持原方案，逐步减量观察。",
        "report": "自测分数下降，睡眠略有好转。",
        "followUp": "4 周后查看趋势。",
    },
]


DEFAULT_REVIEWS = [
    {"id": "rev1", "name": "林安澜", "status": "待审核", "note": "执业资质、头像和科室信息", "tone": "warning"},
    {"id": "rev2", "name": "周宁", "status": "已通过", "note": "证照完整，排班配置正确", "tone": "success"},
]


DEFAULT_CONFIG = {
    "riskThreshold": 0.65,
    "allowAnonymousAudio": True,
    "allowSelfBooking": True,
}


def initialize_clinic_db() -> None:
    with _connect() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS questionnaires (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                tag TEXT NOT NULL,
                items INTEGER NOT NULL,
                scale TEXT NOT NULL,
                description TEXT NOT NULL,
                questions_json TEXT NOT NULL,
                advice TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS questionnaire_submissions (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                questionnaire_id TEXT NOT NULL,
                score INTEGER NOT NULL,
                max_score INTEGER NOT NULL,
                risk TEXT NOT NULL,
                answers_json TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS doctors (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                department TEXT NOT NULL,
                title TEXT NOT NULL,
                rating REAL NOT NULL,
                satisfaction INTEGER NOT NULL,
                specialty TEXT NOT NULL,
                schedule TEXT NOT NULL,
                intro TEXT NOT NULL,
                education TEXT NOT NULL,
                experience TEXT NOT NULL,
                publications_json TEXT NOT NULL,
                reviews_json TEXT NOT NULL,
                availabilities_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS appointments (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                doctor_id TEXT NOT NULL,
                mode TEXT NOT NULL,
                appointment_date TEXT NOT NULL,
                appointment_slot TEXT NOT NULL,
                reason TEXT NOT NULL,
                status TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS chats (
                id TEXT PRIMARY KEY,
                patient_user_id TEXT NOT NULL,
                doctor_id TEXT NOT NULL,
                status TEXT NOT NULL,
                last_message TEXT NOT NULL,
                last_message_at TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS chat_messages (
                id TEXT PRIMARY KEY,
                chat_id TEXT NOT NULL,
                sender_role TEXT NOT NULL,
                sender_name TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS records (
                id TEXT PRIMARY KEY,
                user_id TEXT,
                doctor_id TEXT NOT NULL,
                date TEXT NOT NULL,
                title TEXT NOT NULL,
                diagnosis TEXT NOT NULL,
                plan TEXT NOT NULL,
                prescription TEXT NOT NULL,
                report TEXT NOT NULL,
                follow_up TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS reviews (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                status TEXT NOT NULL,
                note TEXT NOT NULL,
                tone TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS knowledge_items (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                category TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS system_config (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS patient_profile (
                patient_id TEXT PRIMARY KEY,
                triage_report TEXT NOT NULL,
                risk_level TEXT NOT NULL,
                historical_scores_json TEXT NOT NULL,
                medical_history TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS emr (
                id TEXT PRIMARY KEY,
                patient_id TEXT NOT NULL,
                doctor_id TEXT NOT NULL,
                complaint TEXT NOT NULL,
                impression TEXT NOT NULL,
                plan TEXT NOT NULL,
                referral TEXT NOT NULL,
                follow_up TEXT NOT NULL,
                status TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS doctor_pricing (
                doctor_id TEXT PRIMARY KEY,
                items_json TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS doctor_schedule (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                doctor_id TEXT NOT NULL,
                date TEXT NOT NULL,
                slots_json TEXT NOT NULL,
                UNIQUE(doctor_id, date)
            );
            """
        )
        _seed_if_empty(conn)


def _seed_if_empty(conn: sqlite3.Connection) -> None:
    now = _utc_now()
    if not conn.execute("SELECT 1 FROM questionnaires LIMIT 1").fetchone():
        for item in DEFAULT_QUESTIONNAIRES:
            conn.execute(
                """
                INSERT INTO questionnaires (id, name, tag, items, scale, description, questions_json, advice, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    item["id"],
                    item["name"],
                    item["tag"],
                    item["items"],
                    item["scale"],
                    item["description"],
                    _json(item["questions"]),
                    item["advice"],
                    now,
                    now,
                ),
            )

    if not conn.execute("SELECT 1 FROM doctors LIMIT 1").fetchone():
        for item in DEFAULT_DOCTORS:
            conn.execute(
                """
                INSERT INTO doctors (id, name, department, title, rating, satisfaction, specialty, schedule, intro, education, experience, publications_json, reviews_json, availabilities_json, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    item["id"],
                    item["name"],
                    item["department"],
                    item["title"],
                    item["rating"],
                    item["satisfaction"],
                    item["specialty"],
                    item["schedule"],
                    item["intro"],
                    item["education"],
                    item["experience"],
                    _json(item["publications"]),
                    _json(item["reviews"]),
                    _json(item["availabilities"]),
                    now,
                    now,
                ),
            )

    if not conn.execute("SELECT 1 FROM records LIMIT 1").fetchone():
        for item in DEFAULT_RECORDS:
            conn.execute(
                """
                INSERT INTO records (id, user_id, doctor_id, date, title, diagnosis, plan, prescription, report, follow_up, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    item["id"],
                    item["patientUserId"],
                    item["doctorId"],
                    item["date"],
                    item["title"],
                    item["diagnosis"],
                    item["plan"],
                    item["prescription"],
                    item["report"],
                    item["followUp"],
                    now,
                    now,
                ),
            )

    if not conn.execute("SELECT 1 FROM reviews LIMIT 1").fetchone():
        for item in DEFAULT_REVIEWS:
            conn.execute(
                """
                INSERT INTO reviews (id, name, status, note, tone, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (item["id"], item["name"], item["status"], item["note"], item["tone"], now, now),
            )

    if not conn.execute("SELECT 1 FROM knowledge_items LIMIT 1").fetchone():
        conn.execute(
            """
            INSERT INTO knowledge_items (id, title, content, category, updated_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            ("k1", "首诊导诊规则", "先问卷，再预约，再进入医生沟通。", "导诊", now),
        )

    if not conn.execute("SELECT 1 FROM system_config LIMIT 1").fetchone():
        for key, value in DEFAULT_CONFIG.items():
            conn.execute(
                "INSERT INTO system_config (key, value, updated_at) VALUES (?, ?, ?)",
                (key, _json(value), now),
            )


def _ensure_patient_profile(conn, patient_id, now):
    existing = conn.execute("SELECT 1 FROM patient_profile WHERE patient_id = ?", (patient_id,)).fetchone()
    if not existing:
        conn.execute(
            "INSERT INTO patient_profile (patient_id, triage_report, risk_level, historical_scores_json, medical_history, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (patient_id, "", "低风险", _json([]), "", now, now),
        )


def _fetch_all(conn: sqlite3.Connection, query: str, params: Iterable[Any] = ()) -> List[sqlite3.Row]:
    return list(conn.execute(query, tuple(params)).fetchall())


def questionnaire_rows() -> List[Dict[str, Any]]:
    with _connect() as conn:
        rows = _fetch_all(conn, "SELECT * FROM questionnaires ORDER BY created_at DESC")
        return [
            {
                "id": row["id"],
                "name": row["name"],
                "tag": row["tag"],
                "items": row["items"],
                "scale": row["scale"],
                "description": row["description"],
                "questions": _loads(row["questions_json"], []),
                "advice": row["advice"],
                "createdAt": row["created_at"],
                "updatedAt": row["updated_at"],
            }
            for row in rows
        ]


def questionnaire_row(questionnaire_id: str) -> Dict[str, Any]:
    with _connect() as conn:
        row = conn.execute("SELECT * FROM questionnaires WHERE id = ?", (questionnaire_id,)).fetchone()
        if not row:
            raise ValueError("Questionnaire not found.")
        return {
            "id": row["id"],
            "name": row["name"],
            "tag": row["tag"],
            "items": row["items"],
            "scale": row["scale"],
            "description": row["description"],
            "questions": _loads(row["questions_json"], []),
            "advice": row["advice"],
            "createdAt": row["created_at"],
            "updatedAt": row["updated_at"],
        }


def doctors_rows() -> List[Dict[str, Any]]:
    with _connect() as conn:
        rows = _fetch_all(conn, """
            SELECT d.*, u.id AS user_id
            FROM doctors d
            LEFT JOIN users u ON d.id = u.id AND u.role = 'doctor'
            ORDER BY d.rating DESC, d.name ASC
        """)
        return [
            {
                "id": row["id"],
                "userId": row["user_id"] or "",
                "name": row["name"],
                "department": row["department"],
                "title": row["title"],
                "rating": row["rating"],
                "satisfaction": row["satisfaction"],
                "specialty": row["specialty"],
                "schedule": row["schedule"],
                "intro": row["intro"],
                "education": row["education"],
                "experience": row["experience"],
                "publications": _loads(row["publications_json"], []),
                "reviews": _loads(row["reviews_json"], []),
                "availabilities": _loads(row["availabilities_json"], []),
                "createdAt": row["created_at"],
                "updatedAt": row["updated_at"],
            }
            for row in rows
        ]


def doctor_row(doctor_id: str) -> Dict[str, Any]:
    with _connect() as conn:
        row = conn.execute("SELECT * FROM doctors WHERE id = ?", (doctor_id,)).fetchone()
        if not row:
            raise ValueError("Doctor not found.")
        return {
            "id": row["id"],
            "name": row["name"],
            "department": row["department"],
            "title": row["title"],
            "rating": row["rating"],
            "satisfaction": row["satisfaction"],
            "specialty": row["specialty"],
            "schedule": row["schedule"],
            "intro": row["intro"],
            "education": row["education"],
            "experience": row["experience"],
            "publications": _loads(row["publications_json"], []),
            "reviews": _loads(row["reviews_json"], []),
            "availabilities": _loads(row["availabilities_json"], []),
            "createdAt": row["created_at"],
            "updatedAt": row["updated_at"],
        }


def records_rows(user_id: Optional[str] = None) -> List[Dict[str, Any]]:
    with _connect() as conn:
        if user_id:
            rows = _fetch_all(conn, "SELECT * FROM records WHERE user_id IS NULL OR user_id = ? ORDER BY date DESC", (user_id,))
        else:
            rows = _fetch_all(conn, "SELECT * FROM records ORDER BY date DESC")
        return [
            {
                "id": row["id"],
                "userId": row["user_id"],
                "doctorId": row["doctor_id"],
                "date": row["date"],
                "title": row["title"],
                "diagnosis": row["diagnosis"],
                "plan": row["plan"],
                "prescription": row["prescription"],
                "report": row["report"],
                "followUp": row["follow_up"],
                "createdAt": row["created_at"],
                "updatedAt": row["updated_at"],
            }
            for row in rows
        ]


def review_rows() -> List[Dict[str, Any]]:
    with _connect() as conn:
        rows = _fetch_all(conn, "SELECT * FROM reviews ORDER BY created_at DESC")
        return [
            {
                "id": row["id"],
                "name": row["name"],
                "status": row["status"],
                "note": row["note"],
                "tone": row["tone"],
                "createdAt": row["created_at"],
                "updatedAt": row["updated_at"],
            }
            for row in rows
        ]


def knowledge_rows() -> List[Dict[str, Any]]:
    with _connect() as conn:
        rows = _fetch_all(conn, "SELECT * FROM knowledge_items ORDER BY updated_at DESC")
        return [
            {
                "id": row["id"],
                "title": row["title"],
                "content": row["content"],
                "category": row["category"],
                "updatedAt": row["updated_at"],
            }
            for row in rows
        ]


def config_map() -> Dict[str, Any]:
    with _connect() as conn:
        rows = _fetch_all(conn, "SELECT * FROM system_config")
        result: Dict[str, Any] = {}
        for row in rows:
            result[row["key"]] = _loads(row["value"], row["value"])
        return result


def summary_payload(user_id: str, role: str) -> Dict[str, Any]:
    questionnaires = questionnaire_rows()
    doctors = doctors_rows()
    records = records_rows(user_id)
    reviews = review_rows()
    config = config_map()
    return {
        "userId": user_id,
        "role": role,
        "overview": {
            "questionnaires": len(questionnaires),
            "doctors": len(doctors),
            "records": len(records),
            "reviews": len(reviews),
        },
        "config": config,
    }


def create_questionnaire_submission(
    user_id: str,
    questionnaire_id: str,
    score: int,
    max_score: int,
    risk: str,
    answers: List[int],
) -> Dict[str, Any]:
    now = _utc_now()
    submission_id = uuid.uuid4().hex
    with _connect() as conn:
        conn.execute(
            """
            INSERT INTO questionnaire_submissions (id, user_id, questionnaire_id, score, max_score, risk, answers_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (submission_id, user_id, questionnaire_id, score, max_score, risk, _json(answers), now),
        )
    return {
        "id": submission_id,
        "userId": user_id,
        "questionnaireId": questionnaire_id,
        "score": score,
        "maxScore": max_score,
        "risk": risk,
        "answers": answers,
        "createdAt": now,
    }


def create_appointment(
    user_id: str,
    doctor_id: str,
    mode: str,
    appointment_date: str,
    appointment_slot: str,
    reason: str,
) -> Dict[str, Any]:
    now = _utc_now()
    appointment_id = uuid.uuid4().hex
    with _connect() as conn:
        conn.execute(
            """
            INSERT INTO appointments (id, user_id, doctor_id, mode, appointment_date, appointment_slot, reason, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (appointment_id, user_id, doctor_id, mode, appointment_date, appointment_slot, reason, "待确认", now, now),
        )
    return {
        "id": appointment_id,
        "userId": user_id,
        "doctorId": doctor_id,
        "mode": mode,
        "appointmentDate": appointment_date,
        "appointmentSlot": appointment_slot,
        "reason": reason,
        "status": "待确认",
        "createdAt": now,
        "updatedAt": now,
    }


def list_appointments(user_id: Optional[str] = None) -> List[Dict[str, Any]]:
    with _connect() as conn:
        if user_id:
            rows = _fetch_all(conn, "SELECT * FROM appointments WHERE user_id = ? ORDER BY created_at DESC", (user_id,))
        else:
            rows = _fetch_all(conn, "SELECT * FROM appointments ORDER BY created_at DESC")
        return [
            {
                "id": row["id"],
                "userId": row["user_id"],
                "doctorId": row["doctor_id"],
                "mode": row["mode"],
                "appointmentDate": row["appointment_date"],
                "appointmentSlot": row["appointment_slot"],
                "reason": row["reason"],
                "status": row["status"],
                "createdAt": row["created_at"],
                "updatedAt": row["updated_at"],
            }
            for row in rows
        ]



def create_chat(patient_user_id: str, doctor_id: str) -> Dict[str, Any]:
    now = _utc_now()
    chat_id = uuid.uuid4().hex
    with _connect() as conn:
        existing = conn.execute(
            "SELECT id FROM chats WHERE patient_user_id = ? AND doctor_id = ?",
            (patient_user_id, doctor_id),
        ).fetchone()
        if existing:
            return {
                "id": existing["id"],
                "patientUserId": patient_user_id,
                "doctorId": doctor_id,
                "status": "沟通中",
                "lastMessage": "",
                "lastMessageAt": now,
                "createdAt": now,
                "updatedAt": now,
                "messages": [],
            }
        conn.execute(
            """
            INSERT INTO chats (id, patient_user_id, doctor_id, status, last_message, last_message_at, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (chat_id, patient_user_id, doctor_id, "沟通中", "", now, now, now),
        )
    return {
        "id": chat_id,
        "patientUserId": patient_user_id,
        "doctorId": doctor_id,
        "status": "沟通中",
        "lastMessage": "",
        "lastMessageAt": now,
        "createdAt": now,
        "updatedAt": now,
        "messages": [],
    }


def list_chats(user_id: str, role: str) -> List[Dict[str, Any]]:
    with _connect() as conn:
        if role == "doctor":
            rows = _fetch_all(conn, """
                SELECT c.*, u.display_name AS patient_name,
                       pp.risk_level, pp.triage_report, pp.medical_history
                FROM chats c
                LEFT JOIN users u ON c.patient_user_id = u.id
                LEFT JOIN patient_profile pp ON c.patient_user_id = pp.patient_id
                WHERE c.doctor_id = ?
                ORDER BY c.updated_at DESC
            """, (user_id,))
        else:
            rows = _fetch_all(conn, """
                SELECT c.*, u.display_name AS patient_name,
                       pp.risk_level, pp.triage_report, pp.medical_history
                FROM chats c
                LEFT JOIN users u ON c.patient_user_id = u.id
                LEFT JOIN patient_profile pp ON c.patient_user_id = pp.patient_id
                WHERE c.patient_user_id = ?
                ORDER BY c.updated_at DESC
            """, (user_id,))
        return [
            {
                "id": row["id"],
                "patientUserId": row["patient_user_id"],
                "doctorId": row["doctor_id"],
                "status": row["status"],
                "lastMessage": row["last_message"],
                "lastMessageAt": row["last_message_at"],
                "createdAt": row["created_at"],
                "updatedAt": row["updated_at"],
                "patientName": row["patient_name"] or row["patient_user_id"],
                "patientRiskLevel": row["risk_level"] or "",
                "patientTriageReport": row["triage_report"] or "",
                "patientMedicalHistory": row["medical_history"] or "",
            }
            for row in rows
        ]


def chat_detail(chat_id: str) -> Dict[str, Any]:
    with _connect() as conn:
        chat = conn.execute("SELECT * FROM chats WHERE id = ?", (chat_id,)).fetchone()
        if not chat:
            raise ValueError("Chat not found.")
        messages = _fetch_all(conn, "SELECT * FROM chat_messages WHERE chat_id = ? ORDER BY created_at ASC", (chat_id,))
        return {
            "id": chat["id"],
            "patientUserId": chat["patient_user_id"],
            "doctorId": chat["doctor_id"],
            "status": chat["status"],
            "lastMessage": chat["last_message"],
            "lastMessageAt": chat["last_message_at"],
            "createdAt": chat["created_at"],
            "updatedAt": chat["updated_at"],
            "messages": [
                {
                    "id": row["id"],
                    "chatId": row["chat_id"],
                    "senderRole": row["sender_role"],
                    "senderName": row["sender_name"],
                    "content": row["content"],
                    "createdAt": row["created_at"],
                }
                for row in messages
            ],
        }


def append_chat_message(chat_id: str, sender_role: str, sender_name: str, content: str) -> Dict[str, Any]:
    now = _utc_now()
    message_id = uuid.uuid4().hex
    with _connect() as conn:
        chat = conn.execute("SELECT * FROM chats WHERE id = ?", (chat_id,)).fetchone()
        if not chat:
            raise ValueError("Chat not found.")
        conn.execute(
            """
            INSERT INTO chat_messages (id, chat_id, sender_role, sender_name, content, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (message_id, chat_id, sender_role, sender_name, content, now),
        )
        conn.execute(
            "UPDATE chats SET last_message = ?, last_message_at = ?, updated_at = ? WHERE id = ?",
            (content, now, now, chat_id),
        )
    return {
        "id": message_id,
        "chatId": chat_id,
        "senderRole": sender_role,
        "senderName": sender_name,
        "content": content,
        "createdAt": now,
    }


def doctor_summary_payload(user_id: str) -> Dict[str, Any]:
    return {
        "summary": {
            "todayAppointments": 42,
            "pendingReviews": 18,
            "chatting": 11,
            "riskChecks": 3,
        },
        "queue": [],
        "analytics": {
            "completionRate": 92,
            "avgResponseMinutes": 4,
        },
    }


def admin_summary_payload() -> Dict[str, Any]:
    return {
        "summary": {
            "pendingReviews": len(review_rows()),
            "knowledgeItems": len(knowledge_rows()),
            "doctors": len(doctors_rows()),
        }
    }

def patient_profile_get(patient_id):
    with _connect() as conn:
        row = conn.execute("SELECT * FROM patient_profile WHERE patient_id = ?", (patient_id,)).fetchone()
        if not row:
            raise ValueError("Patient profile not found.")
        return {
            "patientId": row["patient_id"],
            "triageReport": row["triage_report"],
            "riskLevel": row["risk_level"],
            "historicalScores": _loads(row["historical_scores_json"], []),
            "medicalHistory": row["medical_history"],
            "createdAt": row["created_at"],
            "updatedAt": row["updated_at"],
        }


def patient_profile_upsert(patient_id, triage_report, risk_level, historical_scores, medical_history):
    now = _utc_now()
    with _connect() as conn:
        _ensure_patient_profile(conn, patient_id, now)
        conn.execute(
            "UPDATE patient_profile SET triage_report = ?, risk_level = ?, historical_scores_json = ?, medical_history = ?, updated_at = ? WHERE patient_id = ?",
            (triage_report, risk_level, _json(historical_scores), medical_history, now, patient_id),
        )
    return patient_profile_get(patient_id)


def patient_questionnaire_submissions(patient_id: str) -> List[Dict[str, Any]]:
    """Return all questionnaire submissions for a patient."""
    with _connect() as conn:
        rows = _fetch_all(conn, """
            SELECT qs.*, q.name AS questionnaire_name, q.tag AS questionnaire_tag
            FROM questionnaire_submissions qs
            LEFT JOIN questionnaires q ON qs.questionnaire_id = q.id
            WHERE qs.user_id = ?
            ORDER BY qs.created_at DESC
        """, (patient_id,))
        return [
            {
                "id": row["id"],
                "userId": row["user_id"],
                "questionnaireId": row["questionnaire_id"],
                "questionnaireName": row["questionnaire_name"] or row["questionnaire_id"],
                "questionnaireTag": row["questionnaire_tag"] or "",
                "score": row["score"],
                "maxScore": row["max_score"],
                "risk": row["risk"],
                "answers": _loads(row["answers_json"], []),
                "createdAt": row["created_at"],
            }
            for row in rows
        ]


def patient_emrs_rows(patient_id: str) -> List[Dict[str, Any]]:
    """Return all EMR records for a patient, with doctor name joined."""
    with _connect() as conn:
        rows = _fetch_all(conn, """
            SELECT e.*, d.name AS doctor_name
            FROM emr e
            LEFT JOIN doctors d ON e.doctor_id = d.id
            WHERE e.patient_id = ?
            ORDER BY e.created_at DESC
        """, (patient_id,))
        return [
            {
                "id": row["id"],
                "patientId": row["patient_id"],
                "doctorId": row["doctor_id"],
                "doctorName": row["doctor_name"] or row["doctor_id"],
                "complaint": row["complaint"],
                "impression": row["impression"],
                "plan": row["plan"],
                "referral": row["referral"],
                "followUp": row["follow_up"],
                "status": row["status"],
                "createdAt": row["created_at"],
                "updatedAt": row["updated_at"],
            }
            for row in rows
        ]


def emr_get(patient_id, doctor_id):
    with _connect() as conn:
        row = conn.execute(
            "SELECT * FROM emr WHERE patient_id = ? AND doctor_id = ? ORDER BY updated_at DESC LIMIT 1",
            (patient_id, doctor_id),
        ).fetchone()
        if not row:
            raise ValueError("EMR not found.")
        return {
            "id": row["id"],
            "patientId": row["patient_id"],
            "doctorId": row["doctor_id"],
            "complaint": row["complaint"],
            "impression": row["impression"],
            "plan": row["plan"],
            "referral": row["referral"],
            "followUp": row["follow_up"],
            "status": row["status"],
            "createdAt": row["created_at"],
            "updatedAt": row["updated_at"],
        }


def emr_create(patient_id, doctor_id, complaint, impression, plan, referral, follow_up):
    now = _utc_now()
    emr_id = uuid.uuid4().hex
    with _connect() as conn:
        conn.execute(
            "INSERT INTO emr (id, patient_id, doctor_id, complaint, impression, plan, referral, follow_up, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (emr_id, patient_id, doctor_id, complaint, impression, plan, referral, follow_up, "已保存", now, now),
        )
    return emr_get(patient_id, doctor_id)


def doctor_pricing_get(doctor_id):
    with _connect() as conn:
        row = conn.execute("SELECT * FROM doctor_pricing WHERE doctor_id = ?", (doctor_id,)).fetchone()
        if not row:
            return {"doctorId": doctor_id, "items": [], "updatedAt": ""}
        return {
            "doctorId": row["doctor_id"],
            "items": _loads(row["items_json"], []),
            "updatedAt": row["updated_at"],
        }


def doctor_pricing_upsert(doctor_id, items):
    now = _utc_now()
    with _connect() as conn:
        existing = conn.execute("SELECT 1 FROM doctor_pricing WHERE doctor_id = ?", (doctor_id,)).fetchone()
        if existing:
            conn.execute(
                "UPDATE doctor_pricing SET items_json = ?, updated_at = ? WHERE doctor_id = ?",
                (_json(items), now, doctor_id),
            )
        else:
            conn.execute(
                "INSERT INTO doctor_pricing (doctor_id, items_json, updated_at) VALUES (?, ?, ?)",
                (doctor_id, _json(items), now),
            )
    return {"doctorId": doctor_id, "items": items, "updatedAt": now}


def doctor_schedule_get(doctor_id, date):
    with _connect() as conn:
        row = conn.execute(
            "SELECT * FROM doctor_schedule WHERE doctor_id = ? AND date = ?",
            (doctor_id, date),
        ).fetchone()
        if not row:
            return {"doctorId": doctor_id, "date": date, "slots": [], "updatedAt": ""}
        return {
            "doctorId": row["doctor_id"],
            "date": row["date"],
            "slots": _loads(row["slots_json"], []),
        }


def doctor_schedule_upsert(doctor_id, date, slots):
    with _connect() as conn:
        conn.execute(
            "INSERT INTO doctor_schedule (doctor_id, date, slots_json) VALUES (?, ?, ?) ON CONFLICT(doctor_id, date) DO UPDATE SET slots_json = excluded.slots_json",
            (doctor_id, date, _json(slots)),
        )
    return {"doctorId": doctor_id, "date": date, "slots": slots}


def doctor_queue_rows(doctor_id):
    with _connect() as conn:
        rows = _fetch_all(
            conn,
            "SELECT a.id, a.user_id, a.mode, a.appointment_date, a.appointment_slot, a.reason, a.status, u.display_name, pp.risk_level FROM appointments a LEFT JOIN users u ON a.user_id = u.id LEFT JOIN patient_profile pp ON a.user_id = pp.patient_id WHERE a.doctor_id = ? AND a.status IN ('待确认', '已确认') ORDER BY a.appointment_date ASC, a.appointment_slot ASC",
            (doctor_id,),
        )
        return [
            {
                "id": row["id"],
                "userId": row["user_id"],
                "name": row["display_name"] or row["user_id"],
                "mode": row["mode"],
                "appointmentDate": row["appointment_date"],
                "appointmentSlot": row["appointment_slot"],
                "reason": row["reason"],
                "status": row["status"],
                "riskLevel": row["risk_level"] or "低风险",
            }
            for row in rows
        ]


def doctor_analytics_payload(doctor_id):
    with _connect() as conn:
        total = conn.execute(
            "SELECT COUNT(*) FROM appointments WHERE doctor_id = ? AND status = '已完成'",
            (doctor_id,),
        ).fetchone()[0]
        pending = conn.execute(
            "SELECT COUNT(*) FROM appointments WHERE doctor_id = ? AND status IN ('待确认', '已确认')",
            (doctor_id,),
        ).fetchone()[0]
        completion_rate = int(total / (total + pending) * 100) if (total + pending) > 0 else 0
        risk_count = conn.execute(
            "SELECT COUNT(*) FROM appointments a LEFT JOIN patient_profile pp ON a.user_id = pp.patient_id WHERE a.doctor_id = ? AND pp.risk_level IN ('中风险', '高风险')",
            (doctor_id,),
        ).fetchone()[0]
        return {
            "completionRate": completion_rate,
            "avgResponseMinutes": 4,
            "riskChecks": risk_count,
        }


# ── Profile Drafts ──────────────────────────────────────────────

def get_doctor_profile(doctor_id: str) -> Dict[str, Any]:
    """Get current doctor profile from doctors table + latest pending draft."""
    doc = doctor_row(doctor_id)
    with _connect() as conn:
        draft = conn.execute(
            "SELECT * FROM profile_drafts WHERE doctor_id = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 1",
            (doctor_id,),
        ).fetchone()
    doc["pendingDraft"] = None
    if draft:
        doc["pendingDraft"] = {
            "id": draft["id"],
            "payload": _loads(draft["payload_json"], {}),
            "status": draft["status"],
            "createdAt": draft["created_at"],
        }
    return doc


def submit_profile_draft(doctor_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Doctor submits profile changes for admin review."""
    now = _utc_now()
    draft_id = uuid.uuid4().hex
    with _connect() as conn:
        # Cancel any previous pending drafts for this doctor
        conn.execute(
            "UPDATE profile_drafts SET status = 'cancelled', updated_at = ? WHERE doctor_id = ? AND status = 'pending'",
            (now, doctor_id),
        )
        conn.execute(
            """INSERT INTO profile_drafts (id, doctor_id, payload_json, status, created_at, updated_at)
               VALUES (?, ?, ?, 'pending', ?, ?)""",
            (draft_id, doctor_id, _json(payload), now, now),
        )
    return {"id": draft_id, "doctorId": doctor_id, "status": "pending", "createdAt": now}


def profile_draft_rows(status_filter: Optional[str] = None) -> List[Dict[str, Any]]:
    """Admin: list profile drafts."""
    with _connect() as conn:
        if status_filter:
            rows = _fetch_all(conn, "SELECT * FROM profile_drafts WHERE status = ? ORDER BY created_at DESC", (status_filter,))
        else:
            rows = _fetch_all(conn, "SELECT * FROM profile_drafts ORDER BY created_at DESC")
        result = []
        for row in rows:
            doctor = conn.execute("SELECT name FROM doctors WHERE id = ?", (row["doctor_id"],)).fetchone()
            result.append({
                "id": row["id"],
                "doctorId": row["doctor_id"],
                "doctorName": doctor["name"] if doctor else "未知",
                "payload": _loads(row["payload_json"], {}),
                "status": row["status"],
                "reviewedBy": row["reviewed_by"],
                "reviewNote": row["review_note"],
                "createdAt": row["created_at"],
                "updatedAt": row["updated_at"],
            })
        return result


def approve_profile_draft(draft_id: str, admin_id: str) -> Dict[str, Any]:
    """Admin approves a profile draft: apply payload to doctors table."""
    now = _utc_now()
    with _connect() as conn:
        draft = conn.execute("SELECT * FROM profile_drafts WHERE id = ?", (draft_id,)).fetchone()
        if not draft:
            raise ValueError("Draft not found.")
        if draft["status"] != "pending":
            raise ValueError("Draft is not pending.")
        payload = _loads(draft["payload_json"], {})
        doctor_id = draft["doctor_id"]

        # Build SET clause dynamically from payload
        allowed_fields = ["name", "department", "title", "specialty", "schedule", "intro", "education", "experience"]
        set_parts = []
        params = []
        for field in allowed_fields:
            if field in payload and payload[field]:
                set_parts.append(f"{field} = ?")
                params.append(payload[field])
        # publications, reviews, availabilities handled as JSON
        for json_field in ["publications", "reviews", "availabilities"]:
            if json_field in payload:
                col = f"{json_field}_json"
                set_parts.append(f"{col} = ?")
                params.append(_json(payload[json_field]))

        if set_parts:
            set_parts.append("updated_at = ?")
            params.append(now)
            params.append(doctor_id)
            conn.execute(f"UPDATE doctors SET {', '.join(set_parts)} WHERE id = ?", params)

        conn.execute(
            "UPDATE profile_drafts SET status = 'approved', reviewed_by = ?, updated_at = ? WHERE id = ?",
            (admin_id, now, draft_id),
        )
    return {"id": draft_id, "doctorId": doctor_id, "status": "approved", "appliedFields": set_parts[:len(set_parts)-1]}


def reject_profile_draft(draft_id: str, admin_id: str, note: str = "") -> Dict[str, Any]:
    """Admin rejects a profile draft."""
    now = _utc_now()
    with _connect() as conn:
        draft = conn.execute("SELECT * FROM profile_drafts WHERE id = ?", (draft_id,)).fetchone()
        if not draft:
            raise ValueError("Draft not found.")
        conn.execute(
            "UPDATE profile_drafts SET status = 'rejected', reviewed_by = ?, review_note = ?, updated_at = ? WHERE id = ?",
            (admin_id, note, now, draft_id),
        )
    return {"id": draft_id, "doctorId": draft["doctor_id"], "status": "rejected"}
