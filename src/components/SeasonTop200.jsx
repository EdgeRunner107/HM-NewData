import React, { useEffect, useRef, useState } from 'react';
import { Trophy } from 'lucide-react';
import { fetchTop200 } from '../api/top200';

export default function SeasonTop200({ team, season, formatNumber }) {
  const [showTop200, setShowTop200] = useState(false);
  const [top200Data, setTop200Data] = useState([]);
  const [top200Loading, setTop200Loading] = useState(false);
  const [top200Error, setTop200Error] = useState('');
  const [retryVersion, setRetryVersion] = useState(0);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!showTop200) return;
    const controller = new AbortController();
    let active = true;

    const loadTop200 = async () => {
      setTop200Loading(true);
      setTop200Error('');
      setTop200Data([]);
      try {
        const rows = await fetchTop200(team, season, controller.signal);
        if (active) setTop200Data(rows);
      } catch {
        if (active) setTop200Error('TOP 200 데이터를 불러오지 못했습니다.');
      } finally {
        if (active) setTop200Loading(false);
      }
    };

    panelRef.current?.focus();
    loadTop200();
    return () => {
      active = false;
      controller.abort();
    };
  }, [showTop200, team, season, retryVersion]);

  return (
    <section className="top200-section" aria-label="시즌 후원자 TOP 200">
      {!showTop200 ? (
        <button type="button" className="primary-button top200-open"
          onClick={() => setShowTop200(true)}>
          <Trophy size={18} aria-hidden="true" />
          시즌 후원자 TOP 200 보기
        </button>
      ) : (
        <div className="filter-panel top200-panel" ref={panelRef} tabIndex={-1}
          aria-labelledby="top200-title" aria-busy={top200Loading}>
          <button type="button" className="secondary-button top200-back"
            onClick={() => setShowTop200(false)}>
            ← 기존 데이터로 돌아가기
          </button>
          <p className="eyebrow top200-scope">{team} · {season}</p>
          <h2 id="top200-title"><Trophy size={20} aria-hidden="true" /> 후원자 TOP 200</h2>
          <p className="helper-text">시즌 전체 회차의 누적 후원 내역입니다.</p>

          {top200Loading ? (
            <div className="notice" role="status">TOP 200 데이터를 불러오는 중입니다.</div>
          ) : top200Error ? (
            <div className="notice error" role="alert">
              <p>{top200Error}</p>
              <button type="button" className="secondary-button"
                onClick={() => setRetryVersion(value => value + 1)}>다시 시도</button>
            </div>
          ) : top200Data.length === 0 ? (
            <div className="notice" role="status">해당 팀 / 시즌의 후원자 데이터가 없습니다.</div>
          ) : (
            <div className="table-wrap top200-table-wrap" tabIndex={0}
              role="region" aria-label="후원자 순위 표">
              <table className="top200-table">
                <caption>{team} · {season} 후원자 TOP 200</caption>
                <thead><tr>
                  <th scope="col">순위</th>
                  <th scope="col">후원자</th>
                  <th scope="col">총 후원금</th>
                  <th scope="col">후원 횟수</th>
                </tr></thead>
                <tbody>{top200Data.map((row, index) => (
                  <tr key={`${row.rank}-${index}`}>
                    <td>{row.rank}위</td>
                    <td className="top200-nickname">{row.nickname || '-'}</td>
                    <td className="top200-number">{formatNumber(row.total_amount)}</td>
                    <td className="top200-number">{formatNumber(row.donation_count)}회</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
