import React from 'react';
import {
  AlertTriangle, CalendarDays, ClipboardList, FileUser, HeartPulse, Home,
  MessageSquare, ShieldCheck, Send, Mic, Sparkles, Stethoscope, UserRound,
} from 'lucide-react';
import { StatCard } from '../../components/StatCard.jsx';
import { StatusBadge } from '../../components/StatusBadge.jsx';
import { WorkspaceShell } from '../../components/WorkspaceShell.jsx';
import { SectionCard } from '../../components/SectionCard.jsx';
import { apiForm, apiJson } from '../../utils/api.js';
import { STORAGE_TOKEN_KEY } from '../../constants.js';
import { WebRTCCall } from '../../components/WebRTCCall.jsx';
import styles from './PatientDashboard.module.css';

const MODULES = [
  { key: 'overview', label: '总览', hint: '今日状态与关键入口', icon: Home },
  { key: 'questionnaire', label: '问卷评估', hint: '量表分值与建议', icon: ShieldCheck },
  { key: 'appointment', label: '咨询预约', hint: '医生筛选预约与聊天', icon: CalendarDays },
  { key: 'chat', label: '聊天详情', hint: '会话内容与继续预约', icon: MessageSquare },
  { key: 'records', label: '个人中心', hint: '诊疗记录与趋势', icon: FileUser },
];
const MODE_OPTIONS = ['现场面诊', '视频门诊', '电话咨询'];

function buildDefaultAnswers(template) {
  if (!template || !template.questions) return [];
  return new Array(template.questions.length).fill(1);
}

function calculateAssessment(template, answers) {
  if (!template || !template.questions) return { score: 0, maxScore: 0, ratio: 0, risk: '暂无数据', advice: '请等待量表加载后进行评估。' };
  var maxScore = template.questions.length * 4;
  var score = answers.reduce(function(sum, item) { return sum + Number(item || 0); }, 0);
  var ratio = maxScore ? score / maxScore : 0;
  var risk = ratio >= 0.8 ? '高风险' : ratio >= 0.55 ? '中风险' : ratio >= 0.3 ? '轻中度' : '低风险';
  var advice = ratio >= 0.8 ? '建议尽快预约心理科或精神科，必要时联系家属陪同。' : ratio >= 0.55 ? '建议一周内完成门诊咨询，并结合生活方式干预。' : ratio >= 0.3 ? '可先观察 1-2 周并保持规律作息，关注波动。' : '目前仅作初步参考，继续保持自我监测即可。';
  return { score: score, maxScore: maxScore, ratio: ratio, risk: risk, advice: advice };
}


