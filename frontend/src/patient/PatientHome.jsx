import React from 'react';
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Download,
  FileUser,
  HeartPulse,
  Home,
  LogOut,
  MessageSquare,
  Mic,
  Stethoscope,
  UserRound,
} from 'lucide-react';
import { Pill, MetricCard } from '../ui/shared.jsx';
import { AssessmentSection } from './AssessmentSection.jsx';
import { AppointmentSection } from './AppointmentSection.jsx';
import { DoctorBrowserSection } from './DoctorBrowserSection.jsx';
import { RecordsSection } from './RecordsSection.jsx';

export function PatientHome({ user, onLogout }) {
  const [activeModule, setActiveModule] = React.useState('overview');
  const moduleRefs = React.useRef({});

  const currentPatient = {
    name: user.displayName,
    status: '待初评',
    details: '先做症状自测，再进入预约和医生选择。',
  };

  const summaryCards = [
    { label: '今日自测', value: '1/5', hint: '系统会自动生成初步评估' },
    { label: '我的预约', value: '2', hint: '支持取消和改签' },
    { label: '可选医生', value: '3', hint: '按条件筛选后展示' },
    { label: '健康档案', value: '3 条', hint: '包含诊疗记录和趋势' },
  ];

  const patientModules = [
    { id: 'overview', label: '总览', icon: Home, hint: '今日状态与入口' },
    { id: 'assessment', label: '症状自测', icon: ClipboardList, hint: 'SAS、SDS 等量表' },
    { id: 'appointment', label: '预约挂号', icon: CalendarDays, hint: '医生、时段、形式' },
    { id: 'doctors', label: '医生浏览', icon: Stethoscope, hint: '筛选、详情、联系' },
    { id: 'records', label: '诊疗记录', icon: FileUser, hint: '病程、档案与趋势' },
  ];

  function scrollToModule(id) {
    setActiveModule(id);
    moduleRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <main className="appShell appFrame patientDashboardShell patientRefactorShell">
      <header className="topBar shellBar patientTopBar">
        <div className="brandBlock">
          <div className="brandMark">
            <HeartPulse size={18} />
          </div>
          <div>
            <div className="brandName">SerenePath 患者端</div>
            <p className="brandSubtitle">症状自测、预约挂号、医生浏览与健康档案</p>
          </div>
        </div>
        <div className="topBarStatus">
          <Pill tone="accent">已登录：{user.displayName}</Pill>
          <Pill tone="neutral">初步评估</Pill>
          <button className="iconButton" type="button" title="退出" onClick={onLogout}>
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <section className="patientLayout">
        <aside className="panel patientSidebar">
          <div className="panelHead">
            <div>
              <h2>患者看板</h2>
              <p>功能按模块组织，先看状态再做操作。</p>
            </div>
            <Pill tone="accent">Dashboard</Pill>
          </div>
          <div className="patientHeroPanel">
            <div className="patientIntro">
              <div className="patientAvatar">
                <UserRound size={32} />
              </div>
              <div>
                <h3>{currentPatient.name}</h3>
                <p>{currentPatient.details}</p>
                <div className="chipRow">
                  <Pill tone="neutral">{currentPatient.status}</Pill>
                  <Pill tone="success">问卷自测</Pill>
                  <Pill tone="accent">预约就诊</Pill>
                </div>
              </div>
            </div>
            <div className="statsGrid patientStats patientMiniStats">
              <MetricCard label="导诊状态" value="进行中" hint="按四个模块逐步完成" />
              <MetricCard label="健康档案" value="3 条" hint="包含诊疗记录和趋势" />
            </div>
          </div>
          <div className="navPanel">
            <div className="panelHead compactHead">
              <div>
                <h3>功能模块</h3>
                <p>点击即可跳转。</p>
              </div>
            </div>
            <div className="navStack">
              {patientModules.map((module) => {
                const Icon = module.icon;
                return (
                  <button
                    key={module.id}
                    className={`navCard ${activeModule === module.id ? 'navCard-active' : ''}`}
                    type="button"
                    onClick={() => scrollToModule(module.id)}
                  >
                    <Icon size={16} />
                    <span>
                      {module.label}
                      <small>{module.hint}</small>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        <div className="mainColumn patientMainColumn">
          <section className="panel modulePanel" ref={(node) => { moduleRefs.current.overview = node; }}>
            <div className="panelHead">
              <div>
                <h2>患者总览</h2>
                <p>先看状态，再进入自测、挂号、医生与档案。</p>
              </div>
            </div>
            <div className="dashboardBand">
              {summaryCards.map((item) => (
                <MetricCard key={item.label} label={item.label} value={item.value} hint={item.hint} />
              ))}
            </div>
          </section>

          <AssessmentSection refNode={(node) => { moduleRefs.current.assessment = node; }} />
          <AppointmentSection refNode={(node) => { moduleRefs.current.appointment = node; }} />
          <DoctorBrowserSection refNode={(node) => { moduleRefs.current.doctors = node; }} />
          <RecordsSection refNode={(node) => { moduleRefs.current.records = node; }} />
        </div>
      </section>
    </main>
  );
}
