import { useEffect } from "react";

const SECTION_STYLE = {
  marginBottom: "32px",
};

const H2_STYLE = {
  fontSize: "1.15rem",
  fontWeight: 700,
  color: "#111827",
  marginBottom: "12px",
  marginTop: "28px",
  paddingBottom: "6px",
  borderBottom: "2px solid #1f2937",
};

const H3_STYLE = {
  fontSize: "0.95rem",
  fontWeight: 600,
  color: "#1f2937",
  marginTop: "20px",
  marginBottom: "8px",
};

const P_STYLE = {
  fontSize: "0.85rem",
  lineHeight: 1.7,
  color: "#374151",
  marginBottom: "10px",
};

const TABLE_STYLE = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "0.8rem",
  marginBottom: "16px",
  border: "1px solid #d1d5db",
};

const TH_STYLE = {
  background: "#f3f4f6",
  padding: "8px 10px",
  textAlign: "left",
  border: "1px solid #d1d5db",
  fontWeight: 600,
};

const TD_STYLE = {
  padding: "8px 10px",
  border: "1px solid #d1d5db",
  verticalAlign: "top",
};

const UL_STYLE = {
  paddingLeft: "20px",
  marginBottom: "10px",
  fontSize: "0.85rem",
  lineHeight: 1.7,
  color: "#374151",
};

