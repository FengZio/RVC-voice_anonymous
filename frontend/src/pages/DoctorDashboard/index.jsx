import React from 'react';
import {
  AlertTriangle,
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  MessageSquare,
  ShieldCheck,
  Send,
  Users,
  UserRoundPen,
  Waves,
} from 'lucide-react';
import { SectionCard } from '../../components/SectionCard.jsx';
import { StatCard } from '../../components/StatCard.jsx';
import { StatusBadge } from '../../components/StatusBadge.jsx';
import { WorkspaceShell } from '../../components/WorkspaceShell.jsx';
import styles from './DoctorDashboard.module.css';
import { apiForm, apiJson } from '../../utils/api.js';
import { STORAGE_TOKEN_KEY } from '../../constants.js';
import { WebRTCCall } from '../../components/WebRTCCall.jsx';

const MODULES = [
  { key: 'overview', label: '总览', hint: '今日导诊与接诊', icon: LayoutDashboard },
  { key: 'workflow', label: '诊疗工作流', hint: 'IM / 音视频 / 电子病历', icon: ClipboardList },
  { key: 'schedule-mgmt', label: '排班与服务管理', hint: '排班日历与定价', icon: CalendarDays },
  { key: 'profile', label: '个人信息', hint: '补充专业资料', icon: UserRoundPen },
];
const INITIAL_PATIENTS = [];

const SCHEDULE = [];

