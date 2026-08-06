import { useEffect, useState } from "react";
import { engMathAuthUrl } from "./engMathAccess.js";
import {
  trackEngMathEvent,
  trackEngMathEventOnce,
} from "./engMathTracking.js";

const SUBJECT_NAMES = {
  english: "영어",
  math: "수학",
};

function currentEngMathPath() {
  return `${window.location.pathname}${window.location.search}`;
}

export default function EngMathLockedAccess({
  user,
  subject,
  pack,
  navigate,
  onBack,
}) {
  const [contact, setContact] = useState(user?.email ?? "");
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const subjectName = SUBJECT_NAMES[subject] ?? "영어·수학";

  useEffect(() => {
    trackEngMathEventOnce("eng_math_locked_view", {
      subject,
      target: pack.id,
      path: currentEngMathPath(),
    });
  }, [pack.id, subject]);

  const handleLogin = () => {
    const returnTo = currentEngMathPath();
    trackEngMathEvent("eng_math_login_start", {
      subject,
      target: pack.id,
      path: returnTo,
    });
    navigate(engMathAuthUrl(returnTo));
  };

  const handleWaitlist = async (event) => {
    event.preventDefault();
    const trimmedContact = contact.trim();
    if (trimmedContact.length < 3) {
      setStatus("error");
      setMessage("연락받을 이메일 또는 연락처를 입력해 주세요.");
      return;
    }

    setStatus("submitting");
    setMessage("");
    const details = {
      subject,
      target: pack.id,
      path: currentEngMathPath(),
    };
    trackEngMathEvent("eng_math_waitlist_submit", details);

    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact: trimmedContact,
          source: `eng_math_${subject}`,
          path: currentEngMathPath(),
        }),
      });
      if (!response.ok) throw new Error("WAITLIST_SUBMIT_FAILED");

      trackEngMathEvent("eng_math_waitlist_success", details);
      setStatus("success");
      setMessage("신청이 완료됐습니다. 출시가 확정되면 안내해 드리겠습니다.");
    } catch {
      setStatus("error");
      setMessage("신청을 저장하지 못했습니다. 잠시 뒤 다시 시도해 주세요.");
    }
  };

  return (
    <main className="eng-math-lock">
      <style>{`
        .eng-math-lock {
          min-height: 100svh;
          box-sizing: border-box;
          display: grid;
          place-items: center;
          padding: 28px 18px;
          background: linear-gradient(150deg, #f7f9ff 0%, #ffffff 52%, #f4fbf8 100%);
          color: #16213a;
          font-family: "Noto Sans KR", system-ui, sans-serif;
        }
        .eng-math-lock * { box-sizing: border-box; }
        .eng-math-lock__card {
          width: min(100%, 560px);
          padding: 32px;
          border: 1px solid #dfe5ef;
          border-radius: 24px;
          background: #ffffff;
          box-shadow: 0 18px 44px rgba(33, 54, 91, 0.1);
        }
        .eng-math-lock__badge {
          display: inline-flex;
          align-items: center;
          min-height: 30px;
          padding: 0 11px;
          border-radius: 999px;
          background: #eef3ff;
          color: #3157a5;
          font-size: 0.76rem;
          font-weight: 900;
        }
        .eng-math-lock h1 {
          margin: 18px 0 10px;
          font-size: clamp(1.65rem, 6vw, 2.25rem);
          line-height: 1.25;
          letter-spacing: -0.045em;
          word-break: keep-all;
        }
        .eng-math-lock__pack {
          margin: 0;
          color: #3157a5;
          font-size: 0.95rem;
          font-weight: 800;
        }
        .eng-math-lock__copy {
          margin: 18px 0 0;
          color: #59677f;
          font-size: 0.94rem;
          line-height: 1.7;
          word-break: keep-all;
        }
        .eng-math-lock__account {
          margin-top: 22px;
          padding: 15px 16px;
          border-radius: 14px;
          background: #f6f8fc;
          color: #4e5c73;
          font-size: 0.86rem;
          line-height: 1.55;
        }
        .eng-math-lock__account strong {
          display: block;
          margin-bottom: 3px;
          color: #16213a;
        }
        .eng-math-lock__login,
        .eng-math-lock__submit,
        .eng-math-lock__back {
          min-height: 46px;
          border-radius: 12px;
          font: inherit;
          font-size: 0.9rem;
          font-weight: 800;
          cursor: pointer;
        }
        .eng-math-lock__login {
          width: 100%;
          margin-top: 12px;
          border: 1px solid #3157a5;
          background: #ffffff;
          color: #3157a5;
        }
        .eng-math-lock__form {
          margin-top: 22px;
          padding-top: 22px;
          border-top: 1px solid #e7ebf2;
        }
        .eng-math-lock__form label {
          display: block;
          margin-bottom: 9px;
          color: #26344d;
          font-size: 0.87rem;
          font-weight: 800;
        }
        .eng-math-lock__field-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 8px;
        }
        .eng-math-lock__input {
          min-width: 0;
          min-height: 46px;
          padding: 0 13px;
          border: 1px solid #cfd7e5;
          border-radius: 12px;
          background: #ffffff;
          color: #16213a;
          font: inherit;
          font-size: 0.9rem;
          outline: none;
        }
        .eng-math-lock__input:focus { border-color: #3157a5; }
        .eng-math-lock__submit {
          padding: 0 17px;
          border: 1px solid #3157a5;
          background: #3157a5;
          color: #ffffff;
        }
        .eng-math-lock__submit:disabled { cursor: wait; opacity: 0.62; }
        .eng-math-lock__message {
          margin: 10px 0 0;
          color: #667085;
          font-size: 0.8rem;
          line-height: 1.5;
        }
        .eng-math-lock__message--success { color: #16705b; }
        .eng-math-lock__message--error { color: #a33a3a; }
        .eng-math-lock__back {
          width: 100%;
          margin-top: 18px;
          border: 0;
          background: transparent;
          color: #53627a;
        }
        @media (max-width: 520px) {
          .eng-math-lock { padding: 18px 14px; }
          .eng-math-lock__card { padding: 24px 20px; border-radius: 20px; }
          .eng-math-lock__field-row { grid-template-columns: 1fr; }
          .eng-math-lock__submit { width: 100%; }
        }
      `}</style>

      <section className="eng-math-lock__card" aria-labelledby="lock-title">
        <span className="eng-math-lock__badge">판매 준비 중</span>
        <h1 id="lock-title">이 5문항 묶음은 아직 열리지 않았습니다.</h1>
        <p className="eng-math-lock__pack">
          {subjectName} · {pack.examLabel} · {pack.label}
        </p>
        <p className="eng-math-lock__copy">
          검증이 끝난 문항만 순서대로 공개하고 있습니다. 현재는 가격과 결제를
          열지 않았으며, 출시 알림만 신청할 수 있습니다.
        </p>

        <div className="eng-math-lock__account">
          {user ? (
            <>
              <strong>학습 계정 연결됨</strong>
              로그인은 학습 기록 연결에만 사용되며, 로그인만으로 잠금이
              해제되지는 않습니다.
            </>
          ) : (
            <>
              <strong>학습 계정 연결</strong>
              로그인하면 이 화면으로 돌아옵니다. 로그인만으로 잠금이
              해제되지는 않습니다.
              <button
                className="eng-math-lock__login"
                type="button"
                onClick={handleLogin}
              >
                로그인하고 돌아오기
              </button>
            </>
          )}
        </div>

        <form className="eng-math-lock__form" onSubmit={handleWaitlist}>
          <label htmlFor="eng-math-waitlist-contact">출시 알림 신청</label>
          <div className="eng-math-lock__field-row">
            <input
              id="eng-math-waitlist-contact"
              className="eng-math-lock__input"
              type="text"
              value={contact}
              onChange={(event) => setContact(event.target.value)}
              placeholder="이메일 또는 연락처"
              autoComplete="email"
              disabled={status === "submitting" || status === "success"}
            />
            <button
              className="eng-math-lock__submit"
              type="submit"
              disabled={status === "submitting" || status === "success"}
            >
              {status === "submitting" ? "신청 중" : "알림 신청"}
            </button>
          </div>
          {message && (
            <p
              className={`eng-math-lock__message eng-math-lock__message--${status}`}
              role={status === "error" ? "alert" : "status"}
            >
              {message}
            </p>
          )}
        </form>

        <button className="eng-math-lock__back" type="button" onClick={onBack}>
          문항 목록으로 돌아가기
        </button>
      </section>
    </main>
  );
}
