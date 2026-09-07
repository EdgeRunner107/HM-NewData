import React, {
  useEffect,
  useMemo,
  useState
} from 'react';

import axios from 'axios';

import {
  Link
} from 'react-router-dom';

import {
  ChevronDown,
  RefreshCw,
  Search,
  Trophy,
  Users,
  WalletCards,
  Settings
} from 'lucide-react';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';


const API_URL =
  import.meta.env.VITE_DATA_API_URL ||
  'https://asg-b2.onrender.com/supabase-dataB';


const DEFAULT_ROUND =
  'HM크루 직급전';


const numberFormat =
  new Intl.NumberFormat(
    'ko-KR'
  );


// ======================================================
// 숫자 변환
// ======================================================

function toNumber(value) {
  if (
    typeof value ===
    'number'
  ) {
    return value;
  }

  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return 0;
  }

  const cleaned =
    String(value)
      .replace(/,/g, '')
      .replace(/개/g, '')
      .replace(/점/g, '')
      .trim();

  const result =
    Number(cleaned);

  return Number.isNaN(result)
    ? 0
    : result;
}


// ======================================================
// 점수 표시
// ======================================================

function formatScore(value) {
  return `${numberFormat.format(
    toNumber(value)
  )}점`;
}


// ======================================================
// 날짜 표시
// ======================================================

function formatDateTime(value) {
  if (!value) {
    return '-';
  }

  const normalized =
    String(value)
      .replace(
        ' ',
        'T'
      );

  const date =
    new Date(
      normalized
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return String(value);
  }

  return date.toLocaleString(
    'ko-KR',
    {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }
  );
}


// ======================================================
// API 응답 정리
// ======================================================

function normalizeResponse(data) {
  if (
    Array.isArray(data)
  ) {
    return data;
  }

  if (
    Array.isArray(
      data?.data
    )
  ) {
    return data.data;
  }

  return [];
}


// ======================================================
// ViewerPage
// ======================================================

