import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import axios from 'axios';
import { UPLOAD_API_URL as API_URL, TEAMS, SEASONS, UPLOAD_ROUNDS as ROUNDS } from '../newDataConfig';
import {
  ArrowLeft,
  ChevronDown,
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

function normalizeAmount(value) {
  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {
    return 0;
  }

  if (typeof value === 'number') {
    return value;
  }

  const cleaned = String(value)
    .replace(/,/g, '')
    .replace(/개/g, '')
    .trim();

  const number = Number(cleaned);

  return Number.isNaN(number)
    ? 0
    : number;
}

function normalizeTime(value) {
  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {
    return null;
  }

  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number') {
    try {
      const parsed =
        XLSX.SSF.parse_date_code(value);

      if (parsed) {
        const year = parsed.y;

        const month =
          String(parsed.m).padStart(2, '0');

        const day =
          String(parsed.d).padStart(2, '0');

        const hour =
          String(parsed.H || 0).padStart(2, '0');

        const minute =
          String(parsed.M || 0).padStart(2, '0');

        const second =
          String(
            Math.floor(parsed.S || 0)
          ).padStart(2, '0');

        return (
          `${year}-${month}-${day} ` +
          `${hour}:${minute}:${second}`
        );
      }
    } catch (error) {
      console.error(
        '시간 변환 오류:',
        error
      );
    }
  }

  return String(value);
}

function normalizeHeader(value) {
  if (
    value === undefined ||
    value === null
  ) {
    return '';
  }

  return String(value).trim();
}