function QuestionnaireSection({
  questionnaires: options,
  selectedQuestionnaireId,
  onSelectQuestionnaire,
  answers,
  onAnswerChange,
  assessment,
  history,
  onSubmit,
}) {
  var selected = options.find(function(item) { return item.id === selectedQuestionnaireId; }) || options[0] || { name: '加载中...', scale: '', items: 0, questions: [] };

  function scoreClass(value) {
    if (value <= 1) return styles.scoreBadgeLow;
    if (value <= 2) return styles.scoreBadgeMid;
    if (value <= 3) return styles.scoreBadgeHigh;
    return styles.scoreBadgeCritical;
  }

  var riskClass = (function() {
    if (assessment.risk === '高风险') return styles.reportCardRiskCritical;
    if (assessment.risk === '中风险') return styles.reportCardRiskHigh;
    if (assessment.risk === '轻中度') return styles.reportCardRiskMid;
    return styles.reportCardRiskLow;
  })();

  var scoreBarClass = (function() {
    var ratio = assessment.maxScore ? assessment.score / assessment.maxScore : 0;
    if (ratio >= 0.8) return styles.scoreBarCritical;
    if (ratio >= 0.55) return styles.scoreBarHigh;
    if (ratio >= 0.3) return styles.scoreBarMid;
    return styles.scoreBarLow;
  })();

  return (
    <SectionCard
      title="问卷评估"
      description="从量表到结论，保持一个清晰的自我评估流程。"
      icon={<ClipboardList size={16} />}
      action={<StatusBadge tone="accent">{selected.tag || '量表中'}</StatusBadge>}
    >
      <div className={styles.questionnaireLayout}>
        <div className={styles.templateStrip}>
          {options.map(function(item) {
            return (
              <button
                key={item.id}
                type="button"
                className={`${styles.templateCard} ${selectedQuestionnaireId === item.id ? styles.templateCardActive : ''}`}
                onClick={function() { onSelectQuestionnaire(item.id); }}
              >
                <strong>{item.name}</strong>
                <p>{item.description}</p>
                <StatusBadge tone={selectedQuestionnaireId === item.id ? 'success' : 'neutral'}>
                  {item.items} 项
                </StatusBadge>
              </button>
            );
          })}
        </div>

        <div className={styles.questionnaireBody}>
          <div className={styles.questionnaireForm}>
            <div className={styles.formHeader}>
              <div>
                <h3>{selected.name}</h3>
                <p>{selected.scale} · 共 {selected.items} 项</p>
                <div className={styles.scoreBar}>
                  <div className={`${styles.scoreBarFill} ${scoreBarClass}`} style={{ width: Math.round((assessment.score / (assessment.maxScore || 1)) * 100) + '%' }} />
                </div>
              </div>
              <button className={styles.primaryButton} type="button" onClick={onSubmit}>
                <Send size={14} />提交评估
              </button>
            </div>

            <div className={styles.questionList}>
              {(selected.questions || []).map(function(q, idx) {
                var value = answers[idx] || 1;
                return (
                  <div key={idx} className={styles.questionRow}>
                    <div className={styles.questionLabel}>
                      <span className={styles.questionNum}>{idx + 1}</span>
                      <span className={styles.questionText}>{q.text || q}</span>
                    </div>
                    <div className={styles.questionControl}>
                      <input type="range" min="1" max="4" value={value} className={styles.rangeInput}
                        onChange={function(e) { onAnswerChange(idx, Number(e.target.value)); }} />
                      <span className={`${styles.scoreBadge} ${scoreClass(value)}`}>{value}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className={`${styles.reportCard} ${riskClass}`}>
            <div className={styles.reportHeader}>
              <h4>评估报告</h4>
              <StatusBadge tone={assessment.risk === '高风险' ? 'warning' : 'success'}>
                {assessment.risk}
              </StatusBadge>
            </div>
            <div className={styles.reportStatGrid}>
              <div className={styles.reportStat}>
                <span>总分</span>
                <strong>{assessment.score} / {assessment.maxScore}</strong>
              </div>
              <div className={styles.reportStat}>
                <span>百分比</span>
                <strong>{Math.round((assessment.score / (assessment.maxScore || 1)) * 100)}%</strong>
              </div>
            </div>
            <p className={styles.reportText}>{assessment.advice}</p>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}


function ConsultationSection({
  doctors: doctorList,
  selectedDoctorId,
  setSelectedDoctorId,
  doctorQuery,
  setDoctorQuery,
  mode,
  setMode,
  appointmentDate,
  setAppointmentDate,
  appointmentSlot,
  setAppointmentSlot,
  reason,
  setReason,
  bookingFeed,
  onBook,
  onOpenChat,
}) {
  // All doctors shown; filtered by search query only
  var filtered = doctorList.filter(function(item) {
    if (doctorQuery && !item.name.includes(doctorQuery) && !item.specialty.includes(doctorQuery)) return false;
    return true;
  });
  filtered.sort(function(a, b) { return b.rating - a.rating; });

  var selectedDoctor = doctorList.find(function(item) { return item.id === selectedDoctorId; }) || doctorList[0] || null;

  return (
    <div className={styles.consultationLayout}>
      <div className={styles.consultBody}>
        <div className={styles.doctorListCol}>
          <div className={styles.filterBar}>
            <input placeholder="搜索医生姓名或专长" value={doctorQuery} onChange={function(e) { setDoctorQuery(e.target.value); }}
              style={{ flex: 1, padding: '10px 14px', border: '1px solid #c0cdd4', borderRadius: 10, fontSize: 14, minWidth: 0 }} />
            <span style={{ fontSize: 13, color: '#7a8b94', whiteSpace: 'nowrap' }}>共 {filtered.length} 位医生</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(function(doc) {
              return (
                <button key={doc.id} type="button"
                  className={`${styles.doctorMiniCard} ${selectedDoctorId === doc.id ? styles.doctorMiniCardActive : ''}`}
                  onClick={function() { setSelectedDoctorId(doc.id); }}>
                  <div className={styles.miniMeta}>
                    <strong>{doc.name}</strong>
                    <span className={styles.miniSpecialty}>{doc.department}</span>
                  </div>
                  <div className={styles.miniTags}>
                    <span style={{ fontSize: 12, color: '#7a8b94' }}>{doc.title}</span>
                  </div>
                  <p style={{ fontSize: 13, color: '#4a6b7c', marginTop: 6, marginBottom: 0 }}>{doc.specialty}</p>
                </button>
              );
            })}
          </div>
        </div>

        {selectedDoctor ? (
          <div className={styles.consultRight}>
            <div className={styles.doctorDetailPanel}>
              <div className={styles.detailTopBar}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, color: '#154c60' }}>{selectedDoctor.name}</h3>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: '#7a8b94' }}>{selectedDoctor.title} · {selectedDoctor.department}</p>
                </div>
                <StatusBadge tone="success">可预约</StatusBadge>
              </div>
              <div className={styles.detailGrid}>
                <div className={styles.reportStat}>
                  <span>综合评分</span>
                  <strong>{selectedDoctor.rating && selectedDoctor.rating.toFixed(1)}</strong>
                </div>
                <div className={styles.reportStat}>
                  <span>满意度</span>
                  <strong>{selectedDoctor.satisfaction}%</strong>
                </div>
                <div className={styles.reportStat}>
                  <span>教育背景</span>
                  <strong>{selectedDoctor.education || '未填写'}</strong>
                </div>
                <div className={styles.reportStat}>
                  <span>临床经验</span>
                  <strong>{selectedDoctor.experience || '未填写'}</strong>
                </div>
              </div>
              {selectedDoctor.intro && <p style={{ padding: '0 20px 14px', margin: 0, fontSize: 14, color: '#4a6b7c', lineHeight: 1.6 }}>{selectedDoctor.intro}</p>}
              {(selectedDoctor.reviews || []).length > 0 && (
                <div className={styles.reviewList}>
                  {(selectedDoctor.reviews || []).slice(0, 3).map(function(r, i) {
                    return <div key={i} className={styles.reviewItem}>{r}</div>;
                  })}
                </div>
              )}
            </div>

            <div className={styles.bookingPanel}>
              <div className={styles.bookingPanelHeader}>
                <h4 style={{ margin: 0, fontSize: 16 }}>预约信息</h4>
                <StatusBadge tone="accent">{mode}</StatusBadge>
              </div>
              <div className={styles.bookingFormBody}>
                <div className={styles.previewRow}>
                  <span>就诊方式</span>
                  <select value={mode} onChange={function(e) { setMode(e.target.value); }}
                    style={{ padding: '6px 10px', border: '1px solid #c0cdd4', borderRadius: 8, fontSize: 13 }}>
                    {MODE_OPTIONS.map(function(m) { return <option key={m} value={m}>{m}</option>; })}
                  </select>
                </div>
                <div className={styles.previewRow}>
                  <span>日期</span>
                  <input type="date" value={appointmentDate} onChange={function(e) { setAppointmentDate(e.target.value); }}
                    style={{ padding: '6px 10px', border: '1px solid #c0cdd4', borderRadius: 8, fontSize: 13 }} />
                </div>
                <div className={styles.previewRow}>
                  <span>时段</span>
                  <select value={appointmentSlot} onChange={function(e) { setAppointmentSlot(e.target.value); }}
                    style={{ padding: '6px 10px', border: '1px solid #c0cdd4', borderRadius: 8, fontSize: 13 }}>
                    {(selectedDoctor.availabilities || []).map(function(s) { return <option key={s} value={s}>{s}</option>; })}
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 13, color: '#4a6b7c' }}>就诊原因</span>
                  <textarea value={reason} onChange={function(e) { setReason(e.target.value); }} placeholder="简述您的需求和期望..."
                    style={{ padding: '8px 12px', border: '1px solid #c0cdd4', borderRadius: 8, fontSize: 14, resize: 'vertical', minHeight: 60 }} />
                </div>
              </div>
              <div style={{ padding: '0 20px 18px', display: 'flex', gap: 12 }}>
                <button className={styles.primaryButton} type="button" onClick={function() { onOpenChat(selectedDoctor.id); }} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <MessageSquare size={14} />聊天详情
                </button>
                <button className={styles.primaryButton} type="button" onClick={onBook} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#2b6f9c', color: '#fff', borderColor: '#2b6f9c' }}>
                  <CalendarDays size={14} />提交预约
                </button>
              </div>
              {bookingFeed.length > 0 && (
                <div className={styles.bookingHistory}>
                  <h5 style={{ margin: '0 0 8px', fontSize: 14 }}>预约记录</h5>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {bookingFeed.map(function(item, i) {
                      return <div key={i} className={styles.previewRow}><span>{typeof item === 'string' ? item : item.mode}</span><StatusBadge tone="accent">待确认</StatusBadge></div>;
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className={styles.consultRight}>
            <p style={{ padding: 40, textAlign: 'center', color: '#7a8b94' }}>请从左侧选择一位医生查看详情。</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ChatDetailSection({ doctor, mode, appointmentFeed, onBack, onBook, onModeChange, token }) {
  React.useEffect(function() {
    // Load model list and pre-warmup RVC worker for instant call startup
    apiJson('/api/models').then(function(d) {
      if (d && d.models && d.models.length > 0) {
        var modelName = d.models[0].name;
        setRvcModel(modelName);
        // Pre-warmup RVC model so worker is ready before user clicks call
        var formData = new FormData();
        formData.append('model', modelName);
        formData.append('transpose', '0');
        formData.append('f0_method', 'rmvpe');
        fetch('http://127.0.0.1:7860/api/realtime/prewarm', { method: 'POST', body: formData }).catch(function() {});
      }
    }).catch(function() {});
  }, []);
  const [message, setMessage] = React.useState('');
  const [messages, setMessages] = React.useState([]);
  const [chatId, setChatId] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const pollRef = React.useRef(null);
  const chatBodyRef = React.useRef(null);

  const [idleKey, setIdleKey] = React.useState(0);
  const [rvcModel, setRvcModel] = React.useState('');
  const webrtcRef = React.useRef(null);
  function formatChatTime(isoString) {
    if (!isoString) return '';
    try {
      var d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      var hh = String(d.getHours()).padStart(2, '0');
      var mm = String(d.getMinutes()).padStart(2, '0');
      return hh + ':' + mm;
    } catch (e) { return isoString; }
  }

  React.useEffect(function() {
    if (!doctor || !token) return;
    setLoading(true);
    var form = new FormData();
    form.append('token', token);
    form.append('doctor_id', doctor.userId || doctor.id);
    apiForm('/api/chats', form)
      .then(function(data) {
        var cid = data.chat.id;
        setChatId(cid);
        return apiJson('/api/chats/' + cid + '?token=' + encodeURIComponent(token));
      })
      .then(function(data) {
        var msgs = (data.chat.messages || []).map(function(m) {
          return {
            id: m.id,
            from: m.senderRole === 'doctor' ? 'doctor' : 'patient',
            text: m.content,
            time: formatChatTime(m.createdAt),
          };
        });
        setMessages(msgs);
        setLoading(false);
      })
      .catch(function(err) { console.error('Chat load error:', err); setLoading(false); });
  }, [doctor && doctor.id, token]);

  React.useEffect(function() {
    if (!chatId || !token) return;
    pollRef.current = setInterval(function() {
      apiJson('/api/chats/' + chatId + '?token=' + encodeURIComponent(token))
        .then(function(data) {
          var newMsgs = (data.chat.messages || []).map(function(m) {
            return {
              id: m.id,
              from: m.senderRole === 'doctor' ? 'doctor' : 'patient',
              text: m.content,
              time: formatChatTime(m.createdAt),
            };
          });
          setMessages(function(prev) {
            if (newMsgs.length !== prev.length) return newMsgs;
            return prev;
          });
        }).catch(function() {});
    }, 3000);
    return function() { if (pollRef.current) clearInterval(pollRef.current); };
  }, [chatId, token]);

  React.useEffect(function() {
    if (chatBodyRef.current) chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
  }, [messages]);

  function handleSend() {
    if (!message.trim() || !chatId) return;
    var content = message.trim();
    var form = new FormData();
    form.append('token', token);
    form.append('content', content);
    apiForm('/api/chats/' + chatId + '/messages', form)
      .then(function(data) {
        var m = data.message;
        setMessages(function(prev) { return prev.concat([{ id: m.id, from: 'patient', text: m.content, time: formatChatTime(m.createdAt) }]); });
      }).catch(function(err) { console.error('Send error:', err); });
    setMessage('');
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); handleSend(); }
  }

  if (!doctor) {
    return <SectionCard title="聊天详情" description="请先选择一位医生开始沟通。" icon={<MessageSquare size={16} />}>
      <p style={{padding: 40, textAlign: 'center', color: '#7a8b94'}}>请先在咨询预约页面选择医生并点击"查看聊天详情"。</p>
    </SectionCard>;
  }

  if (doctor.userId !== undefined && !doctor.userId) {
    return <SectionCard title="聊天详情" description="该医生暂不支持在线聊天" icon={<MessageSquare size={16} />} action={<StatusBadge tone="warning">{doctor.name}</StatusBadge>}>
      <p style={{padding: 40, textAlign: 'center', color: '#7a8b94'}}>{doctor.name} 医生暂未开通在线聊天功能，请选择其他已注册医生。</p>
      <div className={styles.actionRow} style={{justifyContent: 'center'}}>
        <button className={styles.secondaryButton} type="button" onClick={onBack}>返回咨询页</button>
      </div>
    </SectionCard>;
  }

  if (loading) {
    return <SectionCard title="聊天详情" description="正在加载聊天记录..." icon={<MessageSquare size={16} />} action={<StatusBadge tone="accent">{doctor.name}</StatusBadge>}>
      <p style={{padding: 40, textAlign: 'center', color: '#7a8b94'}}>加载中...</p>
    </SectionCard>;
  }

  return (
    <>
    <SectionCard title="聊天详情" description="安全加密的实时沟通，支持语音通话与便捷预约。" icon={<MessageSquare size={16} />} action={<StatusBadge tone="accent">{doctor.name || '未选择医生'}</StatusBadge>}>
      <div className={styles.chatLayout}>
        <div className={styles.chatMain}>
          <div className={styles.chatHeaderBar}>
            <div className={styles.chatHeaderLeft}>
              <div className={styles.profileAvatar} style={{ width: 44, height: 44 }}><UserRound size={22} /></div>
              <div><h3>{doctor.name}</h3><p>{doctor.title} · {doctor.department}</p></div>
            </div>
            <button className={styles.voiceCallBtn} type="button" disabled={!chatId || loading} onClick={function() { webrtcRef.current && webrtcRef.current.triggerCall(); }}><Mic size={16} />发起语音通话</button>
          </div>
          <div className={styles.chatBody} ref={chatBodyRef}>
            {messages.map(function(msg) {
              return (
                <div key={msg.id} className={`${styles.chatBubble} ${msg.from === 'patient' ? styles.chatBubbleOut : styles.chatBubbleIn}`}>
                  {msg.text}<span className={styles.chatTimestamp}>{msg.time}</span>
                </div>
              );
            })}
          </div>
          <div className={styles.chatComposerBar}>
            <textarea value={message} onChange={function(event) { setMessage(event.target.value); }} placeholder="输入想对医生说的话..." onKeyDown={handleKeyDown} />
            <button className={styles.sendBtn} type="button" onClick={handleSend}><Send size={16} />发送</button>
          </div>
        </div>
        <div className={styles.chatSidePanel}>
          <div className={styles.profileCard}>
            <div className={styles.profileAvatar}><UserRound size={36} /></div>
            <h3>{doctor.name}</h3>
            <p className={styles.profileTitle}>{doctor.title} · {doctor.department}</p>
            <div className={styles.profileStats}>
              <div className={styles.profileStat}><strong>{doctor.rating && doctor.rating.toFixed(1)}</strong><span>综合评分</span></div>
              <div className={styles.profileStat}><strong>{doctor.satisfaction}%</strong><span>满意度</span></div>
            </div>
          </div>
          <div className={styles.warmTipsCard}>
            <h3><Sparkles size={16} /> 暖心提示</h3>
            <ul className={styles.warmTipsList}>
              <li>咨询内容全程加密，仅你和医生可见</li>
              <li>语音通话将使用匿名化处理保护隐私</li>
              <li>可随时在聊天中发起预约，无需跳出</li>
              <li>如有紧急情况，请联系当地心理援助热线</li>
            </ul>
          </div>
          <div className={styles.bookingMini}>
            <h3>快速预约</h3>
            <div className={styles.actionRow}>
              <button className={styles.secondaryButton} type="button" onClick={onBack}>返回咨询页</button>
              <button className={styles.primaryButton} type="button" onClick={onBook}>提交预约</button>
            </div>
          </div>
          <div className={styles.bookingList}>
            {appointmentFeed.map(function(item, i) {
              return (
                <article key={'apt-' + (item.id || (typeof item === 'string' ? item + '-' + i : String(i)))} className={styles.bookingItem}>
                  <div><strong>{typeof item === 'string' ? item : item.doctor}</strong>
                    <p>{typeof item === 'string' ? '' : item.time}</p>
                    <small>{typeof item === 'string' ? '' : item.mode}</small>
                  </div>
                  <StatusBadge tone={item.status === '已确认' ? 'success' : 'warning'}>{item.status || '预约中'}</StatusBadge>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </SectionCard>
      {chatId && (
        <WebRTCCall
          ref={webrtcRef}
          key={'idle-' + idleKey}
          chatId={chatId}
          token={token}
          role="patient"
          peerName={doctor.name}
          autoConnect={true}
          rvcModel={rvcModel}
          onEnd={function() { setIdleKey(function(p) { return p + 1; }); }}
        />
      )}
    </>
  );

}

function EmrSection({ emrs }) {
  const [selectedEmrId, setSelectedEmrId] = React.useState(emrs[0] && emrs[0].id || '');

  React.useEffect(function() {
    if (emrs.length > 0 && !selectedEmrId) setSelectedEmrId(emrs[0].id);
  }, [emrs]);

  var selectedEmr = emrs.find(function(e) { return e.id === selectedEmrId; }) || emrs[0] || null;

  function formatEmrDate(isoString) {
    if (!isoString) return '';
    try {
      var d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    } catch (e) { return isoString; }
  }

  return (
    <SectionCard title="电子病历" description="医生为您创建的问诊病历记录。" icon={<ClipboardList size={16} />} action={<StatusBadge tone="accent">{emrs.length} 份</StatusBadge>}>
      {emrs.length === 0 ? (
        <p style={{ padding: 20, textAlign: 'center', color: '#7a8b94', fontSize: 14 }}>暂无病历记录，医生完成诊疗后会在此显示。</p>
      ) : (
        <div className={styles.recordsLayout}>
          <div className={styles.recordListCol}>
            {emrs.map(function(emr) {
              return (
                <button key={emr.id} type="button" className={`${styles.recordMiniCard} ${selectedEmrId === emr.id ? styles.recordMiniCardActive : ''}`} onClick={function() { setSelectedEmrId(emr.id); }}>
                  <strong>{emr.impression || '临床印象待补充'}</strong>
                  <p className={styles.recordMiniMeta}>{emr.doctorName} · {formatEmrDate(emr.createdAt)}</p>
                  <span className={styles.recordMiniTag}>{emr.status || '已保存'}</span>
                </button>
              );
            })}
          </div>
          {selectedEmr && (
            <div className={styles.recordDetailPanel}>
              <div className={styles.recordHeaderCard}>
                <div className={styles.recordHeaderBar}>
                  <div><h3>电子病历</h3><p>主治医生：{selectedEmr.doctorName} · {formatEmrDate(selectedEmr.createdAt)}</p></div>
                  <StatusBadge tone="accent">{selectedEmr.status || '已保存'}</StatusBadge>
                </div>
                <div className={styles.recordInfoGrid}>
                  <div className={styles.recordInfoItem}><span><ClipboardList size={14} />主诉</span><strong>{selectedEmr.complaint || '未填写'}</strong></div>
                  <div className={styles.recordInfoItem}><span><HeartPulse size={14} />临床印象</span><strong>{selectedEmr.impression || '未填写'}</strong></div>
                  <div className={styles.recordInfoItem}><span><CalendarDays size={14} />处置建议</span><strong>{selectedEmr.plan || '未填写'}</strong></div>
                  <div className={styles.recordInfoItem}><span><FileUser size={14} />复诊建议</span><strong>{selectedEmr.followUp || '未填写'}</strong></div>
                </div>
                {selectedEmr.referral && selectedEmr.referral !== '否' ? (
                  <div style={{ marginTop: 12, padding: '10px 14px', background: '#fff3cd', borderRadius: 8, fontSize: 13 }}>转诊建议：{selectedEmr.referral}</div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      )}
    </SectionCard>
  );
}

function RecordsSection({ records, archiveSummary, selectedRecordId, setSelectedRecordId }) {
  var selectedRecord = records.find(function(item) { return item.id === selectedRecordId; }) || records[0] || {};

  return (
    <SectionCard title="诊疗记录" description="查看历史就诊记录、方案与趋势摘要。" icon={<FileUser size={16} />} action={<StatusBadge tone="neutral">{records.length} 条</StatusBadge>}>
      <div className={styles.recordsLayout}>
        <div className={styles.recordListCol}>
          {records.map(function(item) {
            return (
              <button key={item.id} type="button" className={`${styles.recordMiniCard} ${selectedRecordId === item.id ? styles.recordMiniCardActive : ''}`} onClick={function() { setSelectedRecordId(item.id); }}>
                <strong>{item.title}</strong>
                <p className={styles.recordMiniMeta}>{item.date} · {item.doctor}</p>
                <span className={styles.recordMiniTag}>{item.diagnosis}</span>
              </button>
            );
          })}
        </div>
        <div className={styles.recordDetailPanel}>
          <div className={styles.recordHeaderCard}>
            <div className={styles.recordHeaderBar}>
              <div><h3>{selectedRecord.title}</h3><p>{selectedRecord.date} · {selectedRecord.doctor}</p></div>
              <StatusBadge tone="accent">{selectedRecord.diagnosis}</StatusBadge>
            </div>
            <div className={styles.recordInfoGrid}>
              <div className={styles.recordInfoItem}><span><ClipboardList size={14} />治疗方案</span><strong>{selectedRecord.plan}</strong></div>
              <div className={styles.recordInfoItem}><span><HeartPulse size={14} />处方</span><strong>{selectedRecord.prescription}</strong></div>
              <div className={styles.recordInfoItem}><span><CalendarDays size={14} />复诊建议</span><strong>{selectedRecord.followUp}</strong></div>
              <div className={styles.recordInfoItem}><span><FileUser size={14} />摘要</span><strong>{selectedRecord.report}</strong></div>
            </div>
          </div>
          <div className={styles.archiveGrid}>
            {archiveSummary.map(function(item) {
              return <article key={item.label} className={styles.archiveCard}><span>{item.label}</span><strong>{item.value}</strong><p>{item.note}</p></article>;
            })}
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

function ProfileSection({ user }) {
  return (
    <SectionCard title="个人信息" description="当前账号的基础资料与导诊状态。" icon={<UserRound size={16} />} action={<StatusBadge tone="success">已登录</StatusBadge>}>
      <div className={styles.profileSection}>
        <div className={styles.profileHero}>
          <div className={styles.profileAvatarLg}><UserRound size={32} /></div>
          <div><h3>{user.displayName || user.username}</h3><p>{user.role === 'patient' ? '患者' : user.role}</p></div>
        </div>
        <div className={styles.profileGrid}>
          <div className={styles.profileGridItem}><span>用户名</span><strong>{user.username}</strong></div>
          <div className={styles.profileGridItem}><span>角色</span><strong>{user.role}</strong></div>
        </div>
      </div>
    </SectionCard>
  );
}

export function PatientDashboard({ user, onLogout }) {
  const [activeModule, setActiveModule] = React.useState('overview');
  const [questionnaires, setQuestionnaires] = React.useState([]);
  const [selectedQuestionnaireId, setSelectedQuestionnaireId] = React.useState('');
  const [answers, setAnswers] = React.useState([]);
  const [assessmentHistory, setAssessmentHistory] = React.useState([]);
  const [doctors, setDoctors] = React.useState([]);
  const [records, setRecords] = React.useState([]);
  const [emrs, setEmrs] = React.useState([]);
  const [showEmrPopup, setShowEmrPopup] = React.useState(false);
  const [showAssessPopup, setShowAssessPopup] = React.useState(false);
  const [assessPopupData, setAssessPopupData] = React.useState(null);
  const [newEmrCount, setNewEmrCount] = React.useState(0);
  const [archiveSummary, setArchiveSummary] = React.useState([]);
  const token = React.useMemo(function() { return localStorage.getItem(STORAGE_TOKEN_KEY) || ''; }, []);
  const [dataLoaded, setDataLoaded] = React.useState(false);
  const [selectedDoctorId, setSelectedDoctorId] = React.useState('');
  const [doctorQuery, setDoctorQuery] = React.useState('');
  const [doctorDepartment, setDoctorDepartment] = React.useState('全部');
  const [doctorTitle, setDoctorTitle] = React.useState('全部');
  const [doctorSort, setDoctorSort] = React.useState('rating');
  const [appointmentMode, setAppointmentMode] = React.useState(MODE_OPTIONS[0]);
  const [appointmentDate, setAppointmentDate] = React.useState('2026-06-26');
  const [appointmentSlot, setAppointmentSlot] = React.useState('');
  const [appointmentReason, setAppointmentReason] = React.useState('');
  const [bookingFeed, setBookingFeed] = React.useState([]);
  const [chatDoctorId, setChatDoctorId] = React.useState('');
  const [chatMode, setChatMode] = React.useState(MODE_OPTIONS[0]);
  const [selectedRecordId, setSelectedRecordId] = React.useState('');


  const selectedQuestionnaire = questionnaires.find(function(item) { return item.id === selectedQuestionnaireId; }) || questionnaires[0] || null;
  const assessmentSnapshot = React.useMemo(function() { return calculateAssessment(selectedQuestionnaire, answers); }, [selectedQuestionnaire, answers]);

  React.useEffect(function() {
    if (!token) return;
    Promise.all([
      apiJson('/api/questionnaires?token=' + encodeURIComponent(token)).then(function(d) { return d.questionnaires || []; }),
      apiJson('/api/doctors?token=' + encodeURIComponent(token)).then(function(d) { return d.doctors || []; }),
      apiJson('/api/patient/records?token=' + encodeURIComponent(token)).then(function(d) { return d.records || []; }),
      apiJson('/api/patient/summary?token=' + encodeURIComponent(token)).then(function(d) { return d.summary || {}; }),
      apiJson('/api/appointments?token=' + encodeURIComponent(token)).then(function(d) { return d.appointments || []; }),
      apiJson('/api/chats?token=' + encodeURIComponent(token)).then(function(d) { return d.chats || []; }),
      apiJson('/api/patient/emrs?token=' + encodeURIComponent(token)).then(function(d) { return d.emrs || []; }),
    ]).then(function(results) {
      var qs = results[0], ds = results[1], recs = results[2], summary = results[3], appts = results[4], chats = results[5], emrsData = results[6];
      setQuestionnaires(qs);
      setDoctors(ds);
      if (qs.length > 0) setSelectedQuestionnaireId(qs[0].id);
      if (ds.length > 0) { setSelectedDoctorId(ds[0].id); setChatDoctorId(ds[0].id); }
      setRecords(recs);
      if (recs.length > 0) setSelectedRecordId(recs[0].id);
      if (appts.length > 0) setBookingFeed(appts.map(function(a) { return a.mode + ' - ' + a.status; }));
      setArchiveSummary([
        { label: '总记录', value: String(recs.length), note: '诊疗次数' },
        { label: '评估', value: String(qs.length), note: '可用量表数' },
        { label: '医生', value: String(ds.length), note: '可预约医生' },
        { label: '病历', value: String(emrsData.length), note: '电子病历数' },
      ]);
      setEmrs(emrsData);
      if (emrsData && emrsData.length > 0) {
        try {
          var prevCount = parseInt(localStorage.getItem('serenepath_emr_count') || '0', 10);
          if (emrsData.length > prevCount) { setShowEmrPopup(true); setNewEmrCount(emrsData.length - prevCount); }
          localStorage.setItem('serenepath_emr_count', String(emrsData.length));
        } catch (e) {}
      }
      setDataLoaded(true);
    }).catch(function(err) { console.error('Data load error:', err); });
  }, [token]);

  React.useEffect(function() { setAnswers(buildDefaultAnswers(selectedQuestionnaire)); }, [selectedQuestionnaireId]);

  function handleAnswerChange(index, value) { setAnswers(function(prev) { var next = prev.slice(); next[index] = value; return next; }); }
  function handleAssessmentSubmit() {
    if (!selectedQuestionnaireId || !token) return;
    var form = new FormData();
    form.append('token', token);
    form.append('score', String(assessmentSnapshot.score));
    form.append('max_score', String(assessmentSnapshot.maxScore));
    form.append('risk', assessmentSnapshot.risk);
    form.append('answers', JSON.stringify(answers));
    apiForm('/api/questionnaires/' + selectedQuestionnaireId + '/submissions', form)
      .then(function(data) {
        setAssessmentHistory(function(prev) { return [{ name: selectedQuestionnaire.name, date: data.submission.createdAt, risk: assessmentSnapshot.risk }].concat(prev); });
        setAssessPopupData({ name: selectedQuestionnaire.name, score: assessmentSnapshot.score, maxScore: assessmentSnapshot.maxScore, risk: assessmentSnapshot.risk, advice: assessmentSnapshot.advice });
        setShowAssessPopup(true);
      })
      .catch(function(err) { console.error('Submit error:', err); });
  }
  function handleBookAppointment() {
    if (!selectedDoctorId || !token) return;
    var form = new FormData();
    form.append('token', token);
    form.append('doctor_id', selectedDoctorId);
    form.append('mode', appointmentMode);
    form.append('appointment_date', appointmentDate);
    form.append('appointment_slot', appointmentSlot);
    form.append('reason', appointmentReason);
    apiForm('/api/appointments', form)
      .then(function() { setBookingFeed(function(prev) { return [appointmentMode + ' - 待确认'].concat(prev); }); })
      .catch(function(err) { console.error('Book error:', err); });
  }


  var activeSection = ({
    overview: (
      <div className={styles.overviewLayout}>
        <div className={styles.overviewHero}>
          <div className={styles.overviewHeroMain}>
            <h2>欢迎回来，{user.displayName || user.username || '患者'}</h2>
            <p className={styles.heroSub}>今日状态与关键入口，评估、预约、聊天统一管理。</p>
            {assessmentSnapshot.risk !== '暂无数据' && (
              <div className={styles.heroAdvice}>
                <ShieldCheck size={18} />
                <p>{assessmentSnapshot.advice}</p>
              </div>
            )}
            <div className={styles.heroActions}>
              <button className={styles.primaryButton} type="button" onClick={function() { setActiveModule('questionnaire'); }}><ClipboardList size={14} />开始评估</button>
              <button className={styles.secondaryButton} type="button" onClick={function() { setActiveModule('appointment'); }}><CalendarDays size={14} />预约咨询</button>
            </div>
          </div>
          <div className={styles.heroScoreCard}>
            <div className={styles.heroScoreValue}>{assessmentSnapshot.score}</div>
            <div className={styles.heroScoreLabel}>/ {assessmentSnapshot.maxScore} 分</div>
            <div className={styles.heroScoreBar}>
              <div className={styles.heroScoreBarFill} style={{ width: Math.round((assessmentSnapshot.score / (assessmentSnapshot.maxScore || 1)) * 100) + '%', background: assessmentSnapshot.risk === '高风险' ? '#c45c5c' : assessmentSnapshot.risk === '中风险' ? '#e8964a' : assessmentSnapshot.risk === '轻中度' ? '#e8d754' : '#5a9e6f' }} />
            </div>
            <div className={`${styles.heroRiskBadge} ${assessmentSnapshot.risk === '高风险' ? styles.heroRiskCritical : assessmentSnapshot.risk === '中风险' ? styles.heroRiskHigh : assessmentSnapshot.risk === '轻中度' ? styles.heroRiskMid : styles.heroRiskLow}`}>
              <AlertTriangle size={14} /> {assessmentSnapshot.risk}
            </div>
          </div>
        </div>

        <div className={styles.overviewQuickGrid}>
          <div className={styles.quickStat} onClick={function() { setActiveModule('questionnaire'); }}>
            <strong>{String(questionnaires.length)}</strong>
            <span>可用量表</span>
          </div>
          <div className={styles.quickStat} onClick={function() { setActiveModule('appointment'); }}>
            <strong>{String(doctors.length)}</strong>
            <span>可选医生</span>
          </div>
          <div className={styles.quickStat} onClick={function() { setActiveModule('records'); }}>
            <strong>{String(records.length)}</strong>
            <span>诊疗记录</span>
          </div>
          <div className={styles.quickStat} onClick={function() { setActiveModule('records'); }}>
            <strong>{String(emrs.length)}</strong>
            <span>电子病历</span>
          </div>
        </div>

        <div className={styles.overviewBottom}>
          <div className={styles.overviewBottomCard}>
            <h4>最近评估</h4>
            <p>上一次提交的问卷与风险变化趋势。</p>
            {assessmentHistory.length > 0 ? assessmentHistory.slice(0, 2).map(function(item) {
              return <div key={item.name + item.date} className={styles.historyItem} style={{ marginTop: 8 }}><div><strong>{item.name}</strong><p>{item.date}</p></div><StatusBadge tone={item.risk === '高风险' ? 'warning' : 'success'}>{item.risk}</StatusBadge></div>;
            }) : <p style={{ color: '#7a8b94', fontSize: 13 }}>暂无评估记录，提交问卷后将自动显示。</p>}
          </div>
          <div className={styles.overviewBottomCard}>
            <h4>推荐动作</h4>
            <p>根据当前评估结果给出的下一步建议。</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className={styles.historyItem}><div><strong>完成问卷评估</strong><p>了解当前心理状态基线</p></div><StatusBadge tone="accent">优先</StatusBadge></div>
              <div className={styles.historyItem}><div><strong>浏览可选医生</strong><p>按科室与评分匹配合适医生</p></div><StatusBadge tone="neutral">建议</StatusBadge></div>
            </div>
          </div>
        </div>
      </div>
    ),
    questionnaire: <QuestionnaireSection questionnaires={questionnaires} selectedQuestionnaireId={selectedQuestionnaireId} onSelectQuestionnaire={setSelectedQuestionnaireId} answers={answers} onAnswerChange={handleAnswerChange} assessment={assessmentSnapshot} history={assessmentHistory} onSubmit={handleAssessmentSubmit} />,
    appointment: <ConsultationSection doctors={doctors} selectedDoctorId={selectedDoctorId} setSelectedDoctorId={setSelectedDoctorId} doctorQuery={doctorQuery} setDoctorQuery={setDoctorQuery} mode={appointmentMode} setMode={setAppointmentMode} appointmentDate={appointmentDate} setAppointmentDate={setAppointmentDate} appointmentSlot={appointmentSlot} setAppointmentSlot={setAppointmentSlot} reason={appointmentReason} setReason={setAppointmentReason} bookingFeed={bookingFeed} onBook={handleBookAppointment} onOpenChat={function(doctorId) { setChatDoctorId(doctorId); setActiveModule('chat'); }} />,
    doctors: null,
    chat: <ChatDetailSection doctor={doctors.find(function(item) { return item.id === chatDoctorId; }) || doctors[0] || null} mode={chatMode} appointmentFeed={bookingFeed} onBack={function() { setActiveModule('appointment'); }} onBook={handleBookAppointment} onModeChange={setChatMode} token={token} />,
    records: (
      <div className={styles.stack}>
        <EmrSection emrs={emrs} />
        <RecordsSection records={records} archiveSummary={archiveSummary} selectedRecordId={selectedRecordId} setSelectedRecordId={setSelectedRecordId} />
        <ProfileSection user={user} />
      </div>
    ),
  })[activeModule];

  return (
    <>
      {showAssessPopup && assessPopupData && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '32px 36px', maxWidth: 440, width: '90%', boxShadow: '0 12px 40px rgba(0,0,0,0.2)', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>&#x2705;</div>
            <h3 style={{ margin: '0 0 8px', fontSize: 20, color: '#1a2b3b' }}>{'提交成功'}</h3>
            <p style={{ color: '#4a6b7c', fontSize: 14, lineHeight: 1.6, margin: '0 0 16px' }}>
              {'《' + assessPopupData.name + '》评估已提交'}
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 16 }}>
              <div style={{ textAlign: 'center', padding: '10px 20px', background: '#f7fafb', borderRadius: 10 }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#154c60' }}>{assessPopupData.score}/{assessPopupData.maxScore}</div>
                <div style={{ fontSize: 12, color: '#7a8b94' }}>{'得分'}</div>
              </div>
              <div style={{ textAlign: 'center', padding: '10px 20px', background: assessPopupData.risk === '高风险' ? '#fef0f0' : assessPopupData.risk === '中风险' ? '#fef6e8' : '#f0f7f0', borderRadius: 10 }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: assessPopupData.risk === '高风险' ? '#8b3030' : assessPopupData.risk === '中风险' ? '#9a5020' : '#3d6b3f' }}>{assessPopupData.risk}</div>
                <div style={{ fontSize: 12, color: '#7a8b94' }}>{'风险等级'}</div>
              </div>
            </div>
            <p style={{ color: '#4a6b7c', fontSize: 13, lineHeight: 1.5, margin: '0 0 20px', textAlign: 'left', background: '#f7fafb', padding: '10px 14px', borderRadius: 8 }}>{assessPopupData.advice}</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button type="button" onClick={function() { setShowAssessPopup(false); }} style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: '#2b6f9c', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>{'确定'}</button>
            </div>
          </div>
        </div>
      )}

      {showEmrPopup && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '32px 36px', maxWidth: 420, width: '90%', boxShadow: '0 12px 40px rgba(0,0,0,0.2)', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>{String.fromCodePoint(0x1F4CB)}</div>
            <h3 style={{ margin: '0 0 8px', fontSize: 20, color: '#1a2b3b' }}>新病历通知</h3>
            <p style={{ color: '#4a6b7c', fontSize: 14, lineHeight: 1.6, margin: '0 0 24px' }}>您的医生为您新增了 {newEmrCount} 份电子病历，请查看。</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button type="button" onClick={function() { setShowEmrPopup(false); }} style={{ padding: '10px 24px', borderRadius: 10, border: '1px solid #c0cdd4', background: '#fff', color: '#4a6b7c', cursor: 'pointer', fontSize: 14 }}>暂不查看</button>
              <button type="button" onClick={function() { setShowEmrPopup(false); setActiveModule('records'); }} style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: '#2b6f9c', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>查看详情</button>
            </div>
          </div>
        </div>
      )}
      <WorkspaceShell
        title="SerenePath 患者工作台"
        subtitle="导诊、问卷、咨询、聊天详情与个人中心统一放在这里。"
        roleLabel="患者端"
        user={user}
        navItems={MODULES}
        activeKey={activeModule}
        onNavigate={setActiveModule}
        onLogout={onLogout}
        sidebarTop={
          <div className={styles.sidebarTop}>
            <div className={styles.avatar}><UserRound size={28} /></div>
            <div className={styles.sidebarUserInfo}>
              <strong>{user.displayName || user.username || '患者'}</strong>
              <span>{user.role === 'patient' ? '患者' : user.title || user.role || ''}</span>
            </div>
          </div>
        }
        sidebarFooter={
          <div className={styles.footerBox}>
            <StatusBadge tone="success">已登录</StatusBadge>
            <p>页面状态集中在工作台容器中，模块之间不会互相污染。</p>
          </div>
        }
      >
        {activeSection}
      </WorkspaceShell>
    </>
  );
}