export default function Privacy() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div
      style={{
        maxWidth: "780px",
        margin: "0 auto",
        padding: "32px 20px 80px",
        fontFamily: "'Noto Sans KR', sans-serif",
      }}
    >
      <h1
        style={{
          fontSize: "1.6rem",
          fontWeight: 800,
          color: "#111827",
          marginBottom: "8px",
        }}
      >
        개인정보처리방침 · 이용약관
      </h1>
      <p style={{ fontSize: "0.8rem", color: "#6b7280", marginBottom: "32px" }}>
        시행일: 2026년 5월 15일 · 짚이 (Jippi)
      </p>

      {/* ──────────────────────────────────────────── */}
      {/* 사업자 정보 */}
      {/* ──────────────────────────────────────────── */}
      <section style={SECTION_STYLE}>
        <h2 style={H2_STYLE}>사업자 정보</h2>
        <table style={TABLE_STYLE}>
          <tbody>
            <tr>
              <th style={TH_STYLE}>상호</th>
              <td style={TD_STYLE}>지니쌤과 공부하자</td>
            </tr>
            <tr>
              <th style={TH_STYLE}>대표자</th>
              <td style={TD_STYLE}>박성진</td>
            </tr>
            <tr>
              <th style={TH_STYLE}>사업자 등록번호</th>
              <td style={TD_STYLE}>297-93-01982</td>
            </tr>
            <tr>
              <th style={TH_STYLE}>사업장 주소</th>
              <td style={TD_STYLE}>서울특별시 강북구 도봉로50길 15 301호</td>
            </tr>
            <tr>
              <th style={TH_STYLE}>사업장 연락처</th>
              <td style={TD_STYLE}>0502-1944-2070</td>
            </tr>
            <tr>
              <th style={TH_STYLE}>통신판매업 신고번호</th>
              <td style={TD_STYLE}>2026-서울강북-0428호</td>
            </tr>
            <tr>
              <th style={TH_STYLE}>고객센터</th>
              <td style={TD_STYLE}>seongjinpark12@gmail.com</td>
            </tr>
            <tr>
              <th style={TH_STYLE}>개인정보관리책임자</th>
              <td style={TD_STYLE}>박성진 / seongjinpark12@gmail.com</td>
            </tr>
            <tr>
              <th style={TH_STYLE}>서비스명</th>
              <td style={TD_STYLE}>짚이 (Jippi) — 수능 국어 분석 도구</td>
            </tr>
            <tr>
              <th style={TH_STYLE}>도메인</th>
              <td style={TD_STYLE}>jippi.kr</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* ──────────────────────────────────────────── */}
      {/* 개인정보처리방침 */}
      {/* ──────────────────────────────────────────── */}
      <section style={SECTION_STYLE}>
        <h2 style={H2_STYLE}>1. 개인정보처리방침</h2>

        <p style={P_STYLE}>
          짚이(이하 "서비스")는 「개인정보 보호법」을 준수하여 이용자의 개인정보를
          보호하고 권익을 보장하기 위해 본 방침을 수립·공개합니다.
        </p>

        <h3 style={H3_STYLE}>1-1. 수집하는 개인정보 항목</h3>
        <table style={TABLE_STYLE}>
          <thead>
            <tr>
              <th style={TH_STYLE}>구분</th>
              <th style={TH_STYLE}>항목</th>
              <th style={TH_STYLE}>수집 방법</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={TD_STYLE}>회원가입 (Google OAuth)</td>
              <td style={TD_STYLE}>
                이메일 주소, Google 계정 프로필 (이름, 프로필 이미지 URL)
              </td>
              <td style={TD_STYLE}>Google OAuth 인증</td>
            </tr>
            <tr>
              <td style={TD_STYLE}>서비스 이용</td>
              <td style={TD_STYLE}>
                문제 풀이 기록, 정답·오답 패턴, 학습 통계, 근거 납득 피드백
              </td>
              <td style={TD_STYLE}>서비스 이용 중 자동 수집</td>
            </tr>
            <tr>
              <td style={TD_STYLE}>피드백 제출</td>
              <td style={TD_STYLE}>제출자 자발 작성 본문 (선택 입력)</td>
              <td style={TD_STYLE}>Tally form 제출</td>
            </tr>
            <tr>
              <td style={TD_STYLE}>자동 수집</td>
              <td style={TD_STYLE}>
                IP 주소, 접속 시각, 브라우저 정보, 쿠키, 페이지 이동 로그
              </td>
              <td style={TD_STYLE}>웹 로그 자동 수집</td>
            </tr>
            <tr>
              <td style={TD_STYLE}>결제 (활성화 시)</td>
              <td style={TD_STYLE}>
                결제 수단 정보는 결제대행사(Toss Payments)에서 직접 수집·처리하며,
                서비스는 거래 식별번호만 보관
              </td>
              <td style={TD_STYLE}>결제대행사 연동</td>
            </tr>
          </tbody>
        </table>

        <h3 style={H3_STYLE}>1-2. 수집 목적</h3>
        <ul style={UL_STYLE}>
          <li>회원 식별 및 로그인 인증</li>
          <li>학습 진척도 추적 및 개인 맞춤 분석 제공</li>
          <li>오답 패턴 진단 및 학습 리포트 생성</li>
          <li>서비스 품질 개선 (피드백 분석)</li>
          <li>법령 의무 준수 및 분쟁 대응</li>
        </ul>

        <h3 style={H3_STYLE}>1-3. 보유·이용 기간</h3>
        <ul style={UL_STYLE}>
          <li>
            회원 정보: 회원 탈퇴 시 즉시 파기 (단, 관련 법령에 의한 보존 의무
            영역은 해당 기간 보유)
          </li>
          <li>풀이 기록·피드백: 회원 탈퇴 시 즉시 파기 또는 익명화 처리</li>
          <li>자동 수집 로그: 최대 3개월 보유 후 파기</li>
          <li>
            전자상거래법에 따른 보존 (결제 활성화 시 적용):
            <ul style={UL_STYLE}>
              <li>계약·청약철회 기록: 5년</li>
              <li>대금결제·재화공급 기록: 5년</li>
              <li>소비자 불만·분쟁 처리 기록: 3년</li>
            </ul>
          </li>
        </ul>

        <h3 style={H3_STYLE}>1-4. 제3자 제공</h3>
        <p style={P_STYLE}>
          서비스는 이용자의 개인정보를 외부에 제공하지 않습니다. 단, 다음의 경우
          예외로 합니다.
        </p>
        <ul style={UL_STYLE}>
          <li>이용자가 사전 동의한 경우</li>
          <li>법령 의무 또는 수사기관의 적법한 요청이 있는 경우</li>
        </ul>

        <h3 style={H3_STYLE}>1-5. 개인정보 처리위탁</h3>
        <p style={P_STYLE}>
          서비스 운영을 위해 다음의 외부 업체에 개인정보 처리를 위탁합니다.
        </p>
        <table style={TABLE_STYLE}>
          <thead>
            <tr>
              <th style={TH_STYLE}>수탁사</th>
              <th style={TH_STYLE}>위탁 영역</th>
              <th style={TH_STYLE}>국가</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={TD_STYLE}>Supabase Inc.</td>
              <td style={TD_STYLE}>회원 정보·풀이 기록·피드백 데이터베이스</td>
              <td style={TD_STYLE}>미국</td>
            </tr>
            <tr>
              <td style={TD_STYLE}>Vercel Inc.</td>
              <td style={TD_STYLE}>웹사이트 호스팅</td>
              <td style={TD_STYLE}>미국</td>
            </tr>
            <tr>
              <td style={TD_STYLE}>Google LLC</td>
              <td style={TD_STYLE}>OAuth 인증</td>
              <td style={TD_STYLE}>미국</td>
            </tr>
            <tr>
              <td style={TD_STYLE}>Tally B.V.</td>
              <td style={TD_STYLE}>피드백 form 운영</td>
              <td style={TD_STYLE}>벨기에</td>
            </tr>
            <tr>
              <td style={TD_STYLE}>Anthropic, PBC</td>
              <td style={TD_STYLE}>AI Q&A·해설 분석 (Claude API)</td>
              <td style={TD_STYLE}>미국</td>
            </tr>
            <tr>
              <td style={TD_STYLE}>OpenAI, L.L.C.</td>
              <td style={TD_STYLE}>데이터 정확성 보조 (백엔드 처리)</td>
              <td style={TD_STYLE}>미국</td>
            </tr>
          </tbody>
        </table>
        <p style={P_STYLE}>
          각 수탁사는 자체 보안 정책에 따라 운영하며, 서비스는 위탁 계약 의무를
          정기적으로 점검합니다.
        </p>

        <h3 style={H3_STYLE}>1-6. 이용자 권리</h3>
        <p style={P_STYLE}>
          이용자는 언제든지 다음의 권리를 행사할 수 있습니다.
        </p>
        <ul style={UL_STYLE}>
          <li>개인정보 열람·정정·삭제·처리정지 요청</li>
          <li>개인정보 수집·이용 동의 철회 (= 회원 탈퇴)</li>
          <li>
            위 권리 행사:{" "}
            <strong>seongjinpark12@gmail.com</strong> 으로 요청
          </li>
        </ul>

        <h3 style={H3_STYLE}>1-7. 만 14세 미만 아동의 개인정보</h3>
        <p style={P_STYLE}>
          만 14세 미만 아동의 개인정보를 수집·이용·제공하기 위해서는 법정대리인의
          동의가 필요합니다. 서비스는 다음과 같이 운영합니다.
        </p>
        <ul style={UL_STYLE}>
          <li>
            만 14세 미만 사용자는 서비스 이용 전 반드시 법정대리인(부모 또는
            보호자)의 동의를 받아 가입해야 합니다.
          </li>
          <li>
            법정대리인의 동의가 확인되지 않은 만 14세 미만 사용자의 계정이
            식별되는 경우, 서비스는 해당 계정의 이용을 제한하거나 정보를 삭제할
            수 있습니다.
          </li>
          <li>
            법정대리인은 본인 자녀의 개인정보 열람·정정·삭제·처리정지를 위
            연락처로 요청할 수 있습니다.
          </li>
        </ul>

        <h3 style={H3_STYLE}>1-8. 자동 수집 정보 및 쿠키</h3>
        <p style={P_STYLE}>
          서비스는 로그인 상태 유지 및 서비스 이용 분석을 위해 쿠키 및 유사
          기술을 사용합니다. 브라우저 설정에서 쿠키 차단 시 일부 기능(로그인,
          학습 기록 저장 등) 이용이 제한될 수 있습니다.
        </p>

        <h3 style={H3_STYLE}>1-9. 개인정보 안전성 확보</h3>
        <ul style={UL_STYLE}>
          <li>전송 암호화 (HTTPS)</li>
          <li>저장 시 접근 권한 제한 및 행위 로그 점검</li>
          <li>비밀번호 별도 저장 X (Google OAuth 위임)</li>
        </ul>

        <h3 style={H3_STYLE}>1-10. 개인정보 보호책임자</h3>
        <table style={TABLE_STYLE}>
          <tbody>
            <tr>
              <th style={TH_STYLE}>성명</th>
              <td style={TD_STYLE}>박성진</td>
            </tr>
            <tr>
              <th style={TH_STYLE}>이메일</th>
              <td style={TD_STYLE}>seongjinpark12@gmail.com</td>
            </tr>
          </tbody>
        </table>

        <h3 style={H3_STYLE}>1-11. 권익 침해 구제</h3>
        <ul style={UL_STYLE}>
          <li>개인정보분쟁조정위원회 (1833-6972 · kopico.go.kr)</li>
          <li>개인정보침해신고센터 (118 · privacy.kisa.or.kr)</li>
          <li>경찰청 사이버수사국 (182 · ecrm.cyber.go.kr)</li>
        </ul>

        <h3 style={H3_STYLE}>1-12. 변경 고지</h3>
        <p style={P_STYLE}>
          본 방침의 변경이 있을 시 서비스 내 공지사항 또는 본 페이지를 통해 시행
          7일 전 사전 고지합니다.
        </p>
      </section>

      {/* ──────────────────────────────────────────── */}
      {/* 이용약관 */}
      {/* ──────────────────────────────────────────── */}
      <section style={SECTION_STYLE}>
        <h2 style={H2_STYLE}>2. 이용약관</h2>

        <h3 style={H3_STYLE}>2-1. 목적</h3>
        <p style={P_STYLE}>
          본 약관은 짚이(이하 "서비스")가 제공하는 수능 국어 분석 도구 이용에
          관한 권리와 의무를 규정합니다.
        </p>

        <h3 style={H3_STYLE}>2-2. 회원 가입 및 탈퇴</h3>
        <ul style={UL_STYLE}>
          <li>이용자는 Google 계정으로 회원가입할 수 있습니다.</li>
          <li>
            이용자는 언제든지 회원 탈퇴를 요청할 수 있으며, 탈퇴 시 개인정보는 본
            방침 1-3에 따라 처리됩니다.
          </li>
          <li>만 14세 미만 사용자는 법정대리인 동의 후 가입해야 합니다.</li>
        </ul>

        <h3 style={H3_STYLE}>2-3. 서비스 이용</h3>
        <ul style={UL_STYLE}>
          <li>무료 영역: 수능 5개년 (FREE_YEARS) 풀이·해설·형광펜 분석</li>
          <li>유료 영역: Pro 구독 (베타 단계 결제 미활성화)</li>
          <li>
            서비스는 운영상 필요 시 일부 영역을 변경·중단할 수 있으며, 이용자에게
            사전 공지합니다.
          </li>
        </ul>

        <h3 style={H3_STYLE}>2-4. 이용 제한</h3>
        <p style={P_STYLE}>
          다음의 행위는 금지됩니다. 위반 시 서비스 이용이 제한될 수 있습니다.
        </p>
        <ul style={UL_STYLE}>
          <li>서비스 콘텐츠의 무단 복제·배포·상업적 이용</li>
          <li>자동화 도구(crawler, bot 등)를 사용한 콘텐츠 수집</li>
          <li>타인의 계정 도용 또는 서비스 시스템 침해 시도</li>
          <li>관계 법령 위반 행위</li>
        </ul>

        <h3 style={H3_STYLE}>2-5. 책임 한계</h3>
        <ul style={UL_STYLE}>
          <li>
            서비스는 수능 국어 학습 보조 도구이며, 학습 결과·시험 성적·입시 결과에
            대해 책임을 지지 않습니다.
          </li>
          <li>
            AI 분석 결과(해설·진단·추천)는 참고용이며, 절대적 정확성을 보장하지
            않습니다.
          </li>
          <li>
            천재지변, 통신장애 등 불가항력 사유로 인한 서비스 중단에 대해 책임을
            지지 않습니다.
          </li>
        </ul>

        <h3 style={H3_STYLE}>2-6. 콘텐츠 저작권</h3>
        <ul style={UL_STYLE}>
          <li>
            수능 기출문제 원문의 저작권은 한국교육과정평가원에 귀속됩니다.
            서비스는 학습 목적의 공정이용 영역 안에서 활용합니다.
          </li>
          <li>
            서비스가 자체 제작한 해설·분석·UI 등의 저작권은 짚이에 귀속됩니다.
          </li>
        </ul>

        <h3 style={H3_STYLE}>2-7. 분쟁 해결</h3>
        <p style={P_STYLE}>
          본 약관은 대한민국 법령에 따라 적용되며, 서비스 이용과 관련된 분쟁은
          민사소송법에 따라 정해진 관할 법원에서 해결합니다.
        </p>

        <h3 style={H3_STYLE}>2-8. 약관 변경</h3>
        <p style={P_STYLE}>
          본 약관의 변경이 있을 시 시행 7일 전 사전 공지합니다.
        </p>
      </section>

      <p
        style={{
          fontSize: "0.75rem",
          color: "#9ca3af",
          marginTop: "40px",
          textAlign: "center",
        }}
      >
        문의: seongjinpark12@gmail.com · 시행일 2026년 5월 15일
      </p>
    </div>
  );
}
