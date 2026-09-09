import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { supabase } from "./supabase.js";
import { engMathAuthUrl } from "./engMathAccess.js";
import {
  classroomDemo,
  classroomError,
  classroomRpc,
  loadClassroom,
} from "./engMathClassroom.js";
import "./EngMathClassroom.css";

const SUBJECT = { english: "영어", math: "수학" };
const REASONS = {
  gave_up: "풀이를 먼저 봄",
  sure_wrong: "확신했지만 오답",
  wrong: "마지막 풀이 오답",
};
function problemLabel(key) {
  const match =
    /^(\d{4})_(csat|06|09)(?:_(common|calculus|probability|geometry))?_(\d+)$/.exec(
      key,
    );
  if (!match) return key;
  return `${match[1]}학년도 ${{ csat: "수능", "06": "6월", "09": "9월" }[match[2]]} ${{ common: "공통 ", calculus: "미적분 ", probability: "확률과 통계 ", geometry: "기하 " }[match[3]] || ""}${match[4]}번`;
}
function dateLabel(value) {
  return value
    ? new Intl.DateTimeFormat("ko-KR", {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Seoul",
      }).format(new Date(value))
    : "최근 30일 기록 없음";
}

function DayCounts({ counts }) {
  return <>
    <strong>답안 제출 {counts.answered}문항</strong>
    <span>풀이 먼저 보기 {counts.viewed}문항</span>
    <span>복습 {counts.reviewed}문항 · 개념 {counts.concepts}개</span>
  </>;
}

function DailyRoster({ students, asOf, onSelect, onRefresh, busy }) {
  const [chosenDate, setChosenDate] = useState("");
  const [onlyMissing, setOnlyMissing] = useState(false);
  const dates = students[0]?.days.map(day => day.date) || [];
  const date = dates.includes(chosenDate) ? chosenDate : dates.at(-1);
  const rows = students.map(student => ({ student, day: student.days.find(day => day.date === date) }));
  const missing = rows.filter(row => !row.day.hasActivity).length;
  return <section className="classroom-roster" aria-label="날짜별 학습 확인">
    <div className="classroom-section-head"><div><h2>매일 학습 확인</h2><p>한국 시간 기준 · 기록 있음 {rows.length - missing}명 / 기록 없음 {missing}명</p><p>{dateLabel(asOf)}에 불러온 기록</p></div><button disabled={busy} onClick={onRefresh}>최신 기록 확인</button></div>
    <div className="classroom-filters">
      <label>확인할 날짜<select value={date} onChange={e => setChosenDate(e.target.value)}>{dates.toReversed().map(value => <option key={value} value={value}>{value}{value === dates.at(-1) ? " · 오늘" : ""}</option>)}</select></label>
      <label>학습 기록 표시<select value={onlyMissing ? "missing" : "all"} onChange={e => setOnlyMissing(e.target.value === "missing")}><option value="all">전체 학생</option><option value="missing">선택한 날 기록 없음</option></select></label>
    </div>
    <div className="classroom-table-wrap"><table><thead><tr><th>학생</th><th>기록 상태</th><th>영어</th><th>수학</th></tr></thead><tbody>
      {rows.filter(row => !onlyMissing || !row.day.hasActivity).map(({student, day}) => <tr key={student.student_id}>
        <th><button onClick={() => onSelect(student.student_id)}>{student.student_name}<span>최근 7일 자세히 보기</span></button></th>
        <td data-label="기록 상태">{day.hasActivity ? "학습 기록 있음" : "기록 없음"}</td>
        <td data-label="영어"><DayCounts counts={day.subjects.english}/></td>
        <td data-label="수학"><DayCounts counts={day.subjects.math}/></td>
      </tr>)}
    </tbody></table></div>
    {onlyMissing && missing === 0 && <p className="classroom-empty">선택한 날은 모든 학생에게 학습 기록이 있습니다.</p>}
    <p className="classroom-muted classroom-footnote">접속만으로 학습 처리하지 않습니다. 기록 없음은 미학습뿐 아니라 아직 동기화되지 않은 경우도 포함합니다. 기록이 있다고 과제 완료나 이해 완료를 뜻하지는 않습니다.</p>
  </section>;
}

