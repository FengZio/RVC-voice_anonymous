import React from 'react';
import { CalendarDays, CheckCircle2, MessageSquare } from 'lucide-react';
import { Pill } from '../ui/shared.jsx';
import { doctors } from './patientData.js';

export function AppointmentSection({ refNode }) {
  const [doctorDepartment, setDoctorDepartment] = React.useState('全部');
  const [doctorTitle, setDoctorTitle] = React.useState('全部');
  const [doctorSort, setDoctorSort] = React.useState('rating');
  const [selectedDoctorId, setSelectedDoctorId] = React.useState(doctors[0]?.id || '');
  const [appointmentMode, setAppointmentMode] = React.useState('现场面诊');
  const [appointmentDate, setAppointmentDate] = React.useState('2026-06-26');
  const [appointmentSlot, setAppointmentSlot] = React.useState(doctors[0]?.availabilities?.[0] || '');
  const [appointmentReason, setAppointmentReason] = React.useState('最近持续紧张、睡眠变差，希望先完成初诊评估。');
  const [bookingFeed, setBookingFeed] = React.useState([
    { id: 'a1', doctor: '林安澜', time: '2026-06-27 09:00', mode: '视频门诊', status: '待确认' },
    { id: 'a2', doctor: '周宁', time: '2026-07-01 13:30', mode: '现场面诊', status: '已确认' },
  ]);
  const [hint, setHint] = React.useState('可以直接选择医生并发起在线沟通。');

  const selectedDoctor = doctors.find((item) => item.id === selectedDoctorId) || doctors[0] || { id: "", name: "加载中...", title: "", department: "", availabilities: [] };
  const departmentOptions = ['全部', ...new Set(doctors.map((item) => item.department))];
  const titleOptions = ['全部', ...new Set(doctors.map((item) => item.title))];
  const filteredDoctors = doctors
    .filter((doctor) => {
      const matchesDepartment = doctorDepartment === '全部' || doctor.department === doctorDepartment;
      const matchesTitle = doctorTitle === '全部' || doctor.title === doctorTitle;
      return matchesDepartment && matchesTitle;
    })
    .sort((a, b) => {
      if (doctorSort === 'rating') return b.rating - a.rating;
      if (doctorSort === 'satisfaction') return b.satisfaction - a.satisfaction;
      return a.name.localeCompare(b.name, 'zh-Hans-CN');
    });

  React.useEffect(() => {
    if (selectedDoctor && !selectedDoctor.availabilities.includes(appointmentSlot)) {
      setAppointmentSlot(selectedDoctor.availabilities[0] || '');
    }
  }, [appointmentSlot, selectedDoctor]);

  function handleBookAppointment() {
    if (!selectedDoctor || !appointmentSlot) {
      setHint('请选择医生和可用时段后再提交预约。');
      return;
    }
    const entry = {
      id: `a${Date.now()}`,
      doctor: selectedDoctor.name,
      time: `${appointmentDate} ${appointmentSlot}`,
      mode: appointmentMode,
      status: '待确认',
    };
    setBookingFeed((current) => [entry, ...current]);
    setHint(`已提交 ${selectedDoctor.name} 的预约申请，稍后可在“我的预约”查看。`);
  }

  function handleContact(type) {
    setHint(type === 'chat'
      ? `已为你打开与 ${selectedDoctor.name} 的在线聊天入口。`
      : `已为你打开与 ${selectedDoctor.name} 的语音通话入口。`);
  }

  return (
    <section className="panel modulePanel" ref={refNode}>
      <div className="panelHead">
        <div>
          <h2>预约挂号服务</h2>
          <p>浏览医生排班，选择就诊形式并提交预约申请。</p>
        </div>
        <CalendarDays size={16} />
      </div>
      <div className="bookingLayout">
        <div className="bookingForm">
          <div className="field">
            <span>就诊形式</span>
            <div className="segmented">
              {['现场面诊', '视频门诊', '电话咨询'].map((mode) => (
                <button key={mode} type="button" className={appointmentMode === mode ? 'segActive' : ''} onClick={() => setAppointmentMode(mode)}>
                  {mode}
                </button>
              ))}
            </div>
          </div>
          <div className="settingsGrid appointmentSettings">
            <label className="field">
              <span>预约日期</span>
              <input type="date" value={appointmentDate} onChange={(event) => setAppointmentDate(event.target.value)} />
            </label>
            <label className="field">
              <span>预约时段</span>
              <select value={appointmentSlot} onChange={(event) => setAppointmentSlot(event.target.value)}>
                {selectedDoctor.availabilities.map((slot) => <option key={slot} value={slot}>{slot}</option>)}
              </select>
            </label>
          </div>
          <label className="field">
            <span>就诊原因</span>
            <textarea value={appointmentReason} onChange={(event) => setAppointmentReason(event.target.value)} />
          </label>
          <div className="bookingPreview">
            <div>
              <strong>{selectedDoctor.name}</strong>
              <p>{selectedDoctor.title} · {selectedDoctor.department}</p>
            </div>
            <Pill tone="accent">{appointmentMode}</Pill>
          </div>
          <div className="appointmentActions">
            <button className="primaryButton" type="button" onClick={handleBookAppointment}>
              <CalendarDays size={16} />
              提交预约
            </button>
            <button className="ghostButton" type="button" onClick={() => handleContact('chat')}>
              <MessageSquare size={16} />
              在线聊天
            </button>
          </div>
          <div className="bookingHint">{hint}</div>
        </div>
        <div className="appointmentSide">
          <div className="panelMiniHead">
            <div>
              <h3>我的预约</h3>
              <p>确认信息与提醒会集中显示在这里。</p>
            </div>
            <Pill tone="neutral">{bookingFeed.length} 条</Pill>
          </div>
          <div className="bookingList">
            {bookingFeed.map((item) => (
              <article className="bookingItem" key={item.id}>
                <div>
                  <strong>{item.doctor}</strong>
                  <p>{item.time}</p>
                  <span>{item.mode}</span>
                </div>
                <Pill tone={item.status === '已确认' ? 'success' : 'warning'}>{item.status}</Pill>
              </article>
            ))}
          </div>
          <div className="scheduleNote">
            <CheckCircle2 size={16} />
            <span>预约成功后会在“我的预约”中显示确认信息和就诊提醒。</span>
          </div>
        </div>
      </div>
    </section>
  );
}
