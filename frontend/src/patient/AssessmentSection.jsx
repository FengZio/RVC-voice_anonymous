import React from 'react';
import { ArrowRight, ClipboardList, Download } from 'lucide-react';
import { Pill, MetricCard } from '../ui/shared.jsx';
import { questionnaires } from './patientData.js';

function riskTone(label) {
  if (label.includes('高')) return 'warning';
  if (label.includes('中')) return 'accent';
  if (label.includes('轻')) return 'success';
  return 'neutral';
}

export function AssessmentSection({ refNode }) {
  const [selectedQuestionnaire, setSelectedQuestionnaire] = React.useState('phq9');
  const [assessmentAnswers, setAssessmentAnswers] = React.useState([1, 1, 2, 1, 1]);
  const [assessmentHistory, setAssessmentHistory] = React.useState([
    { date: '2026-06-20', name: 'GAD-7', score: 11, risk: '中风险' },
    { date: '2026-06-12', name: 'PHQ-9', score: 8, risk: '轻中度' },
  ]);
  const [assessmentResult, setAssessmentResult] = React.useState(null);

  const selectedTemplate = questionnaires.find((item) => item.id === selectedQuestionnaire) || questionnaires[0] || { questions: [], name: "加载中...", scale: "", items: 0, advice: "" };
  const assessmentScore = assessmentAnswers.reduce((sum, item) => sum + Number(item || 0), 0);
  const assessmentMax = selectedTemplate.questions.length * 4;
  const assessmentRatio = assessmentMax ? assessmentScore / assessmentMax : 0;
  const assessmentRisk = assessmentRatio >= 0.8 ? '高风险' : assessmentRatio >= 0.55 ? '中风险' : assessmentRatio >= 0.3 ? '轻中度' : '低风险';
  const assessmentAdvice = assessmentRatio >= 0.8
    ? '建议尽快预约心理科或精神科，必要时联系家属陪同。'
    : assessmentRatio >= 0.55
      ? '建议在一周内完成门诊咨询，并结合生活方式干预。'
      : assessmentRatio >= 0.3
        ? '可先观察 1-2 周并保持规律作息，关注波动。'
        : '目前仅作初步参考，继续保持自我监测即可。';

  function handleAssessmentChange(index, value) {
    setAssessmentAnswers((current) => current.map((item, position) => (position === index ? Number(value) : item)));
  }

  function handleAssessmentSubmit() {
    const snapshot = {
      date: new Date().toISOString().slice(0, 10),
      name: selectedTemplate.name,
      score: assessmentScore,
      risk: assessmentRisk,
    };
    setAssessmentResult({
      questionnaire: selectedTemplate.name,
      score: assessmentScore,
      maxScore: assessmentMax,
      risk: assessmentRisk,
      advice: assessmentAdvice,
    });
    setAssessmentHistory((current) => [snapshot, ...current].slice(0, 4));
  }

  return (
    <section className="panel modulePanel" ref={refNode}>
      <div className="panelHead">
        <div>
          <h2>症状自测与初步评估</h2>
          <p>完成标准化量表后，系统会自动给出得分、风险等级和就医建议。</p>
        </div>
        <ClipboardList size={16} />
      </div>
      <div className="assessmentLayout">
        <div className="assessmentList">
          {questionnaires.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`navCard assessmentCard ${selectedQuestionnaire === item.id ? 'navCard-active' : ''}`}
              onClick={() => {
                setSelectedQuestionnaire(item.id);
                setAssessmentAnswers(new Array(item.questions.length).fill(1));
              }}
            >
              <span>
                {item.name}
                <small>{item.description}</small>
              </span>
              <Pill tone="neutral">{item.tag}</Pill>
            </button>
          ))}
        </div>
        <div className="assessmentForm">
          <div className="panelMiniHead">
            <div>
              <h3>{selectedTemplate.name}</h3>
              <p>{selectedTemplate.scale} · 共 {selectedTemplate.items} 项</p>
            </div>
            <Pill tone={riskTone(assessmentRisk)}>{assessmentRisk}</Pill>
          </div>
          <div className="questionList">
            {selectedTemplate.questions.map((question, index) => (
              <label className="questionRow" key={question}>
                <span>{question}</span>
                <div className="questionControl">
                  <input type="range" min="0" max="4" step="1" value={assessmentAnswers[index] ?? 0} onChange={(event) => handleAssessmentChange(index, event.target.value)} />
                  <div className="questionScale">
                    <span>0</span>
                    <span>4</span>
                  </div>
                </div>
              </label>
            ))}
          </div>
          <div className="assessmentActions">
            <button className="primaryButton" type="button" onClick={handleAssessmentSubmit}>
              <ArrowRight size={16} />
              生成评估报告
            </button>
            <span className="logHint">{selectedTemplate.advice}</span>
          </div>
        </div>
        <div className="scorePanel">
          <MetricCard label="当前得分" value={`${assessmentScore} / ${assessmentMax}`} hint="分数会随选择即时变化" />
          <MetricCard label="风险提示" value={assessmentRisk} hint={assessmentAdvice} />
          <div className="reportCard">
            <div className="panelMiniHead">
              <div>
                <h3>初步评估报告</h3>
                <p>提交后会自动更新评估摘要。</p>
              </div>
              <Download size={16} />
            </div>
            {assessmentResult ? (
              <div className="reportStack">
                <p><strong>问卷：</strong>{assessmentResult.questionnaire}</p>
                <p><strong>得分：</strong>{assessmentResult.score} / {assessmentResult.maxScore}</p>
                <p><strong>等级：</strong>{assessmentResult.risk}</p>
                <p>{assessmentResult.advice}</p>
              </div>
            ) : (
              <div className="emptyState compactEmpty">完成问卷后会自动生成报告。</div>
            )}
          </div>
          <div className="historyList">
            {assessmentHistory.map((item) => (
              <div key={`${item.name}-${item.date}`} className="historyRow">
                <div>
                  <strong>{item.name}</strong>
                  <p>{item.date}</p>
                </div>
                <Pill tone={riskTone(item.risk)}>{item.risk}</Pill>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
