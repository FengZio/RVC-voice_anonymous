import React from 'react';
import { ClipboardList, Download, FileUser } from 'lucide-react';
import { Pill } from '../ui/shared.jsx';
import { archiveSummary, records } from './patientData.js';

export function RecordsSection({ refNode }) {
  const [selectedRecordId, setSelectedRecordId] = React.useState(records[0]?.id || '');
  const selectedRecord = records.find((item) => item.id === selectedRecordId) || records[0] || {};

  return (
    <section className="panel modulePanel" ref={refNode}>
      <div className="panelHead">
        <div>
          <h2>诊疗记录与健康档案管理</h2>
          <p>诊疗记录、自测结果、病情变化和家庭病史会在这里统一展示。</p>
        </div>
        <FileUser size={16} />
      </div>
      <div className="recordLayout">
        <div className="recordTimeline">
          {records.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`recordCard ${selectedRecordId === item.id ? 'recordCard-active' : ''}`}
              onClick={() => setSelectedRecordId(item.id)}
            >
              <div className="recordCardTop">
                <strong>{item.title}</strong>
                <Pill tone="neutral">{item.date}</Pill>
              </div>
              <p>{item.doctor}</p>
              <span>{item.diagnosis}</span>
            </button>
          ))}
        </div>
        <div className="recordDetailPanel">
          <div className="panelMiniHead">
            <div>
              <h3>{selectedRecord.title}</h3>
              <p>{selectedRecord.date} · {selectedRecord.doctor}</p>
            </div>
            <Download size={16} />
          </div>
          <div className="recordDetailGrid">
            <div><span>初步诊断</span><strong>{selectedRecord.diagnosis}</strong></div>
            <div><span>治疗方案</span><strong>{selectedRecord.plan}</strong></div>
            <div><span>处方信息</span><strong>{selectedRecord.prescription}</strong></div>
            <div><span>复诊建议</span><strong>{selectedRecord.followUp}</strong></div>
          </div>
          <div className="reportCard">
            <div className="panelMiniHead">
              <div>
                <h3>自测与病程摘要</h3>
                <p>可直接供医生后续诊疗参考。</p>
              </div>
              <ClipboardList size={16} />
            </div>
            <p className="doctorIntro">{selectedRecord.report}</p>
          </div>
          <div className="archiveGrid">
            {archiveSummary.map((item) => (
              <div className="archiveCard" key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <p>{item.note}</p>
              </div>
            ))}
          </div>
          <div className="trendStack">
            <div className="trendRow">
              <span>情绪波动</span>
              <div className="trendBar"><i style={{ width: '62%' }} /></div>
            </div>
            <div className="trendRow">
              <span>睡眠质量</span>
              <div className="trendBar"><i style={{ width: '44%' }} /></div>
            </div>
            <div className="trendRow">
              <span>用药规律</span>
              <div className="trendBar"><i style={{ width: '88%' }} /></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
