import React from 'react';
import {
  BookOpen,
  CheckCircle2,
  ClipboardList,
  LayoutDashboard,
  Settings2,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { SectionCard } from '../../components/SectionCard.jsx';
import { StatCard } from '../../components/StatCard.jsx';
import { StatusBadge } from '../../components/StatusBadge.jsx';
import { WorkspaceShell } from '../../components/WorkspaceShell.jsx';
import styles from './AdminDashboard.module.css';
import { apiForm, apiJson } from '../../utils/api.js';
import { STORAGE_TOKEN_KEY } from '../../constants.js';

const MODULES = [
  { key: 'overview', label: '总览', hint: '系统运行与待办', icon: LayoutDashboard },
  { key: 'review', label: '资质审核', hint: '医生、机构与账号', icon: Users },
  { key: 'knowledge', label: '量表/知识库', hint: '内容维护与校验', icon: BookOpen },
  { key: 'config', label: '配置中心', hint: '阈值、角色与策略', icon: Settings2 },
];

const REVIEW_ITEMS = [];

export function AdminDashboard({ user, onLogout }) {
  const [activeModule, setActiveModule] = React.useState('overview');
  const [reviews, setReviews] = React.useState(REVIEW_ITEMS);
  const [selectedReviewId, setSelectedReviewId] = React.useState('');
  const [summaryData, setSummaryData] = React.useState({ pendingReviews: 0, knowledgeItems: 0, doctors: 0 });
  const [threshold, setThreshold] = React.useState('0.65');
  const [allowAnonymousAudio, setAllowAnonymousAudio] = React.useState(true);
  const [allowSelfBooking, setAllowSelfBooking] = React.useState(true);

  const token = React.useMemo(function() { return localStorage.getItem(STORAGE_TOKEN_KEY) || ''; }, []);

const [knowledgeStatus, setKnowledgeStatus] = React.useState('已同步');
  const [profileDrafts, setProfileDrafts] = React.useState([]);
  const [selectedDraftId, setSelectedDraftId] = React.useState("");
  React.useEffect(function() {
    if (!token) return;
    Promise.all([
      apiJson('/api/admin/reviews?token=' + encodeURIComponent(token)).then(function(d) { return d.reviews || []; }),
      apiJson('/api/admin/summary?token=' + encodeURIComponent(token)).then(function(d) { return d.summary || {}; }),
      apiJson('/api/admin/config?token=' + encodeURIComponent(token)).then(function(d) { return d.config || {}; }),
      apiJson("/api/admin/profile-drafts?token=" + encodeURIComponent(token) + "&status=pending").then(function(d) { return d.drafts || []; })
    ]).then(function(results) {
      var revs = results[0], summary = results[1], config = results[2], drafts = results[3];
      if (revs.length > 0) { setReviews(revs); setSelectedReviewId(revs[0].id); }
      if (drafts.length > 0) { setProfileDrafts(drafts); setSelectedDraftId(drafts[0].id); }
      setSummaryData(summary);
      if (config.riskThreshold !== undefined) setThreshold(String(config.riskThreshold));
      if (config.allowAnonymousAudio !== undefined) setAllowAnonymousAudio(config.allowAnonymousAudio);
      if (config.allowSelfBooking !== undefined) setAllowSelfBooking(config.allowSelfBooking);
    }).catch(function(err) { console.error('Admin data load error:', err); });
  }, [token]);
  
  const selectedReview = reviews.find((item) => item.id === selectedReviewId) || reviews[0] || null;
  const stats = [
    { label: 'Pending', value: String(summaryData.pendingReviews || 0), hint: 'Reviews awaiting approval' },
    { label: 'Knowledge', value: String(summaryData.knowledgeItems || 0), hint: 'Knowledge base items' },
    { label: 'Doctors', value: String(summaryData.doctors || 0), hint: 'Active doctor accounts' },
    { label: 'System', value: 'OK', hint: 'Core config operational' },
  ];

  const activeSection = {
    overview: (
      <div className={styles.stack}>
        <SectionCard
          title="管理总览"
          description="先看待办、同步状态和关键配置。"
          icon={<LayoutDashboard size={16} />}
          action={<StatusBadge tone="accent">管理端</StatusBadge>}
        >
          <div className={styles.metricGrid}>
            {stats.map((item) => (
              <StatCard key={item.label} label={item.label} value={item.value} hint={item.hint} />
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="系统提示"
          description="可见的操作状态集中显示在这里。"
          icon={<ShieldAlert size={16} />}
          action={<StatusBadge tone="success">{knowledgeStatus}</StatusBadge>}
        >
          <div className={styles.noticeBlock}>
            <div>
              <strong>匿名语音和自助预约保持开启</strong>
              <p>如需调整权限，可进入配置中心同步修改。</p>
            </div>
            <StatusBadge tone="neutral">实时</StatusBadge>
          </div>
        </SectionCard>
      </div>
    ),
    review: (<>
      <SectionCard
        title="资质审核"
        description="审核医生、机构和基础资料。"
        icon={<Users size={16} />}
        action={<StatusBadge tone="warning">{reviews.length} 条待处理</StatusBadge>}
      >
        <div className={styles.reviewLayout}>
          <div className={styles.reviewList}>
            {reviews.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`${styles.reviewCard} ${selectedReviewId === item.id ? styles.reviewCardActive : ''}`}
                onClick={() => setSelectedReviewId(item.id)}
              >
                <strong>{item.name}</strong>
                <p>{item.note}</p>
                <StatusBadge tone={item.tone}>{item.status}</StatusBadge>
              </button>
            ))}
          </div>
          <div className={styles.reviewDetail}>
            {selectedReview ? (
              <>
                <h3>{selectedReview.name}</h3>
                <p>{selectedReview.note}</p>
                <div className={styles.reviewActions}>
                  <button className={styles.primaryButton} type="button" onClick={function() {
                    var form = new FormData();
                    form.append("token", token);
                    apiForm("/api/admin/reviews/" + selectedReviewId + "/approve", form)
                      .then(function() { alert("Approved"); setReviews(function(prev) { return prev.map(function(r) { return r.id === selectedReviewId ? Object.assign({}, r, { status: "Approved", tone: "success" }) : r; }); }); })
                      .catch(function(err) { alert("Error: " + err.message); });
                  }}>
                    通过
                  </button>
                  <button className={styles.secondaryButton} type="button" onClick={function() {
                    var form = new FormData();
                    form.append("token", token);
                    apiForm("/api/admin/reviews/" + selectedReviewId + "/reject", form)
                      .then(function() { alert("Rejected"); setReviews(function(prev) { return prev.map(function(r) { return r.id === selectedReviewId ? Object.assign({}, r, { status: "Rejected", tone: "danger" }) : r; }); }); })
                      .catch(function(err) { alert("Error: " + err.message); });
                  }}>
                    退回
                  </button>
                </div>
              </>
            ) : (
              <p className={styles.emptyHint}>暂无待审核项</p>
            )}
          </div>
        </div>
      </SectionCard>
        <SectionCard
          title="医生个人资料审核"
          description="医生提交的个人信息变更，审核通过后同步到患者端。"
          icon={<Users size={16} />}
          action={<StatusBadge tone={profileDrafts.length > 0 ? "warning" : "neutral"}>{profileDrafts.length} 条待审核</StatusBadge>}
        >
          {profileDrafts.length > 0 ? (
            <div className={styles.reviewLayout}>
              <div className={styles.reviewList}>
                {profileDrafts.map(function(item) {
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`${styles.reviewCard} ${selectedDraftId === item.id ? styles.reviewCardActive : ""}`}
                      onClick={function() { setSelectedDraftId(item.id); }}
                    >
                      <strong>{item.doctorName}</strong>
                      <p>{"更新 " + Object.keys(item.payload).length + " 项资料"}</p>
                      <StatusBadge tone={item.status === "approved" ? "success" : item.status === "rejected" ? "danger" : "warning"}>{item.status === "approved" ? "已通过" : item.status === "rejected" ? "已退回" : "待审核"}</StatusBadge>
                    </button>
                  );
                })}
              </div>
              <div className={styles.reviewDetail}>
                {(() => {
                  var d = profileDrafts.find(function(item) { return item.id === selectedDraftId; }) || profileDrafts[0];
                  if (!d) return <p className={styles.emptyHint}>请选择一条审核项</p>;
                  var fieldLabels = { name: "姓名", department: "科室", title: "职称", specialty: "擅长领域", schedule: "排班时间", intro: "个人介绍", education: "教育背景", experience: "临床经验", publications: "发表论文", reviews: "患者评价", availabilities: "可预约时段" };
                  return (
                    <>
                      <h3>{d.doctorName}</h3>
                      <p>{d.status === "approved" ? "审核已通过，资料已同步到患者端。" : d.status === "rejected" ? "审核已退回。" : "以下资料待审核，通过后将更新到患者端。"}</p>
                      <div className={styles.profileDraftFields}>
                        {Object.keys(d.payload).map(function(key) {
                          var val = d.payload[key];
                          var displayVal = Array.isArray(val) ? val.join(", ") : String(val);
                          return (
                            <div key={key} className={styles.profileDraftField}>
                              <span>{fieldLabels[key] || key}</span>
                              <strong>{displayVal}</strong>
                            </div>
                          );
                        })}
                      </div>
                      {d.status === "pending" || !d.status ? (<>
                        <button className={styles.primaryButton} type="button" onClick={function() {
                          var form = new FormData();
                          form.append("token", token);
                          apiForm("/api/admin/profile-drafts/" + d.id + "/approve", form)
                            .then(function() { alert("已通过，资料已同步到患者端。"); setProfileDrafts(function(prev) { return prev.map(function(item) { return item.id === d.id ? Object.assign({}, item, { status: "approved" }) : item; }); }); })
                            .catch(function(err) { alert("Error: " + err.message); });
                        }}>通过</button>
                        <button className={styles.secondaryButton} type="button" onClick={function() {
                          var form = new FormData();
                          form.append("token", token);
                          form.append("note", "管理员退回");
                          apiForm("/api/admin/profile-drafts/" + d.id + "/reject", form)
                            .then(function() { alert("已退回"); setProfileDrafts(function(prev) { return prev.map(function(item) { return item.id === d.id ? Object.assign({}, item, { status: "rejected" }) : item; }); }); })
                            .catch(function(err) { alert("Error: " + err.message); });
                        }}>退回</button>
                        </>) : (
                        <StatusBadge tone={d.status === "approved" ? "success" : "danger"}>{d.status === "approved" ? "已通过" : "已退回"}</StatusBadge>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          ) : (
            <p className={styles.emptyHint}>暂无医生提交个人资料审核。</p>
          )}
        </SectionCard>

    </>),
    knowledge: (
      <SectionCard
        title="量表 / 知识库管理"
        description="维护问卷、说明文档和导诊策略。"
        icon={<BookOpen size={16} />}
        action={<StatusBadge tone="success">{knowledgeStatus}</StatusBadge>}
      >
        <div className={styles.knowledgeGrid}>
          <div className={styles.knowledgeCard}>
            <h3>量表校验</h3>
            <p>PHQ-9、GAD-7 和 SCL-90 的条目已同步。</p>
          </div>
          <div className={styles.knowledgeCard}>
            <h3>知识条目</h3>
            <p>初诊、复诊和风险提示模板正在统一维护。</p>
          </div>
          <div className={styles.knowledgeCard}>
            <h3>同步状态</h3>
            <p>最新知识库版本已经推送到工作台。</p>
          </div>
        </div>
        <div className={styles.inlineNote}>
          <CheckCircle2 size={16} />
          <span>知识库更新后，患者端和医生端会使用同一套导诊说明。</span>
        </div>
      </SectionCard>
    ),
    config: (
      <SectionCard
        title="配置中心"
        description="管理阈值、匿名能力和自助预约开关。"
        icon={<Settings2 size={16} />}
        action={<StatusBadge tone="accent">可编辑</StatusBadge>}
      >
        <div className={styles.configLayout}>
          <label className={styles.field}>
            <span>风险阈值</span>
            <input value={threshold} onChange={(event) => setThreshold(event.target.value)} />
          </label>
          <label className={styles.switchRow}>
            <input type="checkbox" checked={allowAnonymousAudio} onChange={(event) => setAllowAnonymousAudio(event.target.checked)} />
            <span>允许匿名语音</span>
          </label>
          <label className={styles.switchRow}>
            <input type="checkbox" checked={allowSelfBooking} onChange={(event) => setAllowSelfBooking(event.target.checked)} />
            <span>允许患者自助预约</span>
          </label>
          <button className={styles.primaryButton} type="button" style={{ marginTop: 16 }} onClick={function() {
            var form = new FormData();
            form.append("token", token);
            form.append("riskThreshold", threshold);
            form.append("allowAnonymousAudio", String(allowAnonymousAudio));
            form.append("allowSelfBooking", String(allowSelfBooking));
            apiForm("/api/admin/config", form)
              .then(function() { alert("Config saved"); })
              .catch(function(err) { alert("Error: " + err.message); });
          }}>Save Config</button>
        </div>
      </SectionCard>
    ),
  }[activeModule];

  return (
    <WorkspaceShell
      title="SerenePath 管理工作台"
      subtitle="资质审核、知识维护和系统配置都在这里。"
      roleLabel="管理端"
      user={user}
      navItems={MODULES}
      activeKey={activeModule}
      onNavigate={setActiveModule}
      onLogout={onLogout}
      sidebarTop={
        <div className={styles.sidebarTop}>
          <div className={styles.avatar}>A</div>
          <div>
            <h2>{user?.displayName || user?.username || '管理员'}</h2>
            <p>审核、配置与同步都从这里开始。</p>
          </div>
        </div>
      }
      sidebarFooter={
        <div className={styles.footerBox}>
          <StatusBadge tone="success">配置已同步</StatusBadge>
          <p>管理端聚焦审核与策略，不影响登录页本身。</p>
        </div>
      }
    >
      {activeSection}
    </WorkspaceShell>
  );
}