function StudentDetail({ student, demo, busy, onTargets, onRemove }) {
  const detailRef = useRef(null);
  useEffect(() => {
    detailRef.current?.focus();
  }, [student.student_id]);
  const [english, setEnglish] = useState(student.english_target);
  const [math, setMath] = useState(student.math_target);
  const [confirmRemove, setConfirmRemove] = useState(false);
  return (
    <section
      ref={detailRef}
      tabIndex={-1}
      className="classroom-detail"
      aria-label={`${student.student_name} 학습 상세`}
    >
      <div className="classroom-section-head">
        <div>
          <span className="classroom-eyebrow">다음 수업 준비</span>
          <h2>{student.student_name}</h2>
        </div>
        <span>최근 학습 {dateLabel(student.lastActive)}</span>
      </div>
      <div className="classroom-detail-grid">
        <div>
          <details className="classroom-daily-detail"><summary>최근 7일 날짜별 학습 기록 펼치기</summary>
          <ul className="classroom-days">{student.days.toReversed().map(day => <li key={day.date}>
            <strong>{day.date} · {day.hasActivity ? "기록 있음" : "기록 없음"}</strong>
            <div><span>영어</span><DayCounts counts={day.subjects.english}/></div>
            <div><span>수학</span><DayCounts counts={day.subjects.math}/></div>
          </li>)}</ul></details>
          <h3>
            함께 짚을 문제 <span>{student.issues.length}</span>
          </h3>
          <p className="classroom-muted">
            최근 30일 중 마지막 답안이 오답인 문제입니다. 풀이를 먼저 본
            문제부터 표시합니다.
          </p>
          {student.issues.length ? (
            <ul className="classroom-issues">
              {student.issues.map((issue) => (
                <li key={`${issue.subject}:${issue.problem_key}`}>
                  <span
                    className={`classroom-subject classroom-subject--${issue.subject}`}
                  >
                    {SUBJECT[issue.subject]}
                  </span>
                  <div>
                    <strong>{problemLabel(issue.problem_key)}</strong>
                    <span>
                      {REASONS[issue.reason]} · {dateLabel(issue.occurred_at)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="classroom-empty">
              확인할 오답이 없습니다. 학습 기록이 없는 경우에도 이 목록은 비어
              있습니다.
            </p>
          )}
        </div>
        <div className="classroom-plan">
          <h3>최근 7일 학습 목표</h3>
          <p className="classroom-muted">
            서로 다른 문항 수로 비교합니다. 0은 목표 미설정입니다. 학생에게 열린
            문항 범위에 맞춰 정해 주세요.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onTargets(Number(english), Number(math));
            }}
          >
            <label>
              영어 문항 수
              <input
                type="number"
                min="0"
                max="200"
                step="1"
                required
                value={english}
                onChange={(e) => setEnglish(e.target.value)}
              />
            </label>
            <label>
              수학 문항 수
              <input
                type="number"
                min="0"
                max="200"
                step="1"
                required
                value={math}
                onChange={(e) => setMath(e.target.value)}
              />
            </label>
            <button className="classroom-primary" disabled={busy}>
              목표 저장{demo ? " · 미리보기" : ""}
            </button>
          </form>
          <dl>
            <div>
              <dt>학습한 날</dt>
              <dd>{student.activeDays}일</dd>
            </div>
            <div>
              <dt>개념 완료</dt>
              <dd>{student.concepts}개</dd>
            </div>
            <div>
              <dt>복습 완료 기록</dt>
              <dd>{student.reviews}회</dd>
            </div>
          </dl>
          <p className="classroom-muted">
            완료 기록만으로 혼자 풀 수 있게 됐다고 판정하지 않습니다.
          </p>
          {!demo &&
            (confirmRemove ? (
              <div className="classroom-confirm">
                <p>
                  이 학생의 연결을 해제할까요? 학생의 학습 기록은 유지됩니다.
                </p>
                <button disabled={busy} onClick={onRemove}>
                  연결 해제 확인
                </button>
                <button onClick={() => setConfirmRemove(false)}>취소</button>
              </div>
            ) : (
              <button
                className="classroom-text-button"
                onClick={() => setConfirmRemove(true)}
              >
                학생 연결 해제
              </button>
            ))}
        </div>
      </div>
    </section>
  );
}

function Workspace({ user, demo }) {
  const location = useLocation();
  const [mode, setMode] = useState(() => new URLSearchParams(location.search).get("role") === "student" ? "student" : "teacher");
  const [classes, setClasses] = useState({ owned: [], joined: [] });
  const [classId, setClassId] = useState("");
  const [data, setData] = useState(null);
  const [studentId, setStudentId] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [studentName, setStudentName] = useState("");
  const [preview, setPreview] = useState(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [revision, setRevision] = useState(0);
  const [leaving, setLeaving] = useState("");
  const [rotating, setRotating] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setData(null);
    setStudentId("");
    if (demo) {
      setClasses({
        owned: [{ id: "demo", name: "고3 영어·수학 수업반", invite_code: "" }],
        joined: [],
      });
      setClassId("demo");
      setData(classroomDemo());
      setLoading(false);
      return () => {
        active = false;
      };
    }
    classroomRpc(supabase, "list")
      .then(async (result) => {
        if (!active) return;
        if (!Array.isArray(result?.owned) || !Array.isArray(result?.joined))
          throw new Error("CLASS_DATA_INVALID");
        setClasses(result);
        const id = result.owned.some((c) => c.id === classId)
          ? classId
          : result.owned[0]?.id || "";
        if (id !== classId) {
          setClassId(id);
          return;
        }
        if (id) {
          const snapshot = await loadClassroom(supabase, id);
          if (active) setData(snapshot);
        }
      })
      .catch((e) => {
        if (active) setError(classroomError(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [classId, revision, demo]);

  async function act(action, success) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
      setMessage(success);
      setRevision((v) => v + 1);
    } catch (e) {
      setError(classroomError(e));
    } finally {
      setBusy(false);
    }
  }
  const selectedClass = classes.owned.find((c) => c.id === classId);
  const students = data?.students || [];
  const visible = students.filter(
    (s) =>
      s.student_name.includes(query.trim()) &&
      (filter === "all" ||
        (filter === "issues" ? s.issues.length > 0 : s.activeDays === 0)),
  );
  const student = students.find((s) => s.student_id === studentId);
  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(
        `지니쌤과 공부하자에서 수업반에 연결해 주세요.\n${window.location.origin}/eng-math/classroom?role=student\n로그인 → 학생으로 연결 → 초대 코드 입력\n초대 코드: ${selectedClass.invite_code}\n기록 공유에 동의한 뒤, 매일 영어·수학 학습을 시작하세요. 풀지 못한 문제는 풀이를 확인하고 복습해 주세요. 학습 후 회원 기록 동기화 상태까지 확인해 주세요.`,
      );
      setMessage("초대 안내를 복사했습니다. 수업 중인 학생에게 전달해 주세요.");
    } catch {
      setError(
        "자동으로 복사하지 못했습니다. 화면의 초대 코드를 선택해 복사해 주세요.",
      );
    }
  }
  return (
    <>
      {demo && (
        <aside className="classroom-demo">
          <strong>가상 학생으로 보는 미리보기</strong>
          <span>
            실제 학생 기록이 아닙니다. 목표 변경도 이 화면에서만 유지됩니다.
          </span>
          <Link to="/eng-math/classroom">실제 관리 화면</Link>
        </aside>
      )}
      <div className="classroom-heading">
        <div>
          <span className="classroom-eyebrow">영어·수학 수업 관리</span>
          <h1>
            매일의 공부를
            <br />
            함께 확인하세요.
          </h1>
          <p>날짜별 학습 기록을 확인하고, 다음 수업에서 짚을 문제를 모아 보세요.</p>
        </div>
        <div className="classroom-mode" aria-label="관리 역할">
          <button
            aria-pressed={mode === "teacher"}
            onClick={() => setMode("teacher")}
          >
            선생님
          </button>
          <button
            aria-pressed={mode === "student"}
            onClick={() => setMode("student")}
          >
            학생으로 연결
          </button>
        </div>
      </div>
      {error && (
        <div className="classroom-alert" role="alert">
          {error}{" "}
          <button
            disabled={busy || loading}
            onClick={() => setRevision((v) => v + 1)}
          >
            다시 불러오기
          </button>{" "}
          <Link to="?demo=1">가상 학생 미리보기</Link>
        </div>
      )}
      {message && (
        <p className="classroom-notice" role="status">
          {message}
        </p>
      )}
      {mode === "teacher" ? (
        <>
          <section className="classroom-toolbar" aria-label="수업반 관리">
            <label>
              내 수업반
              <select
                value={classId}
                disabled={busy || !classes.owned.length}
                onChange={(e) => {
                  setData(null);
                  setClassId(e.target.value);
                  setRotating(false);
                }}
              >
                <option value="" disabled>
                  수업반을 만들어 주세요
                </option>
                {classes.owned.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                act(async () => {
                  const id = await classroomRpc(supabase, "create", {
                    p_name: name,
                  });
                  setClassId(id);
                  setName("");
                }, "수업반을 만들었습니다. 학생에게 초대 안내를 전달해 주세요.");
              }}
            >
              <label>
                새 수업반 이름
                <input
                  placeholder="예: 고3 화·목 수업반"
                  required
                  maxLength={60}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <button disabled={busy || demo} className="classroom-primary">
                수업반 만들기
              </button>
            </form>
          </section>
          {selectedClass && !demo && (
            <section className="classroom-invite">
              <div>
                <strong>학생을 연결해 주세요</strong>
                <p>
                  학생이 로그인하고 초대 코드를 입력한 뒤 기록 공유에 동의하면
                  목록에 표시됩니다.
                </p>
                <code>{selectedClass.invite_code}</code>
              </div>
              <div>
                <button disabled={busy} onClick={copyInvite}>
                  초대 안내 복사
                </button>
                {rotating ? (
                  <div>
                    <p>
                      기존 코드로는 새로 연결할 수 없게 됩니다. 연결된 학생은
                      유지됩니다.
                    </p>
                    <button
                      disabled={busy}
                      onClick={() =>
                        act(async () => {
                          await classroomRpc(supabase, "rotate_code", {
                            p_class_id: classId,
                          });
                          setRotating(false);
                        }, "초대 코드를 변경했습니다.")
                      }
                    >
                      코드 변경 확인
                    </button>
                    <button onClick={() => setRotating(false)}>취소</button>
                  </div>
                ) : (
                  <button
                    className="classroom-text-button"
                    onClick={() => setRotating(true)}
                  >
                    초대 코드 변경
                  </button>
                )}
              </div>
            </section>
          )}
          {!loading && !error && students.length > 0 && <DailyRoster key={classId} students={students} asOf={data.asOf} onSelect={setStudentId} busy={busy} onRefresh={() => setRevision(v => v + 1)}/>}
          <section className="classroom-roster" aria-label="학생 학습 현황">
            <div className="classroom-section-head">
              <div>
                <h2>학생 학습 현황</h2>
                <p>
                  오늘 포함 최근 7일 ·{" "}
                  {data ? `${dateLabel(data.asOf)} 기준` : "연결된 회원 기록"}
                </p>
              </div>
              <button
                disabled={busy || loading}
                onClick={() => setRevision((v) => v + 1)}
              >
                새로고침
              </button>
            </div>
            <div className="classroom-filters">
              <label>
                학생 찾기
                <input
                  type="search"
                  placeholder="학생 이름"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              <label>
                표시
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="all">
                    {data ? `전체 ${students.length}명` : "전체 학생"}
                  </option>
                  <option value="issues">함께 짚을 문제 있음</option>
                  <option value="inactive">최근 7일 기록 없음</option>
                </select>
              </label>
            </div>
            {loading ? (
              <p role="status" className="classroom-empty">
                학생 기록을 불러오는 중입니다.
              </p>
            ) : error && !data ? (
              <p className="classroom-empty">
                학생 기록을 확인하지 못했습니다. 위 안내를 확인하고 다시 불러와
                주세요.
              </p>
            ) : (
              <>
                {!visible.length ? (
                  <p className="classroom-empty">
                    {!classes.owned.length
                      ? "수업반 이름을 입력하고 수업반 만들기를 눌러 시작하세요."
                      : students.length
                        ? "조건에 맞는 학생이 없습니다."
                        : "아직 연결된 학생이 없습니다. 초대 안내를 학생에게 전달해 주세요."}
                  </p>
                ) : (
                  <div className="classroom-table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>학생</th>
                          <th>영어 문항 / 목표</th>
                          <th>수학 문항 / 목표</th>
                          <th>수업에서 짚을 문제</th>
                          <th>최근 7일 학습</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visible.map((s) => (
                          <tr
                            key={s.student_id}
                            className={
                              s.student_id === studentId ? "is-selected" : ""
                            }
                          >
                            <th>
                              <button
                                aria-pressed={s.student_id === studentId}
                                onClick={() => setStudentId(s.student_id)}
                              >
                                {s.student_name}
                                <span>상세 보기</span>
                              </button>
                            </th>
                            {["english", "math"].map((subject) => (
                              <td
                                key={subject}
                                data-label={`${SUBJECT[subject]} 문항 / 목표`}
                              >
                                <strong>{s.subjects[subject].count}</strong> /{" "}
                                {s.subjects[subject].target || "미설정"}
                                <span>
                                  {s.subjects[subject].attempts
                                    ? `답안 ${s.subjects[subject].attempts}회 중 정답 ${s.subjects[subject].correct}회`
                                    : "답안 기록 없음"}
                                </span>
                              </td>
                            ))}
                            <td data-label="수업에서 짚을 문제">
                              <strong
                                className={
                                  s.issues.length ? "classroom-attention" : ""
                                }
                              >
                                {s.issues.length}문항
                              </strong>
                              <span>최근 30일 마지막 답안 기준</span>
                            </td>
                            <td data-label="최근 7일 학습">
                              {s.activeDays}일
                              <span>
                                {s.activeDays
                                  ? "회원 기록 기준"
                                  : "미학습·미동기화 확인"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <p className="classroom-muted classroom-footnote">
                  같은 문제를 여러 번 풀어도 학습량은 1문항입니다. 정답 횟수에는
                  재풀이가 포함됩니다. 연결 전 최근 30일 기록도 포함하며,
                  동기화되지 않은 기록은 표시되지 않습니다.
                </p>
              </>
            )}
          </section>
          {student && (
            <StudentDetail
              key={`${student.student_id}:${student.english_target}:${student.math_target}`}
              student={student}
              demo={demo}
              busy={busy}
              onTargets={(english, math) => {
                if (demo) {
                  setData((d) => ({
                    ...d,
                    students: d.students.map((s) =>
                      s.student_id === studentId
                        ? {
                            ...s,
                            english_target: english,
                            math_target: math,
                            subjects: {
                              english: {
                                ...s.subjects.english,
                                target: english,
                              },
                              math: { ...s.subjects.math, target: math },
                            },
                          }
                        : s,
                    ),
                  }));
                  setMessage(
                    "미리보기 목표를 바꿨습니다. 실제 학생에게는 저장되지 않습니다.",
                  );
                  return;
                }
                act(
                  () =>
                    classroomRpc(supabase, "member_update", {
                      p_class_id: classId,
                      p_student_id: studentId,
                      p_action: "targets",
                      p_english: english,
                      p_math: math,
                    }),
                  "학생의 학습 목표를 저장했습니다.",
                );
              }}
              onRemove={() =>
                act(
                  () =>
                    classroomRpc(supabase, "member_update", {
                      p_class_id: classId,
                      p_student_id: studentId,
                      p_action: "leave",
                    }),
                  "학생 연결을 해제했습니다.",
                )
              }
            />
          )}
        </>
      ) : (
        <section className="classroom-student">
          <div className="classroom-daily-start">
            <h2>오늘도, 학습을 이어 가세요</h2>
            <p>내 계정으로 로그인하고 수업반에 연결한 뒤 시작하세요. 답안을 제출하면 학습 기록이 남습니다. 모르는 문제는 풀이를 보고 다시 풀어 보세요.</p>
            <div><Link className="classroom-primary" to="/eng-math/practice?subject=english&mode=daily">오늘 영어 학습</Link><Link className="classroom-primary" to="/eng-math/practice?subject=math&mode=daily">오늘 수학 학습</Link></div>
            <p className="classroom-muted">현재 열린 각 5문항 안에서 학습·복습합니다. 매일 새로운 문제가 제공되는 것은 아닙니다. 학습을 마친 뒤 회원 기록 동기화 상태를 확인해 주세요.</p>
          </div>
          <h2>선생님의 수업반에 연결하기</h2>
          <p>선생님께 받은 초대 코드를 입력해 수업반 이름을 먼저 확인하세요.</p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              setPreview(null);
              setConsent(false);
              try {
                const verifiedClass = await classroomRpc(supabase, "preview", {
                  p_code: code,
                });
                setPreview({ ...verifiedClass, code });
              } catch (err) {
                setError(classroomError(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              초대 코드
              <input
                required
                maxLength={32}
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setPreview(null);
                  setConsent(false);
                }}
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <button disabled={busy || demo}>수업반 확인</button>
          </form>
          {preview && (
            <form
              className="classroom-consent"
              onSubmit={(e) => {
                e.preventDefault();
                if (!consent) return;
                act(async () => {
                  await classroomRpc(supabase, "join", {
                    p_code: preview.code,
                    p_name: studentName,
                  });
                  setPreview(null);
                  setCode("");
                  setConsent(false);
                }, "수업반에 연결됐습니다.");
              }}
            >
              <h3>{preview.name}</h3>
              <label>
                선생님이 알아볼 이름
                <input
                  required
                  maxLength={40}
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                />
              </label>
              <label className="classroom-check">
                <input
                  type="checkbox"
                  checked={consent}
                  required
                  onChange={(e) => setConsent(e.target.checked)}
                />
                <span>
                  이 수업반을 만든 선생님에게 내 이름과 영어·수학 최근 30일 학습
                  기록(연결 전 기록 포함)을 공유합니다. 문제별 정오답, 풀이
                  포기, 복습·개념 완료 기록이 포함됩니다. 연결 해제로 공유를
                  중단할 수 있습니다.
                </span>
              </label>
              <button disabled={busy || !consent} className="classroom-primary">
                동의하고 연결하기
              </button>
            </form>
          )}
          <h3>연결된 수업반</h3>
          {!classes.joined.length && <p>아직 연결된 수업반이 없습니다.</p>}
          {classes.joined.map((c) => (
            <article className="classroom-membership" key={c.id}>
              <h3>{c.name}</h3>
              <p>
                {c.student_name} · 최근 7일 목표: 영어{" "}
                {c.english_target || "미설정"} / 수학{" "}
                {c.math_target || "미설정"}
              </p>
              {leaving === c.id ? (
                <>
                  <p>
                    선생님에게 기록 공유를 중단할까요? 내 학습 기록은
                    유지됩니다.
                  </p>
                  <button
                    disabled={busy}
                    onClick={() =>
                      act(async () => {
                        await classroomRpc(supabase, "member_update", {
                          p_class_id: c.id,
                          p_student_id: user.id,
                          p_action: "leave",
                        });
                        setLeaving("");
                      }, "수업반 연결을 해제했습니다.")
                    }
                  >
                    연결 해제 확인
                  </button>
                  <button onClick={() => setLeaving("")}>취소</button>
                </>
              ) : (
                <button onClick={() => setLeaving(c.id)}>연결 해제</button>
              )}
            </article>
          ))}
          <Link to="/eng-math-beta">학습하러 가기</Link>
        </section>
      )}
    </>
  );
}

export default function EngMathClassroom({ user, authReady }) {
  const location = useLocation();
  const demo = new URLSearchParams(location.search).get("demo") === "1";
  return (
    <main className="classroom">
      <div className="classroom-inner">
        <nav className="classroom-nav">
          <Link to="/eng-math-beta">지니쌤과 공부하자</Link>
          <Link to="/eng-math-beta">학습 화면으로</Link>
        </nav>
        {!authReady && !demo ? (
          <p role="status">로그인 상태를 확인하고 있습니다.</p>
        ) : user || demo ? (
          <Workspace
            key={`${user?.id || "guest"}:${demo}`}
            user={user}
            demo={demo}
          />
        ) : (
          <section className="classroom-login">
            <span className="classroom-eyebrow">영어·수학 수업 관리</span>
            <h1>
              학생들의 다음 공부를
              <br />
              한곳에서 준비하세요.
            </h1>
            <p>
              선생님은 수업반을 만들고, 학생은 초대 코드로 연결합니다.
              <br />
              연결된 학생의 학습량과 다시 볼 문제를 확인할 수 있습니다.
            </p>
            <Link
              className="classroom-primary"
              to={engMathAuthUrl(new URLSearchParams(location.search).get("role") === "student" ? "/eng-math/classroom?role=student" : "/eng-math/classroom")}
            >
              로그인하고 시작하기
            </Link>
            <Link to="?demo=1">가상 학생으로 먼저 살펴보기</Link>
          </section>
        )}
      </div>
    </main>
  );
}