export function DoctorDashboard({ user, onLogout }) {
  const [activeModule, setActiveModule] = React.useState('overview');
  const [patients, setPatients] = React.useState(INITIAL_PATIENTS);
  const [selectedPatientId, setSelectedPatientId] = React.useState(INITIAL_PATIENTS[0]?.id || '');
  const [reportNote, setReportNote] = React.useState('建议先完成初评，再进入简短干预。');
  const [scheduleSlots, setScheduleSlots] = React.useState(SCHEDULE);
  const [chatPatientId, setChatPatientId] = React.useState(INITIAL_PATIENTS[0]?.id || '');
  const [chatMessage, setChatMessage] = React.useState('');
  const [chatStatus, setChatStatus] = React.useState('沟通中');
  const [workflowEmr, setWorkflowEmr] = React.useState({ complaint: '', impression: '', plan: '', referral: '否', followUp: '' });
  const [patientAssessments, setPatientAssessments] = React.useState([]);
  // Chat state for workflow
  const [doctorChatList, setDoctorChatList] = React.useState([]);
  const [workflowMessages, setWorkflowMessages] = React.useState([]);
  const [workflowChatId, setWorkflowChatId] = React.useState('');
  const workflowPollRef = React.useRef(null);
  const workflowBodyRef = React.useRef(null);
  // Schedule management state
  const [idleKey, setIdleKey] = React.useState(0);
  const webrtcRef = React.useRef(null);
  const [profileData, setProfileData] = React.useState(null);
  const [profileForm, setProfileForm] = React.useState({ name: "", department: "", title: "", specialty: "", schedule: "", intro: "", education: "", experience: "", publications: "", reviews: "", availabilities: "" });
  const [profileSubmitStatus, setProfileSubmitStatus] = React.useState("");
  const [calWeek, setCalWeek] = React.useState(1);
  const today = new Date();
  const calDays = React.useMemo(() => {
    const start = new Date(today);
    start.setDate(start.getDate() - start.getDay() + 1 + (calWeek - 1) * 7);
    const days = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const ds = d.toISOString().slice(0, 10);
      days.push({
        date: ds,
        label: d.getDate(),
        active: true,
        current: true,
        hasSlots: i < 10,
      });
    }
    return days;
  }, [calWeek]);

  const [calSelected, setCalSelected] = React.useState(today.toISOString().slice(0, 10));
  const defaultSlots = ['09:00', '09:30', '10:00', '10:30', '11:00', '14:00', '14:30', '15:00'];
  const [servicePrices, setServicePrices] = React.useState([
    { type: '现场面诊', desc: '线下门诊咨询', price: 300 },
    { type: '视频门诊', desc: '远程视频咨询', price: 200 },
    { type: '电话咨询', desc: '电话沟通（30分钟）', price: 150 },
    { type: '图文咨询', desc: '在线图文回复', price: 80 },
  ]);



  const [loading, setLoading] = React.useState(true);
  const token = React.useMemo(function() { return localStorage.getItem(STORAGE_TOKEN_KEY) || ''; }, []);
  const [analyticsData, setAnalyticsData] = React.useState({ completionRate: 0, avgResponseMinutes: 0, riskChecks: 0 });

  React.useEffect(function() {
    if (!token) return;
    Promise.all([
      apiJson('/api/doctor/queue?token=' + encodeURIComponent(token)).then(function(d) { return d.queue || []; }),
      apiJson('/api/doctor/analytics?token=' + encodeURIComponent(token)).then(function(d) { return d.analytics || {}; }),
      apiJson('/api/doctor/schedule?token=' + encodeURIComponent(token)).then(function(d) { return d; }),
      apiJson('/api/doctor/pricing?token=' + encodeURIComponent(token)).then(function(d) { return d; }),
    ]).then(function(results) {
      var queue = results[0], analytics = results[1], schedule = results[2], pricing = results[3];
      if (queue.length > 0) setPatients(queue);
      setAnalyticsData(analytics);
      if (schedule.slots) setScheduleSlots(schedule.slots);
      if (pricing.items && pricing.items.length > 0) setServicePrices(pricing.items);
    }).catch(function(err) { console.error('Doctor data load error:', err); })
    .finally(function() { setLoading(false); });
  }, [token]);


  // Format chat time helper
  function formatDoctorChatTime(isoString) {
    if (!isoString) return '';
    try {
      var d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      var hh = String(d.getHours()).padStart(2, '0');
      var mm = String(d.getMinutes()).padStart(2, '0');
      return hh + ':' + mm;
    } catch (e) { return isoString; }
  }

  // Load doctor's chat list (independent of patient queue)
  React.useEffect(function() {
    if (!token) return;
    apiJson('/api/doctor/chats?token=' + encodeURIComponent(token))
      .then(function(data) {
        var chats = data.chats || [];
        setDoctorChatList(chats);
        // Auto-select first chat if none selected
        if (chats.length > 0 && !workflowChatId) {
          setWorkflowChatId(chats[0].id);
          // Also try to match with selected patient
          var selP = patients.find(function(p) { return p.id === selectedPatientId; });
          if (selP && selP.userId) {
            for (var i = 0; i < chats.length; i++) {
              if (chats[i].patientUserId === selP.userId) {
                setWorkflowChatId(chats[i].id);
                break;
              }
            }
          }
        }
      })
      .catch(function(err) { console.error('Load chats error:', err); });
  }, [token]);

  // Poll for new chat sessions (every 5s)
  React.useEffect(function() {
    if (!token) return;
    var pollId = setInterval(function() {
      apiJson('/api/doctor/chats?token=' + encodeURIComponent(token))
        .then(function(data) {
          var chats = data.chats || [];
          setDoctorChatList(function(prev) {
            if (chats.length !== prev.length) return chats;
            return prev;
          });
        })
        .catch(function() {});
    }, 5000);
    return function() { clearInterval(pollId); };
  }, [token]);

  // Load messages when workflowChatId changes
  React.useEffect(function() {
    if (!workflowChatId || !token) { setWorkflowMessages([]); return; }
    apiJson('/api/chats/' + workflowChatId + '?token=' + encodeURIComponent(token))
      .then(function(data) {
        var msgs = (data.chat.messages || []).map(function(m) {
          return {
            id: m.id,
            from: m.senderRole === 'doctor' ? 'doctor' : 'patient',
            text: m.content,
            time: formatDoctorChatTime(m.createdAt),
          };
        });
        setWorkflowMessages(msgs);
      })
      .catch(function(err) { console.error('Load messages error:', err); });
  }, [workflowChatId, token]);

  // Fetch patient assessments when chat changes
  React.useEffect(function() {
    if (!workflowChatId || !doctorChatList.length || !token) { setPatientAssessments([]); return; }
    var patientId = null;
    for (var i = 0; i < doctorChatList.length; i++) {
      if (doctorChatList[i].id === workflowChatId) { patientId = doctorChatList[i].patientUserId; break; }
    }
    if (!patientId) { setPatientAssessments([]); return; }
    apiJson('/api/doctor/patients/' + patientId + '/submissions?token=' + encodeURIComponent(token))
      .then(function(data) {
        setPatientAssessments(data.submissions || []);
      })
      .catch(function() { setPatientAssessments([]); });
  }, [workflowChatId, doctorChatList, token]);

  // Poll for new messages
  React.useEffect(function() {
    if (!workflowChatId || !token) return;
    if (workflowPollRef.current) clearInterval(workflowPollRef.current);
    workflowPollRef.current = setInterval(function() {
      apiJson('/api/chats/' + workflowChatId + '?token=' + encodeURIComponent(token))
        .then(function(data) {
          var newMsgs = (data.chat.messages || []).map(function(m) {
            return {
              id: m.id,
              from: m.senderRole === 'doctor' ? 'doctor' : 'patient',
              text: m.content,
              time: formatDoctorChatTime(m.createdAt),
            };
          });
          setWorkflowMessages(function(prev) {
            if (newMsgs.length !== prev.length) return newMsgs;
            return prev;
          });
        })
        .catch(function() {});
    }, 3000);
    return function() {
      if (workflowPollRef.current) clearInterval(workflowPollRef.current);
    };
  }, [workflowChatId, token]);

  // Auto-scroll
  React.useEffect(function() {
    if (workflowBodyRef.current) {
      workflowBodyRef.current.scrollTop = workflowBodyRef.current.scrollHeight;
    }
  }, [workflowMessages]);

  // Doctor send message handler
  function handleDoctorSend() {
    if (!chatMessage.trim() || !workflowChatId) return;
    var content = chatMessage.trim();
    var form = new FormData();
    form.append('token', token);
    form.append('content', content);
    apiForm('/api/doctor/chats/' + workflowChatId + '/messages', form)
      .then(function(data) {
        var m = data.message;
        setWorkflowMessages(function(prev) {
          return prev.concat([{
            id: m.id,
            from: 'doctor',
            text: m.content,
            time: formatDoctorChatTime(m.createdAt),
          }]);
        });
      })
      .catch(function(err) { console.error('Send error:', err); });
    setChatMessage('');
  }

  // Doctor key down handler
  function handleDoctorKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleDoctorSend();
    }
  }



  // Load doctor profile for editing
  React.useEffect(function() {
    if (!token) return;
    apiJson("/api/doctor/profile?token=" + encodeURIComponent(token))
      .then(function(d) {
        if (d) {
          setProfileData(d);
          setProfileForm({
            name: d.name || "",
            department: d.department || "",
            title: d.title || "",
            specialty: d.specialty || "",
            schedule: d.schedule || "",
            intro: d.intro || "",
            education: d.education || "",
            experience: d.experience || "",
            publications: (d.publications || []).join('\n'),
            reviews: (d.reviews || []).join('\n'),
            availabilities: (d.availabilities || []).join('\n'),
          });
        }
      })
      .catch(function(err) { console.error("Profile load error:", err); });
  }, [token]);
    const selectedPatient = patients.find(function(item) { return item.id === selectedPatientId; }) || patients[0] || { id: "", name: "暂无患者", note: "请从队列中选择" };
  const chatPatient = (function() {
    if (!workflowChatId || doctorChatList.length === 0) return null;
    for (var i = 0; i < doctorChatList.length; i++) {
      if (doctorChatList[i].id === workflowChatId) return doctorChatList[i];
    }
    return null;
  })();
  const stats = [
    { label: '今日预约', value: String(patients.length), hint: '待接诊队列' },
    { label: '完成率', value: analyticsData.completionRate + '%', hint: '诊疗完成率' },
    { label: '平均响应', value: String(analyticsData.avgResponseMinutes), hint: '分钟' },
    { label: '风险复核', value: String(analyticsData.riskChecks), hint: '需要人工介入' },
  ];


  const activeSection = {
    overview: (
      <div className={styles.docOverview}>
        <div className={styles.docHero}>
          <div className={styles.docHeroMain}>
            <h2>接诊总览</h2>
            <p className={styles.docHeroSub}>
              今天的导诊、预约与风险情况一目了然，患者队列实时更新。
            </p>
            <div className={styles.docHeroStats}>
              {stats.map((item) => (
                <div key={item.label} className={styles.docHeroStat}>
                  <strong>{item.value}</strong>
                  <span>{item.label} · {item.hint}</span>
                </div>
              ))}
            </div>
          </div>
          <div className={styles.docHeroRight}>
            <div className={styles.docHeroCard}>
              <h4>待处理患者</h4>
              <div className={styles.docHeroNum}>{patients.length}</div>
              <p>含高风险 {patients.filter(p => p.tone === 'danger').length} 人</p>
            </div>
            <div className={styles.docHeroCard}>
              <h4>匿名语音</h4>
              <p>保护模式已开启，患者端会话可按需接入匿名音频流。</p>
              <StatusBadge tone="success">可用</StatusBadge>
            </div>
          </div>
        </div>

        <div className={styles.docQuickGrid}>
          <div className={styles.docQuickStat} onClick={() => setActiveModule('workflow')}>
            <strong>92%</strong>
            <span>完成率</span>
          </div>
          <div className={styles.docQuickStat} onClick={() => setActiveModule('workflow')}>
            <strong>4 分钟</strong>
            <span>平均响应</span>
          </div>
          <div className={styles.docQuickStat} onClick={() => setActiveModule('workflow')}>
            <strong>3 单</strong>
            <span>风险复核</span>
          </div>
          <div className={styles.docQuickStat} onClick={() => setActiveModule('schedule-mgmt')}>
            <strong>11 人</strong>
            <span>沟通中</span>
          </div>
        </div>

        <div className={styles.docQueueLayout}>
          <div className={styles.docQueueList}>
            {patients.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`${styles.docPatientCard} ${selectedPatientId === item.id ? styles.docPatientCardActive : ''}`}
                onClick={() => setSelectedPatientId(item.id)}
              >
                <strong>{item.name}</strong>
                <p className={styles.docPatientMeta}>{item.note}</p>
                <div className={styles.docPatientRow}>
                  <StatusBadge tone={item.tone}>{item.status}</StatusBadge>
                </div>
              </button>
            ))}
          </div>

          <div className={styles.docQueueDetail}>
            <div className={styles.docDetailPanel}>
              <div className={styles.docDetailBar}>
                <div>
                  <h3>{selectedPatient.name}</h3>
                  <p>{selectedPatient.note}</p>
                </div>
                <StatusBadge tone={selectedPatient.tone}>{selectedPatient.status}</StatusBadge>
              </div>
              <div className={styles.docDetailBody}>
                <div className={styles.docDetailStats}>
                  <div className={styles.docDetailStat}>
                    <strong>待接诊</strong>
                    <span>会话状态</span>
                  </div>
                  <div className={styles.docDetailStat}>
                    <strong>优先复核</strong>
                    <span>导诊建议</span>
                  </div>
                  <div className={styles.docDetailStat}>
                    <strong>匿名语音</strong>
                    <span>沟通方式</span>
                  </div>
                </div>
                <label className={styles.field}>
                  <span>接诊备注</span>
                  <textarea value={reportNote} onChange={(event) => setReportNote(event.target.value)} />
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.docBottomGrid}>
          <div className={styles.docBottomCard}>
            <h4>实时动态</h4>
            <p className={styles.docBottomSub}>最近的系统通知与事件。</p>
            <div className={styles.docFeedItem}>
              <MessageSquare size={14} />
              <span>高风险记录已标记为待复核。</span>
            </div>
            <div className={styles.docFeedItem}>
              <MessageSquare size={14} />
              <span>匿名语音会话已同步到接诊队列。</span>
            </div>
          </div>
          <div className={styles.docBottomCard}>
            <h4>快捷操作</h4>
            <p className={styles.docBottomSub}>常用功能入口。</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className={styles.primaryButton} type="button" onClick={() => setActiveModule('workflow')}>
                诊疗工作流
              </button>
              <button className={styles.secondaryButton} type="button" onClick={() => setActiveModule('schedule-mgmt')}>
                排班管理
              </button>
            </div>
          </div>
        </div>
      </div>
    ),

    workflow: (
      <div className={styles.workflowLayout}>
        <div className={styles.workflowMain}>
          <div className={styles.workflowLeft}>
            {/* IM / Audio-Video Workspace */}
            <div className={styles.workspacePanel}>
              <div className={styles.workspaceHeader}>
                <div>
                  <h3>图文 / 音视频工作区</h3>
                  <p>{workflowChatId ? '实时沟通中' : '请选择聊天会话开始沟通'}</p>
                </div>
                <div className={styles.workspaceActions}>
                  <div style={{ position: 'relative' }}>
                    <select
                      className={styles.secondaryButton}
                      value={workflowChatId}
                      onChange={function(e) { setWorkflowChatId(e.target.value); }}
                      style={{ padding: '8px 12px', fontSize: 13, borderRadius: 10, border: '1px solid #c0cdd4', minWidth: 220, background: '#fff', cursor: 'pointer' }}
                    >
                      <option value="">-- 选择聊天会话 --</option>
                      {doctorChatList.map(function(chat) {
                        var displayName = (chat.patientName || chat.patientUserId || '未知患者');
                        var shortName = displayName.length > 8 ? displayName.substring(0, 8) + '...' : displayName;
                        var riskBadge = chat.patientRiskLevel ? (' [' + chat.patientRiskLevel + ']') : '';
                        return <option key={chat.id} value={chat.id}>{shortName + riskBadge + (chat.lastMessage ? ' | ' + (chat.lastMessage.length > 10 ? chat.lastMessage.substring(0, 10) + '...' : chat.lastMessage) : '')}</option>;
                      })}
                    </select>
                  </div>
                  <button className={styles.primaryButton} type="button" onClick={function() { webrtcRef.current && webrtcRef.current.triggerCall(); }}>
                    语音通话
                  </button>
                </div>
              </div>
                            <div className={styles.workspaceBody} ref={workflowBodyRef}>
                {workflowMessages.length === 0 ? (
                  <p style={{ color: '#7a8b94', padding: 20, textAlign: 'center' }}>
                    {workflowChatId ? '暂无消息，开始沟通吧' : '该患者暂未发起聊天，请等待患者从咨询颐约页面发起沟通。'}
                  </p>
                ) : (
                  workflowMessages.map(function(msg) {
                    return (
                      <div key={msg.id} className={`${styles.msgBubble} ${msg.from === 'doctor' ? styles.msgOut : styles.msgIn}`}>
                        {msg.text}
                        <span className={styles.msgTime}>{msg.time}</span>
                      </div>
                    );
                  })
                )}
              </div>
              <div className={styles.workspaceComposer}>
                <textarea
                  value={chatMessage}
                  onChange={function(event) { setChatMessage(event.target.value); }}
                  placeholder={`${selectedPatient.name}...`}
                  onKeyDown={handleDoctorKeyDown}
                  disabled={!workflowChatId}
                />
                <button className={styles.primaryButton} type="button" onClick={handleDoctorSend} disabled={!workflowChatId || !chatMessage.trim()}>
                  <Send size={14} />
                  发送
                </button>
              </div>
            </div>
          </div>

          {/* Patient Profile Sidebar */}
          <div className={styles.workflowRight}>
            <div className={styles.profilePanel}>
              <div className={styles.profilePanelHeader}>
                <div className={styles.profilePanelAvatar}>
                  <Users size={22} />
                </div>
                <div>
                  <h4>{chatPatient ? (chatPatient.patientName || '未知患者') : (selectedPatient.name || '未选择')}</h4>
                  <p>{chatPatient ? (chatPatient.patientRiskLevel ? '风险等级: ' + chatPatient.patientRiskLevel : '暂无风险评估') : '请选择一个聊天会话'}</p>
                </div>
              </div>
              <div className={styles.profilePanelBody}>
                {chatPatient && chatPatient.patientTriageReport ? (
                  <div className={styles.profileSection}>
                    <h5><ShieldCheck size={14} /> 智能导诊报告</h5>
                    <p>{chatPatient.patientTriageReport}</p>
                  </div>
                ) : (
                  <div className={styles.profileSection}>
                    <h5><ShieldCheck size={14} /> 智能导诊报告</h5>
                    <p style={{ color: '#7a8b94' }}>{chatPatient ? '该患者尚未完成问卷评估，暂无导诊报告。' : '请先选择一个聊天会话。'}</p>
                  </div>
                )}
                {chatPatient && chatPatient.patientMedicalHistory ? (
                  <div className={styles.profileSection}>
                    <h5><AlertTriangle size={14} /> 既往病史</h5>
                    <p>{chatPatient.patientMedicalHistory}</p>
                  </div>
                ) : (
                  <div className={styles.profileSection}>
                    <h5><AlertTriangle size={14} /> 既往病史</h5>
                    <p style={{ color: '#7a8b94' }}>{chatPatient ? '暂无病史记录。' : ''}</p>
                  </div>
                )}
                <div className={styles.profileSection}>
                  <h5><ClipboardList size={14} /> 问卷评估记录</h5>
                  {patientAssessments.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 260, overflowY: 'auto', paddingRight: 4 }}>
                      {patientAssessments.slice(0, 5).map(function(a) {
                        var riskColor = a.risk === '高风险' ? '#c45c5c' : a.risk === '中风险' ? '#e8964a' : '#5a9e6f';
                        var ratio = a.maxScore ? Math.round(a.score / a.maxScore * 100) : 0;
                        return (
                          <div key={a.id} style={{ padding: '8px 10px', background: '#f7fafb', borderRadius: 8, fontSize: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                              <span style={{ fontWeight: 600, color: '#154c60' }}>{a.questionnaireName}</span>
                              <span style={{ color: riskColor, fontWeight: 600 }}>{a.score}/{a.maxScore} {a.risk}</span>
                            </div>
                            <div style={{ height: 4, background: '#e0e8ed', borderRadius: 2, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: ratio + '%', background: riskColor, borderRadius: 2 }} />
                            </div>
                            <div style={{ fontSize: 11, color: '#7a8b94', marginTop: 3 }}>{a.createdAt ? new Date(a.createdAt).toLocaleDateString() : ''}</div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p style={{ color: '#7a8b94', fontSize: 13 }}>{chatPatient ? '该患者尚未提交问卷评估。' : ''}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* EMR Form */}
        <div className={styles.emrPanel}>
          <div className={styles.emrHeader}>
            <div>
              <h3>电子病历录入</h3>
              <p>诊后记录主诉、临床印象与处置建议。</p>
            </div>
            <StatusBadge tone="accent">{selectedPatient.name}</StatusBadge>
          </div>
          <div className={styles.emrBody}>
            <div className={styles.emrGrid}>
              <label className={styles.emrField}>
                <span>主诉</span>
                <input placeholder="患者主要症状与持续时间" value={workflowEmr.complaint} onChange={(e) => setWorkflowEmr(prev => ({ ...prev, complaint: e.target.value }))} />
              </label>
              <label className={styles.emrField}>
                <span>临床印象</span>
                <input placeholder="初步诊断或临床判断" value={workflowEmr.impression} onChange={(e) => setWorkflowEmr(prev => ({ ...prev, impression: e.target.value }))} />
              </label>
            </div>
            <label className={styles.emrField}>
              <span>处置建议</span>
              <textarea value={workflowEmr.plan} onChange={(e) => setWorkflowEmr(prev => ({ ...prev, plan: e.target.value }))} placeholder="用药建议、心理干预、复诊安排等" />
            </label>
            <div className={styles.emrGrid}>
              <label className={styles.emrField}>
                <span>是否需要转诊</span>
                <select value={workflowEmr.referral} onChange={(e) => setWorkflowEmr(prev => ({ ...prev, referral: e.target.value }))}>
                  <option value="否">否</option>
                  <option value="精神科">是 — 精神科</option>
                  <option value="睡眠门诊">是 — 睡眠门诊</option>
                  <option value="心理咨询中心">是 — 心理咨询中心</option>
                </select>
              </label>
              <label className={styles.emrField}>
                <span>复诊建议</span>
                <input placeholder="如：2 周后复诊" value={workflowEmr.followUp} onChange={(e) => setWorkflowEmr(prev => ({ ...prev, followUp: e.target.value }))} />
              </label>
            </div>
            <div className={styles.emrActions}>
              <button className={styles.primaryButton} type="button" onClick={function() {
                var emrPatientId = chatPatient ? chatPatient.patientUserId : selectedPatient.userId;
                if (!emrPatientId) { alert("请先从左侧选择一个聊天会话或患者。"); return; }
                var form = new FormData();
                form.append("token", token);
                form.append("complaint", workflowEmr.complaint);
                form.append("impression", workflowEmr.impression);
                form.append("plan", workflowEmr.plan);
                form.append("referral", workflowEmr.referral);
                form.append("follow_up", workflowEmr.followUp);
                apiForm("/api/doctor/patients/" + emrPatientId + "/emr", form)
                  .then(function() { setWorkflowEmr({ complaint: "", impression: "", plan: "", referral: "否", followUp: "" }); alert("电子病历已保存成功！患者端将收到通知。"); })
                  .catch(function(err) { alert("保存失败：" + (err.message || "请检查网络连接")); });
              }}>
                <ClipboardList size={14} />
                保存病历
              </button>
              <button className={styles.secondaryButton} type="button">
                暂存草稿
              </button>
            </div>
          </div>
        </div>
      </div>
    ),

    'schedule-mgmt': (
      <div className={styles.scheduleLayout}>
        <div className={styles.scheduleCalendar}>
          <div className={styles.calendarHeader}>
            <div>
              <h3>排班日历</h3>
            </div>
            <div className={styles.calendarNav}>
              <button type="button" onClick={() => setCalWeek(prev => prev - 1)}>‹</button>
              <span>第 {calWeek} 周</span>
              <button type="button" onClick={() => setCalWeek(prev => prev + 1)}>›</button>
            </div>
          </div>
          <div className={styles.calendarGrid}>
            {['一','二','三','四','五','六','日'].map(d => (
              <div key={d} className={styles.calendarDayHeader}>{d}</div>
            ))}
            {calDays.map((day, i) => (
              <div
                key={i}
                className={`${styles.calendarDay} ${day.active ? styles.calendarDayActive : ''} ${!day.current ? styles.calendarDayMuted : ''}`}
                onClick={() => day.current && setCalSelected(day.date)}
              >
                {day.label}
                {day.hasSlots && <span className={styles.calendarDayDot} />}
              </div>
            ))}
          </div>
          <div className={styles.slotSection}>
            <h4>{calSelected} 开放时段</h4>
            <div className={styles.slotGrid}>
              {defaultSlots.map(slot => (
                <button
                  key={slot}
                  type="button"
                  className={`${styles.slotChip} ${scheduleSlots.includes(slot) ? styles.slotChipActive : ''}`}
                  onClick={() => setScheduleSlots(prev => prev.includes(slot) ? prev.filter(s => s !== slot) : [...prev, slot])}
                >
                  {slot}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.pricingPanel}>
          <div className={styles.pricingHeader}>
            <div>
              <h3>服务定价</h3>
            </div>
          </div>
          <div className={styles.pricingBody}>
            {servicePrices.map((item, idx) => (
              <div key={item.type} className={styles.pricingItem}>
                <div>
                  <strong>{item.type}</strong>
                  <span>{item.desc}</span>
                </div>
                <div className={styles.priceInput}>
                  <span>¥</span>
                  <input
                    type="number"
                    value={item.price}
                    onChange={(e) => {
                      const next = [...servicePrices];
                      next[idx] = { ...next[idx], price: Number(e.target.value) };
                      setServicePrices(next);
                    }}
                  />
                </div>
              </div>
            ))}
            <button className={styles.primaryButton} type="button" style={{ marginTop: 16, width: '100%' }} onClick={() => {
              const form = new FormData();
              form.append('token', token);
              form.append('pricing', JSON.stringify(servicePrices));
              apiForm('/api/doctor/pricing', form)
                .then(d => alert('定价已保存'))
                .catch(err => alert('保存失败: ' + err.message));
            }}>
              {'保存定价'}
            </button>
          </div>
        </div>
      </div>
    ),

    profile: (
      <div className={styles.stack}>
        <SectionCard
          title="个人资料编辑"
          description="补充您的专业信息，提交后由管理员审核，审核通过后患者端可见。"
          icon={<UserRoundPen size={16} />}
          action={<StatusBadge tone={profileData?.pendingDraft ? "warning" : "neutral"}>{profileData?.pendingDraft ? "审核中" : "可编辑"}</StatusBadge>}
        >
          <div className={styles.profileForm}>
            <div className={styles.profileFormGrid}>
              <label className={styles.field}>
                <span>姓名</span>
                <input value={profileForm.name} onChange={function(e) { setProfileForm(function(prev) { return Object.assign({}, prev, { name: e.target.value }); }); }} placeholder="医生姓名" />
              </label>
              <label className={styles.field}>
                <span>科室</span>
                <input value={profileForm.department} onChange={function(e) { setProfileForm(function(prev) { return Object.assign({}, prev, { department: e.target.value }); }); }} placeholder="如：心理科" />
              </label>
              <label className={styles.field}>
                <span>职称</span>
                <input value={profileForm.title} onChange={function(e) { setProfileForm(function(prev) { return Object.assign({}, prev, { title: e.target.value }); }); }} placeholder="如：主任医师" />
              </label>
              <label className={styles.field}>
                <span>擅长领域</span>
                <input value={profileForm.specialty} onChange={function(e) { setProfileForm(function(prev) { return Object.assign({}, prev, { specialty: e.target.value }); }); }} placeholder="如：焦虑障碍、抑郁障碍" />
              </label>
              <label className={styles.field}>
                <span>排班时间</span>
                <input value={profileForm.schedule} onChange={function(e) { setProfileForm(function(prev) { return Object.assign({}, prev, { schedule: e.target.value }); }); }} placeholder="如：周一 / 周三 09:00-12:00" />
              </label>
              <label className={styles.field}>
                <span>教育背景</span>
                <input value={profileForm.education} onChange={function(e) { setProfileForm(function(prev) { return Object.assign({}, prev, { education: e.target.value }); }); }} placeholder="如：精神卫生硕士" />
              </label>
            </div>
            <label className={styles.field}>
              <span>个人介绍</span>
              <textarea rows={3} value={profileForm.intro} onChange={function(e) { setProfileForm(function(prev) { return Object.assign({}, prev, { intro: e.target.value }); }); }} placeholder="简短介绍您的诊疗风格和专业方向" />
            </label>
            <label className={styles.field}>
              <span>临床经验</span>
              <textarea rows={2} value={profileForm.experience} onChange={function(e) { setProfileForm(function(prev) { return Object.assign({}, prev, { experience: e.target.value }); }); }} placeholder="如：15 年临床经验" />
            </label>
            <label className={styles.field}>
              <span>发表论文 / 著作（每行一条）</span>
              <textarea rows={3} value={profileForm.publications} onChange={function(e) { setProfileForm(function(prev) { return Object.assign({}, prev, { publications: e.target.value }); }); }} placeholder="《焦虑障碍门诊策略》" />
            </label>
            <label className={styles.field}>
              <span>患者评价（每行一条）</span>
              <textarea rows={3} value={profileForm.reviews} onChange={function(e) { setProfileForm(function(prev) { return Object.assign({}, prev, { reviews: e.target.value }); }); }} placeholder="沟通耐心，评估细致。" />
            </label>
            <label className={styles.field}>
              <span>可预约时段（每行一个，如 09:00）</span>
              <textarea rows={3} value={profileForm.availabilities} onChange={function(e) { setProfileForm(function(prev) { return Object.assign({}, prev, { availabilities: e.target.value }); }); }} placeholder={"09:00\n09:30\n10:30"} />
            </label>
            <div className={styles.profileFormActions}>
              <button className={styles.primaryButton} type="button" onClick={function() {
                var form = new FormData();
                form.append("token", token);
                if (profileForm.name) form.append("name", profileForm.name);
                if (profileForm.department) form.append("department", profileForm.department);
                if (profileForm.title) form.append("title", profileForm.title);
                if (profileForm.specialty) form.append("specialty", profileForm.specialty);
                if (profileForm.schedule) form.append("schedule", profileForm.schedule);
                if (profileForm.intro) form.append("intro", profileForm.intro);
                if (profileForm.education) form.append("education", profileForm.education);
                if (profileForm.experience) form.append("experience", profileForm.experience);
                form.append("publications", JSON.stringify(profileForm.publications.split("\n").filter(function(s) { return s.trim(); })));
                form.append("reviews", JSON.stringify(profileForm.reviews.split("\n").filter(function(s) { return s.trim(); })));
                form.append("availabilities", JSON.stringify(profileForm.availabilities.split("\n").filter(function(s) { return s.trim(); })));
                apiForm("/api/doctor/profile", form)
                  .then(function() { setProfileSubmitStatus("已提交，等待管理员审核。"); })
                  .catch(function(err) { setProfileSubmitStatus("提交失败: " + err.message); });
              }}>提交审核</button>
              {profileSubmitStatus && <p className={styles.submitHint}>{profileSubmitStatus}</p>}
            </div>
          </div>
        </SectionCard>
      </div>
    ),
  }[activeModule];

  return (
    <>
    <WorkspaceShell
      title="SerenePath 医生工作台"
      subtitle="接诊、排班、价格和数据看板统一放在这里。"
      roleLabel="医生端"
      user={user}
      navItems={MODULES}
      activeKey={activeModule}
      onNavigate={setActiveModule}
      onLogout={onLogout}
      sidebarTop={
        <div className={styles.sidebarTop}>
          <div className={styles.avatar}>D</div>
          <div>
            <h2>{user?.displayName || user?.username || '医生'}</h2>
            <p>优先看风险，再处理队列。</p>
          </div>
        </div>
      }
      sidebarFooter={
        <div className={styles.footerBox}>
          <StatusBadge tone="success">当前在线</StatusBadge>
          <p>左侧菜单切换时，右侧内容区会同步刷新。</p>
        </div>
      }
    >
      {activeSection}
    </WorkspaceShell>

      {workflowChatId && (
        <WebRTCCall
          ref={webrtcRef}
          key={'idle-' + idleKey}
          chatId={workflowChatId}
          token={token}
          role='doctor'
          peerName={(chatPatient && chatPatient.patientName) || '患者'}
          autoConnect={true}
          onEnd={function() { setIdleKey(function(p) { return p + 1; }); }}
        />
      )}
    </>
  );
}
