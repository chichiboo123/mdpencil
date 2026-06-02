import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getLastModel,
  modelLabel,
  MODEL_PRIORITY,
  MODEL_CHANGE_EVENT,
} from '../utils/gemini';
import styles from './ModelIndicator.module.css';

/**
 * 현재(마지막으로) 호출된 Gemini 모델을 "배터리"처럼 보여주는 표시기.
 *
 * 의미: 폴백 우선순위에서 앞에 있는 모델일수록 배터리가 가득 차고 초록색이다
 *       (= 무료 티어 여유가 많음). 한도 초과로 더 낮은 순위 모델로 넘어갈수록
 *       배터리가 줄고 색이 노랑→주황→빨강으로 변한다.
 *
 * 동작: AI 교정이 한 번이라도 성공하면 그때 응답한 모델이 표시된다.
 *       gemini.js 가 모델을 저장할 때 MODEL_CHANGE_EVENT 를 쏘므로 즉시 갱신된다.
 */
export default function ModelIndicator() {
  const { t } = useTranslation();
  const [model, setModel] = useState(() => getLastModel());

  useEffect(() => {
    // 같은 탭의 모델 변경(커스텀 이벤트) + 다른 탭의 변경(storage 이벤트) 모두 반영.
    const onChange = (e) => setModel(e?.detail ?? getLastModel());
    const onStorage = () => setModel(getLastModel());
    window.addEventListener(MODEL_CHANGE_EVENT, onChange);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(MODEL_CHANGE_EVENT, onChange);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  // 아직 한 번도 호출하지 않았으면 표시할 것이 없다.
  if (!model) return null;

  const total = MODEL_PRIORITY.length;
  const idx = MODEL_PRIORITY.indexOf(model);
  // 목록에 없는 모델은 "최하위"로 간주(rank = total).
  const rank = idx === -1 ? total : idx;
  // 잔량 단계: 1순위 = total, 마지막 = 1.
  const level = Math.max(1, total - rank);
  const pct = Math.round((level / total) * 100);

  // 색상 단계: 높은 우선순위일수록 초록, 낮을수록 빨강.
  const tone = rank === 0 ? 'full' : rank === 1 ? 'good' : rank === 2 ? 'low' : 'crit';
  // 사람이 읽는 순위 라벨(1순위, 2순위 …). 알 수 없으면 표시 생략.
  const tierText = idx === -1 ? '' : t('model.tier', { n: idx + 1 });

  return (
    <div
      className={styles.wrap}
      title={t('model.tooltip', { name: modelLabel(model) })}
      aria-label={t('model.tooltip', { name: modelLabel(model) })}
    >
      {/* 배터리 본체 + 잔량 막대 */}
      <span className={`${styles.battery} ${styles[tone]}`} aria-hidden="true">
        <span className={styles.level} style={{ width: `${pct}%` }} />
      </span>
      <span className={styles.text}>
        <span className={styles.name}>{modelLabel(model)}</span>
        {tierText && <span className={styles.tier}>{tierText}</span>}
      </span>
    </div>
  );
}