export default function AdminPage() {
  const [selectedTeam, setSelectedTeam] = useState('');
  const [selectedSeason, setSelectedSeason] = useState('');
  const [parsing, setParsing] = useState(false);
  const fileReaderRef = useRef(null);

  const [
    selectedRound,
    setSelectedRound
  ] = useState('');

  const [
    selectedFileName,
    setSelectedFileName
  ] = useState('');

  const [
    previewData,
    setPreviewData
  ] = useState([]);

  const [
    uploading,
    setUploading
  ] = useState(false);

  const [
    status,
    setStatus
  ] = useState({
    type: '',
    message: ''
  });

  const [
    uploadResult,
    setUploadResult
  ] = useState(null);

  const hasScope = TEAMS.includes(selectedTeam) &&
    SEASONS.includes(selectedSeason) && ROUNDS.includes(selectedRound);
  const scopeLabel = `${selectedTeam} / ${selectedSeason} / ${selectedRound}`;

  const validateSelection = () => {
    const message = !TEAMS.includes(selectedTeam) ? '팀을 선택해주세요.' :
      !SEASONS.includes(selectedSeason) ? '시즌을 선택해주세요.' :
      !ROUNDS.includes(selectedRound) ? '회차를 선택해주세요.' : '';
    if (message) setStatus({ type: 'error', message });
    return !message;
  };

  // =====================================================
  // 업로드 상태 초기화
  // =====================================================

  const resetUpload = () => {
    if (fileReaderRef.current) {
      fileReaderRef.current.abort();
      fileReaderRef.current = null;
    }
    setParsing(false);
    setSelectedFileName('');

    setPreviewData([]);

    setUploadResult(null);

    setStatus({
      type: '',
      message: ''
    });

    const input =
      document.getElementById(
        'excel-upload'
      );

    if (input) {
      input.value = '';
    }
  };

  // =====================================================
  // 엑셀 파일 선택
  // =====================================================

  const handleFileChange = (e) => {
    const file =
      e.target.files?.[0];

    if (!file) {
      return;
    }

    if (!validateSelection()) {
      e.target.value = '';

      return;
    }

    resetUpload();
    setParsing(true);
    setSelectedFileName(
      file.name
    );

    setUploadResult(null);

    setStatus({
      type: '',
      message: ''
    });

    const reader =
      new FileReader();
    fileReaderRef.current = reader;

    reader.onload = (event) => {
      if (fileReaderRef.current !== reader) return;
      try {
        const data =
          event.target.result;

        const workbook =
          XLSX.read(
            data,
            {
              type: 'array',
              cellDates: false
            }
          );

        const sheetName =
          workbook.SheetNames[0];

        const sheet =
          workbook.Sheets[
            sheetName
          ];

        if (!sheet) {
          throw new Error(
            '첫 번째 시트를 찾을 수 없습니다.'
          );
        }

        const rows =
          XLSX.utils.sheet_to_json(
            sheet,
            {
              header: 1,
              defval: ''
            }
          );

        if (
          !rows ||
          rows.length < 2
        ) {
          throw new Error(
            '엑셀에 데이터가 없습니다.'
          );
        }

        // =================================================
        // 헤더 확인
        // =================================================

        const headers =
          rows[0].map(
            normalizeHeader
          );

        const requiredHeaders = [
          '아이디',
          '닉네임',
          '채팅',
          '스트리머',
          '종류',
          '개수',
          '시간'
        ];

        const missingHeaders =
          requiredHeaders.filter(
            (header) =>
              !headers.includes(
                header
              )
          );

        if (
          missingHeaders.length > 0
        ) {
          throw new Error(
            `필수 컬럼 누락: ${missingHeaders.join(', ')}`
          );
        }

        const getIndex =
          (name) =>
            headers.findIndex(
              (header) =>
                header === name
            );

        const indexUserId =
          getIndex('아이디');

        const indexNickname =
          getIndex('닉네임');

        const indexChat =
          getIndex('채팅');

        const indexStreamer =
          getIndex('스트리머');

        const indexType =
          getIndex('종류');

        const indexAmount =
          getIndex('개수');

        const indexTime =
          getIndex('시간');

        // =================================================
        // 빈 행 제거
        // =================================================

        const dataRows =
          rows
            .slice(1)
            .filter(
              (row) =>
                row.some(
                  (cell) =>
                    cell !== '' &&
                    cell !== null &&
                    cell !== undefined
                )
            );

        if (
          dataRows.length === 0
        ) {
          throw new Error(
            '업로드할 데이터가 없습니다.'
          );
        }

        // =================================================
        // 업로드 데이터 생성
        // =================================================

        const uploadData =
          dataRows.map(
            (row, index) => ({
              _row:
                index + 1,

              아이디:
                row[indexUserId] ??
                '',

              닉네임:
                row[indexNickname] ??
                '',

              채팅:
                row[indexChat] ??
                '',

              스트리머:
                row[indexStreamer] ??
                '',

              종류:
                row[indexType] ??
                '',

              개수:
                normalizeAmount(
                  row[indexAmount]
                ),

              시간:
                normalizeTime(
                  row[indexTime]
                ),

              회차:
                selectedRound,
              team: selectedTeam,
              season: selectedSeason
            })
          );

        console.log(
          '엑셀에서 읽은 데이터:',
          uploadData.length
        );

        setPreviewData(
          uploadData
        );

        setStatus({
          type: 'ready',

          message:
            `${uploadData.length}개의 데이터를 확인했습니다.`
        });

      } catch (error) {
        console.error(
          error
        );

        setPreviewData([]);

        setUploadResult(null);

        setStatus({
          type: 'error',

          message:
            error.message
        });
      } finally {
        fileReaderRef.current = null;
        setParsing(false);
      }
    };

    reader.onerror = () => {
      if (fileReaderRef.current !== reader) return;
      fileReaderRef.current = null;
      setParsing(false);
      setPreviewData([]);

      setUploadResult(null);

      setStatus({
        type: 'error',

        message:
          '파일을 읽는 중 오류가 발생했습니다.'
      });
    };

    reader.readAsArrayBuffer(
      file
    );
  };

  // =====================================================
  // Supabase 업로드
  // =====================================================

  const handleUpload = async () => {
    if (uploading || parsing) return;
    if (!validateSelection()) return;

    if (
      previewData.length === 0
    ) {
      setStatus({ type: 'error', message: 'Excel 파일을 선택해주세요.' });

      return;
    }

    try {
      setUploading(true);

      setUploadResult(null);

      setStatus({
        type: 'uploading',

        message:
          `Supabase에 ${previewData.length}건을 저장하고 있습니다.`
      });

      // _row는 프런트 미리보기용이므로 서버에는 보내지 않음
      const uploadData =
        previewData.map(
          ({
            _row,
            ...item
          }) => item
        );

      console.log(
        '========================================'
      );

      console.log(
        `📤 서버 전송 데이터: ${uploadData.length}건`
      );

      console.log(
        '========================================'
      );

      const response =
        await axios.post(
          API_URL,

          {
            data:
              uploadData,
            team: selectedTeam,
            season: selectedSeason,
            round: selectedRound
          },

          {
            headers: {
              'Content-Type':
                'application/json'
            },

            /*
             * 백엔드에서
             *
             * 200 = 전체 성공
             * 207 = 일부 성공
             *
             * 으로 반환하므로 207도 catch로 보내지 않고
             * 정상 응답으로 받도록 설정
             */
            validateStatus:
              (status) =>
                status >= 200 &&
                status < 300
          }
        );

      console.log(
        '========================================'
      );

      console.log(
        '📥 업로드 서버 응답:',
        response.data
      );

      console.log(
        '========================================'
      );

      const result =
        response.data || {};

      // =================================================
      // 서버에서 반환한 실제 건수
      // =================================================

      const requestedRows =
        Number(
          result.requestedRows ??
          uploadData.length
        );

      const insertedRows =
        Number(
          result.insertedRows ??
          0
        );

      const failedRows =
        Number(
          result.failedRows ??
          (
            requestedRows -
            insertedRows
          )
        );

      const failedBatches =
        Array.isArray(
          result.failedBatches
        )
          ? result.failedBatches
          : [];

      const finalResult = {
        requestedRows,
        insertedRows,
        failedRows,
        failedBatches
      };

      setUploadResult(
        finalResult
      );

      // =================================================
      // 요청 건수와 서버의 requestedRows가 다르면 경고
      // =================================================

      if (
        requestedRows !==
        uploadData.length
      ) {
        console.warn(
          '⚠️ 프런트 전송건수와 서버 수신건수가 다릅니다.',
          {
            frontend:
              uploadData.length,

            backend:
              requestedRows
          }
        );
      }

      // =================================================
      // 일부 실패
      // =================================================

      if (
        failedRows > 0 ||
        result.success === false
      ) {
        console.error(
          '❌ 일부 데이터 업로드 실패',
          finalResult
        );

        setStatus({
          type: 'error',

          message:
            `업로드 일부 실패 - 요청 ${requestedRows}건 / 성공 ${insertedRows}건 / 실패 ${failedRows}건`
        });

        return;
      }

      // =================================================
      // 실제 삽입 건수가 전송 건수와 다름
      // =================================================

      if (
        insertedRows !==
        uploadData.length
      ) {
        console.warn(
          '⚠️ 전송건수와 실제 저장건수가 다릅니다.',
          {
            sent:
              uploadData.length,

            inserted:
              insertedRows
          }
        );

        setStatus({
          type: 'error',

          message:
            `건수 불일치 - 전송 ${uploadData.length}건 / 실제 저장 ${insertedRows}건`
        });

        return;
      }

      // =================================================
      // 전체 성공
      // =================================================

      console.log(
        `✅ 전체 업로드 성공: ${insertedRows}건`
      );

      setStatus({
        type: 'success',

        message:
          `${scopeLabel} 데이터 업로드가 완료되었습니다. (${insertedRows}건)`
      });

    } catch (error) {
      console.error(
        '========================================'
      );

      console.error(
        '❌ 업로드 오류:',
        error
      );

      console.error(
        '서버 응답:',
        error?.response?.data
      );

      console.error(
        '========================================'
      );

      const serverData =
        error?.response?.data;

      // 서버가 에러 상황에서도 건수를 반환했다면 표시
      if (
        serverData &&
        (
          serverData.requestedRows !==
            undefined ||
          serverData.insertedRows !==
            undefined
        )
      ) {
        const requestedRows =
          Number(
            serverData.requestedRows ??
            previewData.length
          );

        const insertedRows =
          Number(
            serverData.insertedRows ??
            0
          );

        const failedRows =
          Number(
            serverData.failedRows ??
            (
              requestedRows -
              insertedRows
            )
          );

        setUploadResult({
          requestedRows,
          insertedRows,
          failedRows,

          failedBatches:
            Array.isArray(
              serverData.failedBatches
            )
              ? serverData.failedBatches
              : []
        });
      }

      setStatus({
        type: 'error',

        message:
          error?.response?.data?.detail ||
          error?.response?.data?.message ||
          error?.response?.data?.error ||
          error.message ||
          '업로드에 실패했습니다.'
      });

    } finally {
      setUploading(false);
    }
  };

  // =====================================================
  // 화면
  // =====================================================

  return (
    <main className="page">

      <section className="mobile admin-mobile">

        {/* ================================================
            HEADER
        ================================================ */}

        <header className="header admin-header">

          <Link
            className="header-icon"
            to="/"
            aria-label="사용자 페이지"
          >
            <ArrowLeft
              size={18}
            />
          </Link>

          <div>

            <p className="eyebrow">
              LOVENGERS ADMIN
            </p>

            <h1>
              운영자 페이지
            </h1>

          </div>

        </header>

        {/* ================================================
            01. 팀 / 시즌 / 회차 선택
        ================================================ */}

        <section className="filter-panel">

          <div className="filter-title">

            <span>
              01
            </span>

            <div>

              <h2>
                업로드 범위 선택
              </h2>

              <p>
                팀, 시즌, 회차를 순서대로 선택합니다.
              </p>

            </div>

          </div>

          <p className="label">팀</p>
          <label className="select-box">
            <select aria-label="팀" value={selectedTeam} disabled={uploading}
              onChange={e => {
                setSelectedTeam(e.target.value);
                setSelectedSeason('');
                setSelectedRound('');
                resetUpload();
              }}>
              <option value="">팀 선택</option>
              {TEAMS.map(team => <option key={team} value={team}>{team}</option>)}
            </select>
            <ChevronDown size={17} />
          </label>

          <p className="label admin-scope-label">시즌</p>
          <label className="select-box">
            <select aria-label="시즌" value={selectedSeason} disabled={!selectedTeam || uploading}
              onChange={e => {
                setSelectedSeason(e.target.value);
                setSelectedRound('');
                resetUpload();
              }}>
              <option value="">시즌 선택</option>
              {SEASONS.map(season => <option key={season} value={season}>{season}</option>)}
            </select>
            <ChevronDown size={17} />
          </label>

          <p className="label admin-scope-label">
            회차
          </p>

          <label className="select-box">

            <select
              aria-label="회차"
              disabled={!selectedTeam || !selectedSeason || uploading}
              value={
                selectedRound
              }
              onChange={(e) => {

                setSelectedRound(
                  e.target.value
                );

                resetUpload();

              }}
            >

              <option value="">
                회차 선택
              </option>

              {ROUNDS.map(
                (round) => (

                  <option
                    key={
                      round
                    }
                    value={
                      round
                    }
                  >
                    {round}
                  </option>

                )
              )}

            </select>

            <ChevronDown
              size={17}
            />

          </label>

        </section>

        {/* ================================================
            02. 엑셀 업로드
        ================================================ */}

        <section className="section">

          <div className="section-title">

            <div>

              <span>
                02
              </span>

              <div>

                <h2>
                  엑셀 업로드
                </h2>

                <p>
                  선택한 팀 / 시즌 / 회차에 Excel 데이터를 업로드합니다.
                </p>

              </div>

            </div>

          </div>

          <div
            className={
              `admin-upload-box ${
                !hasScope || uploading || parsing
                  ? 'disabled'
                  : ''
              }`
            }
          >

            <FileSpreadsheet
              size={36}
            />

            <strong>

              {
                selectedFileName ||
                '엑셀 파일 선택'
              }

            </strong>

            <p>
              .xlsx 또는 .xls 파일
            </p>

            <label
              className={
                `admin-file-button ${
                  !hasScope || uploading || parsing
                    ? 'disabled'
                    : ''
                }`
              }
              htmlFor="excel-upload"
            >
              파일 선택
            </label>

            <input
              className="hidden-input"
              id="excel-upload"
              type="file"
              accept=".xlsx,.xls"
              onChange={
                handleFileChange
              }
              disabled={
                !hasScope ||
                uploading || parsing
              }
            />

          </div>

          {!hasScope && (

            <p className="helper-text centered">

              팀, 시즌, 회차를 먼저 선택해주세요.

            </p>

          )}

        </section>

        {/* ================================================
            STATUS
        ================================================ */}

        {status.message && (

          <div
            role="status"
            className={
              `admin-status ${status.type}`
            }
          >

            {
              status.type ===
              'success'
                ? (

                  <CheckCircle2
                    size={18}
                  />

                )
                : status.type ===
                  'error'
                  ? (

                    <AlertCircle
                      size={18}
                    />

                  )
                  : (

                    <FileSpreadsheet
                      size={18}
                    />

                  )
            }

            <span>
              {status.message}
            </span>

          </div>

        )}

        {/* ================================================
            실제 서버 저장 결과
        ================================================ */}

        {uploadResult && (

          <section className="section">

            <div className="section-title">

              <div>

                <span>
                  결과
                </span>

                <div>

                  <h2>
                    Supabase 저장 결과
                  </h2>

                  <p>
                    서버에서 확인한 실제 저장 결과입니다.
                  </p>

                </div>

              </div>

            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(3, 1fr)',
                gap: '10px'
              }}
            >

              <div
                style={{
                  padding: '14px',
                  borderRadius: '12px',
                  background:
                    'rgba(255,255,255,0.05)',
                  textAlign: 'center'
                }}
              >

                <div
                  style={{
                    fontSize: '12px',
                    opacity: 0.7,
                    marginBottom: '5px'
                  }}
                >
                  요청
                </div>

                <strong
                  style={{
                    fontSize: '20px'
                  }}
                >
                  {
                    uploadResult
                      .requestedRows
                  }
                </strong>

              </div>

              <div
                style={{
                  padding: '14px',
                  borderRadius: '12px',
                  background:
                    'rgba(255,255,255,0.05)',
                  textAlign: 'center'
                }}
              >

                <div
                  style={{
                    fontSize: '12px',
                    opacity: 0.7,
                    marginBottom: '5px'
                  }}
                >
                  성공
                </div>

                <strong
                  style={{
                    fontSize: '20px'
                  }}
                >
                  {
                    uploadResult
                      .insertedRows
                  }
                </strong>

              </div>

              <div
                style={{
                  padding: '14px',
                  borderRadius: '12px',
                  background:
                    'rgba(255,255,255,0.05)',
                  textAlign: 'center'
                }}
              >

                <div
                  style={{
                    fontSize: '12px',
                    opacity: 0.7,
                    marginBottom: '5px'
                  }}
                >
                  실패
                </div>

                <strong
                  style={{
                    fontSize: '20px'
                  }}
                >
                  {
                    uploadResult
                      .failedRows
                  }
                </strong>

              </div>

            </div>

            {uploadResult.failedBatches.length > 0 && (

              <div
                style={{
                  marginTop: '14px'
                }}
              >

                <strong>
                  실패 배치
                </strong>

                {uploadResult.failedBatches.map(
                  (
                    batch,
                    index
                  ) => (

                    <div
                      key={
                        `${batch.batchNumber}-${index}`
                      }
                      style={{
                        marginTop: '8px',
                        padding: '12px',
                        borderRadius: '10px',
                        background:
                          'rgba(255,255,255,0.05)',
                        fontSize: '13px',
                        lineHeight: 1.6
                      }}
                    >

                      <div>
                        배치:
                        {' '}
                        {
                          batch.batchNumber ??
                          '-'
                        }
                      </div>

                      <div>
                        실패:
                        {' '}
                        {
                          batch.count ??
                          '-'
                        }
                        건
                      </div>

                      {batch.message && (

                        <div>
                          오류:
                          {' '}
                          {
                            batch.message
                          }
                        </div>

                      )}

                    </div>

                  )
                )}

              </div>

            )}

          </section>

        )}

        {/* ================================================
            03. 업로드 미리보기
        ================================================ */}

        {previewData.length > 0 && (

          <section className="section">

            <div className="section-title">

              <div>

                <span>
                  03
                </span>

                <div>

                  <h2>
                    업로드 미리보기
                  </h2>

                  <p>
                    {scopeLabel} · 총 {previewData.length}건
                  </p>

                </div>

              </div>

            </div>

            <div className="table-wrap">

              <table className="excel-table admin-preview-table">

                <thead>

                  <tr>

                    <th>
                      No.
                    </th>

                    <th>
                      아이디
                    </th>

                    <th>
                      닉네임
                    </th>

                    <th>
                      채팅
                    </th>

                    <th>
                      스트리머
                    </th>

                    <th>
                      종류
                    </th>

                    <th className="number-cell">
                      개수
                    </th>

                    <th>
                      시간
                    </th>

                    <th>
                      회차
                    </th>

                  </tr>

                </thead>

                <tbody>

                  {previewData.map(
                    (item) => (

                      <tr
                        key={
                          item._row
                        }
                      >

                        <td className="rank-cell">
                          {
                            item._row
                          }
                        </td>

                        <td>
                          {
                            item.아이디 ||
                            '-'
                          }
                        </td>

                        <td>
                          {
                            item.닉네임 ||
                            '-'
                          }
                        </td>

                        <td className="chat-cell">
                          {
                            item.채팅 ||
                            '-'
                          }
                        </td>

                        <td>
                          {
                            item.스트리머 ||
                            '-'
                          }
                        </td>

                        <td>
                          {
                            item.종류 ||
                            '-'
                          }
                        </td>

                        <td className="number-cell score-cell">

                          {
                            Number(
                              item.개수 ||
                              0
                            ).toLocaleString()
                          }

                        </td>

                        <td className="time-cell">
                          {
                            item.시간 ||
                            '-'
                          }
                        </td>

                        <td>
                          {
                            item.회차
                          }
                        </td>

                      </tr>

                    )
                  )}

                </tbody>

              </table>

            </div>

            <div className="admin-actions">

              <button
                type="button"
                className="secondary-button"
                onClick={
                  resetUpload
                }
                disabled={
                  uploading
                }
              >
                다시 선택
              </button>

              <button
                type="button"
                className="primary-button"
                onClick={
                  handleUpload
                }
                disabled={
                  uploading
                }
              >

                <Upload
                  size={18}
                />

                {
                  uploading
                    ? '업로드 중...'
                    : `${previewData.length}건 업로드`
                }

              </button>

            </div>

          </section>

        )}

        <footer>
          {API_URL}
        </footer>

      </section>

    </main>
  );
}
