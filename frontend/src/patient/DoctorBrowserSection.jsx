import React from 'react';
import { CalendarDays, CheckCircle2, MessageSquare, Mic, Stethoscope } from 'lucide-react';
import { Pill } from '../ui/shared.jsx';
import { doctors } from './patientData.js';

export function DoctorBrowserSection({ refNode }) {
  const [doctorQuery] = React.useState('');
  const [selectedDoctorId, setSelectedDoctorId] = React.useState(doctors[0]?.id || '');
  const [doctorDepartment, setDoctorDepartment] = React.useState('全部');
  const [doctorTitle, setDoctorTitle] = React.useState('全部');
  const [doctorSort, setDoctorSort] = React.useState('rating');

  const selectedDoctor = doctors.find((item) => item.id === selectedDoctorId) || doctors[0] || { id: "", name: "加载中...", title: "", department: "", specialty: "", schedule: "", education: "", intro: "", experience: "", rating: 0, satisfaction: 0, reviews: [], publications: [], availabilities: [] };
  const departmentOptions = ['全部', ...new Set(doctors.map((item) => item.department))];
  const titleOptions = ['全部', ...new Set(doctors.map((item) => item.title))];
  const filteredDoctors = doctors
    .filter((doctor) => {
      const query = doctorQuery.trim().toLowerCase();
      const matchesQuery = !query || [doctor.name, doctor.department, doctor.title, doctor.specialty].some((item) => item.toLowerCase().includes(query));
      const matchesDepartment = doctorDepartment === '全部' || doctor.department === doctorDepartment;
      const matchesTitle = doctorTitle === '全部' || doctor.title === doctorTitle;
      return matchesQuery && matchesDepartment && matchesTitle;
    })
    .sort((a, b) => {
      if (doctorSort === 'rating') return b.rating - a.rating;
      if (doctorSort === 'satisfaction') return b.satisfaction - a.satisfaction;
      return a.name.localeCompare(b.name, 'zh-Hans-CN');
    });

  function handleReserveDoctor(doctor) {
    setSelectedDoctorId(doctor.id);
  }

  return (
    <section className="panel modulePanel" ref={refNode}>
      <div className="panelHead">
        <div>
          <h2>医生浏览与选择</h2>
          <p>支持按科室、职称、擅长领域和评分进行筛选与排序。</p>
        </div>
        <Stethoscope size={16} />
      </div>
      <div className="doctorBrowserLayout">
        <div className="doctorFilterPanel">
          <div className="settingsGrid doctorFilters">
            <label className="field">
              <span>搜索医生</span>
              <input type="text" placeholder="姓名、擅长、科室" />
            </label>
            <label className="field">
              <span>科室</span>
              <select value={doctorDepartment} onChange={(event) => setDoctorDepartment(event.target.value)}>
                {departmentOptions.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="field">
              <span>职称</span>
              <select value={doctorTitle} onChange={(event) => setDoctorTitle(event.target.value)}>
                {titleOptions.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="field">
              <span>排序</span>
              <select value={doctorSort} onChange={(event) => setDoctorSort(event.target.value)}>
                <option value="rating">满意度优先</option>
                <option value="satisfaction">推荐度优先</option>
                <option value="name">姓名排序</option>
              </select>
            </label>
          </div>
          <div className="doctorList">
            {filteredDoctors.map((doctor) => (
              <button key={doctor.id} type="button" className={`doctorCard ${selectedDoctorId === doctor.id ? 'doctorCard-active' : ''}`} onClick={() => setSelectedDoctorId(doctor.id)}>
                <div className="doctorCardTop">
                  <div>
                    <strong>{doctor.name}</strong>
                    <p>{doctor.title} · {doctor.department}</p>
                  </div>
                  <Pill tone="accent">{doctor.rating.toFixed(1)}</Pill>
                </div>
                <span>{doctor.specialty}</span>
                <div className="doctorCardMeta">
                  <small>{doctor.schedule}</small>
                  <small>满意度 {doctor.satisfaction}%</small>
                </div>
              </button>
            ))}
          </div>
        </div>
        <div className="doctorDetailPanel">
          <div className="panelMiniHead">
            <div>
              <h3>{selectedDoctor.name}</h3>
              <p>{selectedDoctor.title} · {selectedDoctor.department}</p>
            </div>
            <Pill tone="accent">评分 {selectedDoctor.rating.toFixed(1)}</Pill>
          </div>
          <div className="doctorDetailMeta">
            <div><span>擅长</span><strong>{selectedDoctor.specialty}</strong></div>
            <div><span>出诊</span><strong>{selectedDoctor.schedule}</strong></div>
            <div><span>满意度</span><strong>{selectedDoctor.satisfaction}%</strong></div>
            <div><span>教育背景</span><strong>{selectedDoctor.education}</strong></div>
          </div>
          <p className="doctorIntro">{selectedDoctor.intro}</p>
          <div className="doctorExperience">
            <div>
              <span>从业经历</span>
              <p>{selectedDoctor.experience}</p>
            </div>
            <div>
              <span>论文 / 著作</span>
              <ul>
                {selectedDoctor.publications.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          </div>
          <div className="doctorReviews">
            {selectedDoctor.reviews.map((item) => (
              <div key={item} className="reviewRow">
                <CheckCircle2 size={14} />
                <span>{item}</span>
              </div>
            ))}
          </div>
          <div className="doctorActions">
            <button className="primaryButton" type="button" onClick={() => handleReserveDoctor(selectedDoctor)}>
              <CalendarDays size={16} />
              预约此医生
            </button>
            <button className="ghostButton" type="button">
              <MessageSquare size={16} />
              在线聊天
            </button>
            <button className="ghostButton" type="button">
              <Mic size={16} />
              语音通话
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