export default function ViewerPage() {
  const [
    rows,
    setRows
  ] =
    useState([]);

  const [
    selectedRound,
    setSelectedRound
  ] =
    useState(
      DEFAULT_ROUND
    );

  const [
    selectedStreamer,
    setSelectedStreamer
  ] =
    useState('');

  const [
    search,
    setSearch
  ] =
    useState('');

  const [
    loading,
    setLoading
  ] =
    useState(true);

  const [
    error,
    setError
  ] =
    useState('');


  // ====================================================
  // API 조회
  // ====================================================

  const loadData =
    async () => {
      try {
        setLoading(true);
        setError('');

        const response =
          await axios.get(
            API_URL
          );

        setRows(
          normalizeResponse(
            response.data
          )
        );

      } catch (err) {
        console.error(err);

        setError(
          err?.response?.data?.detail ||
          err?.response?.data?.error ||
          err.message ||
          '데이터를 불러오지 못했습니다.'
        );

      } finally {
        setLoading(false);
      }
    };


  useEffect(
    () => {
      loadData();
    },
    []
  );


  // ====================================================
  // 회차 목록
  // ====================================================

  const rounds =
    useMemo(
      () => {
        const values = [
          ...new Set(
            rows
              .map(
                item =>
                  item.round
              )
              .filter(Boolean)
          )
        ];

        return values.sort(
          (a, b) => {
            if (
              a === DEFAULT_ROUND
            ) {
              return -1;
            }

            if (
              b === DEFAULT_ROUND
            ) {
              return 1;
            }

            return a.localeCompare(
              b,
              'ko',
              {
                numeric: true
              }
            );
          }
        );
      },
      [rows]
    );


  // ====================================================
  // 회차 유효성
  // ====================================================

  useEffect(
    () => {
      if (!rows.length) {
        return;
      }

      if (
        !rounds.includes(
          selectedRound
        )
      ) {
        setSelectedRound(
          rounds[0] ||
          DEFAULT_ROUND
        );

        setSelectedStreamer('');
        setSearch('');
      }
    },
    [
      rows,
      rounds,
      selectedRound
    ]
  );


  // ====================================================
  // 선택 회차 데이터
  // ====================================================

  const roundRows =
    useMemo(
      () => {
        return rows.filter(
          item =>
            item.round ===
            selectedRound
        );
      },
      [
        rows,
        selectedRound
      ]
    );


  // ====================================================
  // 스트리머 목록
  // ====================================================

  const streamers =
    useMemo(
      () => {
        return [
          ...new Set(
            roundRows
              .map(
                item =>
                  String(
                    item.streamer ||
                    ''
                  ).trim()
              )
              .filter(Boolean)
          )
        ].sort(
          (a, b) =>
            a.localeCompare(
              b,
              'ko',
              {
                numeric: true
              }
            )
        );
      },
      [roundRows]
    );


  // ====================================================
  // 스트리머 유효성
  // ====================================================

  useEffect(
    () => {
      if (
        selectedStreamer &&
        !streamers.includes(
          selectedStreamer
        )
      ) {
        setSelectedStreamer('');
        setSearch('');
      }
    },
    [
      streamers,
      selectedStreamer
    ]
  );


  // ====================================================
  // 선택 스트리머 데이터
  // ====================================================

  const selectedRows =
    useMemo(
      () => {
        if (
          !selectedStreamer
        ) {
          return [];
        }

        return roundRows
          .filter(
            item =>
              String(
                item.streamer ||
                ''
              ).trim() ===
              selectedStreamer
          )
          .sort(
            (a, b) => {
              const aTime =
                new Date(
                  String(
                    a.time ||
                    ''
                  ).replace(
                    ' ',
                    'T'
                  )
                ).getTime();

              const bTime =
                new Date(
                  String(
                    b.time ||
                    ''
                  ).replace(
                    ' ',
                    'T'
                  )
                ).getTime();

              return (
                bTime -
                aTime
              );
            }
          );
      },
      [
        roundRows,
        selectedStreamer
      ]
    );


  // ====================================================
  // 후원자 합계
  // ====================================================

  const donorSummary =
    useMemo(
      () => {
        const map =
          new Map();

        selectedRows.forEach(
          item => {
            const donorName =
              item.nickname ||
              '(닉네임 없음)';

            const donorId =
              item.user_id ||
              '';

            const key =
              `${donorName}__${donorId}`;

            if (
              !map.has(
                key
              )
            ) {
              map.set(
                key,
                {
                  key,
                  nickname:
                    donorName,
                  user_id:
                    donorId,
                  total:
                    0,
                  count:
                    0
                }
              );
            }

            const donor =
              map.get(key);

            donor.total +=
              toNumber(
                item.amount
              );

            donor.count +=
              1;
          }
        );

        return [
          ...map.values()
        ].sort(
          (a, b) =>
            b.total -
            a.total
        );
      },
      [selectedRows]
    );


  // ====================================================
  // 검색
  // ====================================================

  const filteredDonors =
    useMemo(
      () => {
        const q =
          search
            .trim()
            .toLowerCase();

        if (!q) {
          return donorSummary;
        }

        return donorSummary.filter(
          item =>
            [
              item.nickname,
              item.user_id
            ]
              .filter(Boolean)
              .some(
                value =>
                  String(value)
                    .toLowerCase()
                    .includes(q)
              )
        );
      },
      [
        donorSummary,
        search
      ]
    );


  // ====================================================
  // 총점
  // ====================================================

  const selectedTotal =
    useMemo(
      () => {
        return selectedRows.reduce(
          (
            sum,
            item
          ) =>
            sum +
            toNumber(
              item.amount
            ),
          0
        );
      },
      [selectedRows]
    );


  // ====================================================
  // 선택 스트리머 전체 회차 누적 데이터
  // ====================================================

  const cumulativeRows =
    useMemo(
      () => {
        if (!selectedStreamer) {
          return [];
        }

        return rows.filter(
          item =>
            String(
              item.streamer ||
              ''
            ).trim() ===
            selectedStreamer
        );
      },
      [
        rows,
        selectedStreamer
      ]
    );


  const cumulativeRoundSummary =
    useMemo(
      () => {
        const map = new Map();

        cumulativeRows.forEach(
          item => {
            const roundName =
              item.round ||
              '(회차 없음)';

            if (!map.has(roundName)) {
              map.set(
                roundName,
                {
                  round: roundName,
                  total: 0,
                  count: 0,
                  donors: new Set()
                }
              );
            }

            const target =
              map.get(roundName);

            target.total +=
              toNumber(
                item.amount
              );

            target.count += 1;

            target.donors.add(
              `${item.nickname || '(닉네임 없음)'}__${item.user_id || ''}`
            );
          }
        );

        return [...map.values()]
          .map(
            item => ({
              round: item.round,
              total: item.total,
              count: item.count,
              donorCount:
                item.donors.size
            })
          )
          .sort(
            (a, b) => {
              const aIndex =
                rounds.indexOf(a.round);

              const bIndex =
                rounds.indexOf(b.round);

              if (
                aIndex !== -1 &&
                bIndex !== -1
              ) {
                return aIndex - bIndex;
              }

              return a.round.localeCompare(
                b.round,
                'ko',
                { numeric: true }
              );
            }
          );
      },
      [
        cumulativeRows,
        rounds
      ]
    );


  const cumulativeTotal =
    useMemo(
      () =>
        cumulativeRows.reduce(
          (sum, item) =>
            sum +
            toNumber(item.amount),
          0
        ),
      [cumulativeRows]
    );


  const cumulativeDonorCount =
    useMemo(
      () =>
        new Set(
          cumulativeRows.map(
            item =>
              `${item.nickname || '(닉네임 없음)'}__${item.user_id || ''}`
          )
        ).size,
      [cumulativeRows]
    );


  // ====================================================
  // 1시간 단위 집계
  // ====================================================

  const hourlySummary =
    useMemo(
      () => {
        if (
          selectedRows.length ===
          0
        ) {
          return [];
        }

        const hourlyMap =
          new Map();

        selectedRows.forEach(
          item => {
            if (!item.time) {
              return;
            }

            const normalized =
              String(
                item.time
              ).replace(
                ' ',
                'T'
              );

            const date =
              new Date(
                normalized
              );

            if (
              Number.isNaN(
                date.getTime()
              )
            ) {
              return;
            }

            date.setMinutes(
              0,
              0,
              0
            );

            const timestamp =
              date.getTime();

            if (
              !hourlyMap.has(
                timestamp
              )
            ) {
              hourlyMap.set(
                timestamp,
                {
                  timestamp,
                  amount: 0,
                  count: 0
                }
              );
            }

            const target =
              hourlyMap.get(
                timestamp
              );

            target.amount +=
              toNumber(
                item.amount
              );

            target.count += 1;
          }
        );

        const existing = [
          ...hourlyMap.values()
        ].sort(
          (a, b) =>
            a.timestamp -
            b.timestamp
        );

        if (
          existing.length ===
          0
        ) {
          return [];
        }

        const start =
          existing[0]
            .timestamp;

        const end =
          existing[
            existing.length -
            1
          ].timestamp;

        const result = [];

        for (
          let time =
            start;

          time <= end;

          time +=
            60 *
            60 *
            1000
        ) {
          const found =
            hourlyMap.get(
              time
            );

          const date =
            new Date(
              time
            );

          const month =
            String(
              date.getMonth() +
              1
            ).padStart(
              2,
              '0'
            );

          const day =
            String(
              date.getDate()
            ).padStart(
              2,
              '0'
            );

          const hour =
            String(
              date.getHours()
            ).padStart(
              2,
              '0'
            );

          result.push(
            {
              timestamp:
                time,

              label:
                `${month}/${day} ${hour}시`,

              hourLabel:
                `${hour}시`,

              amount:
                found?.amount ||
                0,

              count:
                found?.count ||
                0
            }
          );
        }

        return result;
      },
      [selectedRows]
    );


  // ====================================================
  // 최고 금액 시간
  // ====================================================

  const bestHour =
    useMemo(
      () => {
        if (
          hourlySummary.length ===
          0
        ) {
          return null;
        }

        return hourlySummary.reduce(
          (
            best,
            current
          ) => {
            if (
              !best ||
              current.amount >
                best.amount
            ) {
              return current;
            }

            return best;
          },
          null
        );
      },
      [hourlySummary]
    );


  // ====================================================
  // Tooltip
  // ====================================================

  const CustomTooltip = ({
    active,
    payload
  }) => {
    if (
      !active ||
      !payload ||
      payload.length ===
      0
    ) {
      return null;
    }

    const data =
      payload[0]
        .payload;

    return (
      <div
        className="chart-tooltip"
      >
        <strong>
          {data.label}
        </strong>

        <div>
          <span>
            금액
          </span>

          <b>
            {
              formatScore(
                data.amount
              )
            }
          </b>
        </div>

        <div>
          <span>
            건수
          </span>

          <b>
            {data.count}건
          </b>
        </div>
      </div>
    );
  };


  return (
    <main
      className="page"
    >
      <section
        className="mobile"
      >

        {/* =========================================
            HEADER
        ========================================== */}

        <header
          className="header"
        >
          <div>
            <p
              className="eyebrow"
            >
              ROVENGERS
            </p>

            <h1>
              개인 점수 조회
            </h1>
          </div>


          <div
            className="header-actions"
          >
            <Link
              className="header-icon"
              to="/admin"
              aria-label="운영자 페이지"
            >
              <Settings
                size={18}
              />
            </Link>

            <button
              className="refresh"
              type="button"
              onClick={
                loadData
              }
              aria-label="새로고침"
            >
              <RefreshCw
                size={18}
                className={
                  loading
                    ? 'spin'
                    : ''
                }
              />
            </button>
          </div>
        </header>


        {/* =========================================
            큰 로고 탭
        ========================================== */}

        <section
          className="logo-hero"
        >
          <div
            className="logo-hero-glow"
          />

          <img
            src="/logo.jpg"
            alt="Lovengers"
            className="hero-logo"
          />

          <div
            className="hero-title"
          >
            HM크루
          </div>

          <div
            className="hero-subtitle"
          >
            HM크루 점수 조회
          </div>
        </section>


        {/* =========================================
            ERROR
        ========================================== */}

        {error && (
          <div
            className="notice error"
          >
            {error}
          </div>
        )}


        {/* =========================================
            01 조회 대상
        ========================================== */}

        <section
          className="filter-panel"
        >
          <div
            className="filter-title"
          >
            <span>
              01
            </span>

            <div>
              <h2>
                조회 대상 선택
              </h2>

              <p>
                회차와 스트리머를 선택해주세요.
              </p>
            </div>
          </div>


          <div
            className="filter-stack"
          >
            <div>
              <p
                className="label"
              >
                회차
              </p>

              <label
                className="select-box"
              >
                <Trophy
                  size={17}
                />

                <select
                  value={
                    selectedRound
                  }
                  onChange={
                    e => {
                      setSelectedRound(
                        e.target.value
                      );

                      setSelectedStreamer('');
                      setSearch('');
                    }
                  }
                >
                  {rounds.length ===
                    0 && (
                    <option
                      value={
                        DEFAULT_ROUND
                      }
                    >
                      {
                        DEFAULT_ROUND
                      }
                    </option>
                  )}

                  {rounds.map(
                    round => (
                      <option
                        key={
                          round
                        }
                        value={
                          round
                        }
                      >
                        {
                          round
                        }
                      </option>
                    )
                  )}
                </select>

                <ChevronDown
                  size={16}
                />
              </label>
            </div>


            <div>
              <p
                className="label"
              >
                스트리머
              </p>

              <label
                className="select-box"
              >
                <Users
                  size={17}
                />

                <select
                  value={
                    selectedStreamer
                  }
                  onChange={
                    e => {
                      setSelectedStreamer(
                        e.target.value
                      );

                      setSearch('');
                    }
                  }
                  disabled={
                    loading ||
                    streamers.length ===
                    0
                  }
                >
                  <option
                    value=""
                  >
                    스트리머 선택
                  </option>

                  {streamers.map(
                    streamer => (
                      <option
                        key={
                          streamer
                        }
                        value={
                          streamer
                        }
                      >
                        {
                          streamer
                        }
                      </option>
                    )
                  )}
                </select>

                <ChevronDown
                  size={16}
                />
              </label>

              {!loading &&
                streamers.length ===
                  0 && (
                <p
                  className="helper-text"
                >
                  이 회차에는 스트리머 데이터가 없습니다.
                </p>
              )}
            </div>
          </div>
        </section>


        {!selectedStreamer ? (
          <section
            className="select-empty"
          >
            <Users
              size={28}
            />

            <strong>
              스트리머를 선택해주세요
            </strong>

            <p>
              선택한 스트리머의 후원자 합계와 상세 건수가 여기에 표시됩니다.
            </p>
          </section>

        ) : (
          <>

            {/* =====================================
                선택 정보
            ====================================== */}

            <section
              className="selected-banner"
            >
              <div>
                <span
                  className="selected-label"
                >
                  현재 조회
                </span>

                <h2>
                  {
                    selectedStreamer
                  }
                </h2>

                <p>
                  {
                    selectedRound
                  }
                </p>
              </div>

              <strong>
                {
                  formatScore(
                    selectedTotal
                  )
                }
              </strong>
            </section>


            {/* =====================================
                통계
            ====================================== */}

            <section
              className="mini-stats"
            >
              <article>
                <div
                  className="mini-icon"
                >
                  <WalletCards
                    size={17}
                  />
                </div>

                <span>
                  총점
                </span>

                <strong>
                  {
                    formatScore(
                      selectedTotal
                    )
                  }
                </strong>
              </article>


              <article>
                <div
                  className="mini-icon"
                >
                  <Users
                    size={17}
                  />
                </div>

                <span>
                  후원자
                </span>

                <strong>
                  {
                    donorSummary.length
                  }명
                </strong>
              </article>


              <article>
                <div
                  className="mini-icon"
                >
                  <Trophy
                    size={17}
                  />
                </div>

                <span>
                  후원 건수
                </span>

                <strong>
                  {
                    selectedRows.length
                  }건
                </strong>
              </article>
            </section>


            {/* =====================================
                02 후원자 목록
            ====================================== */}

            <section
              className="section"
            >
              <div
                className="section-title"
              >
                <div>
                  <span>
                    02
                  </span>

                  <div>
                    <h2>
                      후원자 목록
                    </h2>

                    <p>
                      닉네임별 합산 점수
                    </p>
                  </div>
                </div>
              </div>


              <label
                className="search-box"
              >
                <Search
                  size={17}
                />

                <input
                  value={
                    search
                  }
                  onChange={
                    e =>
                      setSearch(
                        e.target.value
                      )
                  }
                  placeholder="닉네임 검색"
                />
              </label>


              <div
                className="table-wrap"
              >
                <table
                  className="excel-table donor-table"
                >
                  <thead>
                    <tr>
                      <th>
                        순위
                      </th>

                      <th>
                        닉네임
                      </th>

                      <th
                        className="number-cell"
                      >
                        금액
                      </th>
                    </tr>
                  </thead>


                  <tbody>
                    {filteredDonors.length ===
                      0 ? (
                      <tr>
                        <td
                          colSpan="3"
                          className="empty-table"
                        >
                          데이터가 없습니다.
                        </td>
                      </tr>
                    ) : (
                      filteredDonors.map(
                        (
                          donor,
                          index
                        ) => (
                          <tr
                            key={
                              donor.key
                            }
                          >
                            <td
                              className="rank-cell"
                            >
                              {
                                index +
                                1
                              }
                            </td>

                            <td>
                              <strong
                                className="table-name"
                              >
                                {
                                  donor.nickname
                                }
                              </strong>
                            </td>

                            <td
                              className="number-cell score-cell"
                            >
                              {
                                formatScore(
                                  donor.total
                                )
                              }
                            </td>
                          </tr>
                        )
                      )
                    )}
                  </tbody>


                  <tfoot>
                    <tr>
                      <td
                        colSpan="2"
                      >
                        합계
                      </td>

                      <td
                        className="number-cell"
                      >
                        {
                          formatScore(
                            filteredDonors.reduce(
                              (
                                sum,
                                item
                              ) =>
                                sum +
                                item.total,
                              0
                            )
                          )
                        }
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>


            {/* =====================================
                03 상세내역
            ====================================== */}

            <section
              className="section"
            >
              <div
                className="section-title"
              >
                <div>
                  <span>
                    03
                  </span>

                  <div>
                    <h2>
                      상세 내역
                    </h2>

                    <p>
                      {
                        selectedStreamer
                      }가 받은 전체 {
                        selectedRows.length
                      }건
                    </p>
                  </div>
                </div>
              </div>


              <div
                className="table-wrap detail-table-wrap"
              >
                <table
                  className="excel-table detail-table"
                >
                  <thead>
                    <tr>
                      <th>
                        No.
                      </th>

                      <th>
                        닉네임
                      </th>

                      <th>
                        아이디
                      </th>

                      <th>
                        채팅
                      </th>

                      <th>
                        종류
                      </th>

                      <th
                        className="number-cell"
                      >
                        금액
                      </th>

                      <th>
                        시간
                      </th>
                    </tr>
                  </thead>


                  <tbody>
                    {selectedRows.length ===
                      0 ? (
                      <tr>
                        <td
                          colSpan="7"
                          className="empty-table"
                        >
                          데이터가 없습니다.
                        </td>
                      </tr>
                    ) : (
                      selectedRows.map(
                        (
                          item,
                          index
                        ) => (
                          <tr
                            key={
                              item.id ??
                              `${item.time}-${index}`
                            }
                          >
                            <td
                              className="rank-cell"
                            >
                              {
                                index +
                                1
                              }
                            </td>

                            <td>
                              {
                                item.nickname ||
                                '-'
                              }
                            </td>

                            <td
                              className="muted-cell"
                            >
                              {
                                item.user_id ||
                                '-'
                              }
                            </td>

                            <td
                              className="chat-cell"
                            >
                              {
                                item.chat ||
                                '-'
                              }
                            </td>

                            <td>
                              <span
                                className="type-badge"
                              >
                                {
                                  item.type ||
                                  '기타'
                                }
                              </span>
                            </td>

                            <td
                              className="number-cell score-cell"
                            >
                              {
                                formatScore(
                                  item.amount
                                )
                              }
                            </td>

                            <td
                              className="time-cell"
                            >
                              {
                                formatDateTime(
                                  item.time
                                )
                              }
                            </td>
                          </tr>
                        )
                      )
                    )}
                  </tbody>


                  <tfoot>
                    <tr>
                      <td
                        colSpan="5"
                      >
                        총 {
                          selectedRows.length
                        }건
                      </td>

                      <td
                        className="number-cell"
                      >
                        {
                          formatScore(
                            selectedTotal
                          )
                        }
                      </td>

                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>


            {/* =====================================
                04 시간별 그래프
            ====================================== */}

            <section
              className="section last"
            >
              <div
                className="section-title"
              >
                <div>
                  <span>
                    04
                  </span>

                  <div>
                    <h2>
                      시간별 후원 추이
                    </h2>

                    <p>
                      {
                        selectedStreamer
                      } · 1시간 단위 금액
                    </p>
                  </div>
                </div>
              </div>


              {hourlySummary.length ===
                0 ? (
                <div
                  className="notice"
                >
                  시간별 데이터가 없습니다.
                </div>

              ) : (
                <div
                  className="line-chart-box"
                >
                  <div
                    className="chart-summary"
                  >
                    <article>
                      <span>
                        총 금액
                      </span>

                      <strong>
                        {
                          formatScore(
                            selectedTotal
                          )
                        }
                      </strong>
                    </article>


                    <article>
                      <span>
                        총 건수
                      </span>

                      <strong>
                        {
                          selectedRows.length
                        }건
                      </strong>
                    </article>


                    <article>
                      <span>
                        최고 시간
                      </span>

                      <strong>
                        {
                          bestHour
                            ?.label ||
                          '-'
                        }
                      </strong>
                    </article>
                  </div>


                  <div
                    className="line-chart-area"
                  >
                    <ResponsiveContainer
                      width="100%"
                      height={300}
                    >
                      <LineChart
                        data={
                          hourlySummary
                        }
                        margin={{
                          top: 25,
                          right: 15,
                          left: -10,
                          bottom: 10
                        }}
                      >
                        <CartesianGrid
                          stroke="#252d37"
                          strokeDasharray="3 3"
                          vertical={
                            false
                          }
                        />


                        <XAxis
                          dataKey="hourLabel"
                          tick={{
                            fill:
                              '#858e9a',
                            fontSize:
                              9
                          }}
                          tickLine={
                            false
                          }
                          axisLine={{
                            stroke:
                              '#29313c'
                          }}
                          interval={
                            hourlySummary.length >
                            12
                              ? Math.ceil(
                                  hourlySummary.length /
                                  12
                                ) - 1
                              : 0
                          }
                        />


                        <YAxis
                          tick={{
                            fill:
                              '#858e9a',
                            fontSize:
                              9
                          }}
                          tickLine={
                            false
                          }
                          axisLine={
                            false
                          }
                          width={52}
                          tickFormatter={
                            value => {
                              if (
                                value >=
                                1000000
                              ) {
                                return `${(
                                  value /
                                  1000000
                                ).toFixed(
                                  1
                                )}M`;
                              }

                              if (
                                value >=
                                1000
                              ) {
                                return `${Math.round(
                                  value /
                                  1000
                                )}K`;
                              }

                              return value;
                            }
                          }
                        />


                        <Tooltip
                          content={
                            <CustomTooltip />
                          }
                        />


                        <Line
                          type="monotone"
                          dataKey="amount"
                          stroke="#8b6cff"
                          strokeWidth={3}
                          dot={{
                            r: 4,
                            fill:
                              '#8b6cff',
                            stroke:
                              '#d8d2ff',
                            strokeWidth:
                              2
                          }}
                          activeDot={{
                            r: 6,
                            fill:
                              '#ffffff',
                            stroke:
                              '#8b6cff',
                            strokeWidth:
                              3
                          }}
                          connectNulls
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>


                  <div
                    className="hourly-table-wrap"
                  >
                    <table
                      className="hourly-table"
                    >
                      <thead>
                        <tr>
                          <th>
                            시간
                          </th>

                          <th>
                            금액
                          </th>

                          <th>
                            건수
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {hourlySummary.map(
                          item => (
                            <tr
                              key={
                                item.timestamp
                              }
                            >
                              <td>
                                {
                                  item.label
                                }
                              </td>

                              <td
                                className="hourly-money"
                              >
                                {
                                  formatScore(
                                    item.amount
                                  )
                                }
                              </td>

                              <td>
                                {
                                  item.count
                                }건
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>


            {/* =====================================
                05 전체 회차 개인 누적
            ====================================== */}

            <section
              className="section last"
            >
              <div
                className="section-title"
              >
                <div>
                  <span>
                    05
                  </span>

                  <div>
                    <h2>
                      전체 회차 누적
                    </h2>

                    <p>
                      {selectedStreamer}의 전체 회차 개인 데이터
                    </p>
                  </div>
                </div>
              </div>


              <div
                className="chart-summary"
              >
                <article>
                  <span>누적 총점</span>
                  <strong>
                    {formatScore(cumulativeTotal)}
                  </strong>
                </article>

                <article>
                  <span>참여 회차</span>
                  <strong>
                    {cumulativeRoundSummary.length}회
                  </strong>
                </article>

                <article>
                  <span>전체 후원자</span>
                  <strong>
                    {cumulativeDonorCount}명
                  </strong>
                </article>

                <article>
                  <span>전체 건수</span>
                  <strong>
                    {cumulativeRows.length}건
                  </strong>
                </article>
              </div>


              <div
                className="table-wrap"
              >
                <table
                  className="excel-table"
                >
                  <thead>
                    <tr>
                      <th>회차</th>
                      <th className="number-cell">
                        누적 점수
                      </th>
                      <th className="number-cell">
                        후원자
                      </th>
                      <th className="number-cell">
                        건수
                      </th>
                    </tr>
                  </thead>


                  <tbody>
                    {cumulativeRoundSummary.length === 0 ? (
                      <tr>
                        <td
                          colSpan="4"
                          className="empty-table"
                        >
                          전체 회차 데이터가 없습니다.
                        </td>
                      </tr>
                    ) : (
                      cumulativeRoundSummary.map(
                        item => (
                          <tr key={item.round}>
                            <td>
                              <strong className="table-name">
                                {item.round}
                              </strong>
                            </td>

                            <td className="number-cell score-cell">
                              {formatScore(item.total)}
                            </td>

                            <td className="number-cell">
                              {item.donorCount}명
                            </td>

                            <td className="number-cell">
                              {item.count}건
                            </td>
                          </tr>
                        )
                      )
                    )}
                  </tbody>


                  <tfoot>
                    <tr>
                      <td>전체 누적</td>
                      <td className="number-cell">
                        {formatScore(cumulativeTotal)}
                      </td>
                      <td className="number-cell">
                        {cumulativeDonorCount}명
                      </td>
                      <td className="number-cell">
                        {cumulativeRows.length}건
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>

          </>
        )}


        <footer>
          {API_URL}
        </footer>
      </section>
    </main>
  );
}
