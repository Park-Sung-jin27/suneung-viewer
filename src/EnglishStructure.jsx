import { useState } from "react";

const C = {
  ink: "#111827",
  text: "#374151",
  muted: "#6b7280",
  subtle: "#9ca3af",
  line: "#d8e2d6",
  green: "#2d6e2d",
  greenSoft: "#edf7ed",
  paper: "#fbfaf7",
  white: "#ffffff",
  blue: "#2563eb",
  blueSoft: "#eff6ff",
  amber: "#b45309",
  amberSoft: "#fffbeb",
  rose: "#be123c",
  roseSoft: "#fff1f2",
};

const ROLE_META = {
  도입: { color: C.blue, bg: C.blueSoft },
  통념: { color: "#7c3aed", bg: "#f5f3ff" },
  근거: { color: "#0f766e", bg: "#f0fdfa" },
  전환: { color: C.rose, bg: C.roseSoft },
  핵심: { color: C.green, bg: C.greenSoft },
  예시: { color: C.amber, bg: C.amberSoft },
  결과: { color: "#0369a1", bg: "#e0f2fe" },
  결론: { color: "#4338ca", bg: "#eef2ff" },
  검사: { color: "#c2410c", bg: "#fff7ed" },
};

const QUESTIONS = [
  {
    id: 24,
    type: "제목",
    textType: "논설문",
    answer: "①",
    focus: "전환어 뒤 결론을 제목에 담기",
    oneLine: "첫 문장은 소재, Yet 뒤가 답입니다.",
    steps: [
      "첫 문장에서 소재를 잡는다: 이동이 많고 빨라지는 현상.",
      "수치 문장들은 배경 근거로 묶고 오래 붙잡지 않는다.",
      "Yet 뒤에서 글이 꺾이는 지점을 찾는다.",
      "마지막 결론을 제목 선지와 맞춘다.",
    ],
    sentences: [
      {
        role: "통념",
        text: "Hyper-mobility, the notion that more travel at faster speeds covering longer distances generates greater economic success, seems to be a distinguishing feature of urban areas, where more than half of the world's population currently reside.",
        note: "이동 증가가 경제 성공을 만든다는 출발 생각",
      },
      {
        role: "근거",
        text: "By 2005, approximately 7.5 billion trips were made each day in cities worldwide.",
        note: "이동량 증가를 보여 주는 수치",
      },
      {
        role: "근거",
        text: "In 2050, there may be three to four times as many passenger-kilometres travelled as in the year 2000, infrastructure and energy prices permitting.",
        note: "앞으로 더 늘어날 수 있다는 전망",
      },
      {
        role: "근거",
        text: "Freight movement could also rise more than threefold during the same period.",
        note: "화물 이동까지 증가한다는 추가 근거",
      },
      {
        role: "핵심",
        text: "Mobility flows have become a key dynamic of urbanization, with the associated infrastructure invariably constituting the backbone of urban form.",
        note: "이동성이 도시화의 핵심 동력이라는 중간 정리",
      },
      {
        role: "전환",
        text: "Yet, despite the increasing level of urban mobility worldwide, access to places, activities and services has become increasingly difficult.",
        note: "이 글의 방향이 뒤집히는 문장",
      },
      {
        role: "결과",
        text: "Not only is it less convenient in terms of time, cost and comfort to access locations in cities, but the very process of moving around in cities generates a number of negative externalities.",
        note: "이동 증가가 오히려 불편과 부작용을 만든다는 설명",
      },
      {
        role: "결론",
        text: "Accordingly, many of the world's cities face an unprecedented accessibility crisis, and are characterized by unsustainable mobility systems.",
        note: "정답 제목으로 연결되는 최종 판단",
      },
    ],
  },
  {
    id: 29,
    type: "어법",
    textType: "설명문",
    answer: "③",
    focus: "긴 주어 뒤 진짜 동사 확인",
    oneLine: "해석보다 주어와 동사를 먼저 찾습니다.",
    steps: [
      "밑줄만 보지 않고 문장 전체 뼈대를 본다.",
      "수식어를 걷어내고 주어 덩어리를 찾는다.",
      "주어 뒤에 진짜 동사가 있는지 확인한다.",
      "주어 자리에 연결되지 못한 형태를 고른다.",
    ],
    sentences: [
      {
        role: "도입",
        text: "Consider The Wizard of Oz as a psychological study of motivation.",
        note: "작품을 동기 심리로 읽겠다는 안내",
      },
      {
        role: "예시",
        text: "Dorothy and her three friends work hard to get to the Emerald City, overcoming barriers, persisting against all adversaries.",
        note: "인물들의 노력을 사례로 제시",
      },
      {
        role: "근거",
        text: "They do so because they expect the Wizard to give them what they are missing.",
        note: "노력의 이유",
      },
      {
        role: "전환",
        text: "Instead, the wonderful and wise Wizard makes them aware that they, not he, always had the power to fulfill their wishes.",
        note: "마법사가 주는 것이 아니라 원래 갖고 있었다는 반전",
      },
      {
        role: "예시",
        text: "For Dorothy, home is not a place but a feeling of security, of comfort with people she loves; it is wherever her heart is.",
        note: "Dorothy 사례",
      },
      {
        role: "검사",
        text: "The courage the Lion wants, the intelligence the Scarecrow longs for, and the emotions the Tin Man dreams of being attributes they already possess.",
        note: "긴 주어 뒤에 진짜 동사가 없어 어법이 깨지는 자리",
      },
      {
        role: "핵심",
        text: "They need to think about these attributes not as internal conditions but as positive ways in which they are already relating to others.",
        note: "능력을 내면 상태가 아니라 관계 방식으로 보라는 핵심",
      },
      {
        role: "결론",
        text: "After all, didn't they demonstrate those qualities on the journey to Oz, a journey motivated by little more than an expectation, an idea about the future likelihood of getting something they wanted?",
        note: "이미 여정에서 능력을 보여 주었다는 마무리",
      },
    ],
  },
  {
    id: 30,
    type: "어휘",
    textType: "설명문",
    answer: "④",
    focus: "흐름의 방향으로 단어 선택",
    oneLine: "초기 도움에서 경험 후 독립으로 갑니다.",
    steps: [
      "첫 문장에서 핵심 개념인 autonomy를 잡는다.",
      "A는 부족하거나 틀린 사전 지식을 보완하는 방향으로 본다.",
      "B는 경험이 없으면 혼자 제대로 행동하기 어렵다는 조건으로 본다.",
      "C는 충분한 경험 뒤 사전 지식에서 독립하는 결과로 본다.",
    ],
    sentences: [
      {
        role: "도입",
        text: "To the extent that an agent relies on the prior knowledge of its designer rather than on its own percepts, we say that the agent lacks autonomy.",
        note: "자율성 부족의 정의",
      },
      {
        role: "핵심",
        text: "A rational agent should be autonomous; it should learn what it can to compensate for partial or incorrect prior knowledge.",
        note: "A는 부족한 지식을 보완해야 한다는 방향",
      },
      {
        role: "예시",
        text: "For example, a vacuum-cleaning agent that learns to foresee where and when additional dirt will appear will do better than one that does not.",
        note: "학습하는 청소 로봇 사례",
      },
      {
        role: "근거",
        text: "As a practical matter, one seldom requires complete autonomy from the start: when the agent has had little or no experience, it would have to act randomly unless the designer gave some assistance.",
        note: "B는 경험이 없으면 무작위로 행동할 수밖에 없다는 흐름",
      },
      {
        role: "예시",
        text: "So, just as evolution provides animals with enough built-in reflexes to survive long enough to learn for themselves, it would be reasonable to provide an artificial intelligent agent with some initial knowledge as well as an ability to learn.",
        note: "초기 지식과 학습 능력을 함께 주는 비유",
      },
      {
        role: "결과",
        text: "After sufficient experience of its environment, the behavior of a rational agent can become effectively independent of its prior knowledge.",
        note: "C는 경험 뒤 독립으로 가는 결과",
      },
      {
        role: "결론",
        text: "Hence, the incorporation of learning allows one to design a single rational agent that will succeed in a vast variety of environments.",
        note: "학습이 다양한 환경 적응을 가능하게 한다는 결론",
      },
    ],
  },
  {
    id: 33,
    type: "빈칸",
    textType: "설명문",
    answer: "①",
    focus: "대립쌍으로 빈칸 예측",
    oneLine: "과학자는 관찰자 독립, 예술가는 관찰자 의존입니다.",
    steps: [
      "첫 문장에서 과학자와 예술가의 공통 질문을 잡는다.",
      "과학자의 방식은 subjectivity를 제거하는 쪽으로 표시한다.",
      "on the other hand 뒤에서 예술가의 반대 방식을 찾는다.",
      "빈칸 앞 dependent upon observers를 한국어 핵심어로 바꾼다.",
    ],
    sentences: [
      {
        role: "도입",
        text: "Whatever their differences, scientists and artists begin with the same question: can you and I see the same thing the same way? If so, how?",
        note: "과학자와 예술가를 비교하는 출발점",
      },
      {
        role: "근거",
        text: "The scientific thinker looks for features of the thing that can be stripped of subjectivity, ideally, those aspects that can be quantified and whose values will thus never change from one observer to the next.",
        note: "과학자는 주관성을 제거하려 함",
      },
      {
        role: "결론",
        text: "In this way, he arrives at a reality independent of all observers.",
        note: "과학자의 결론은 관찰자와 무관한 현실",
      },
      {
        role: "전환",
        text: "The artist, on the other hand, relies on the strength of her artistry to effect a marriage between her own subjectivity and that of her readers.",
        note: "예술가는 작가와 독자의 주관성을 연결함",
      },
      {
        role: "예시",
        text: "To a scientific thinker, this must sound like magical thinking: you're saying you will imagine something so hard it'll pop into someone else's head exactly the way you envision it?",
        note: "과학자 입장에서 예술가 방식이 이상하게 보인다는 설명",
      },
      {
        role: "핵심",
        text: "The artist has sought the opposite of the scientist's observer-independent reality.",
        note: "빈칸을 풀게 하는 핵심 대립",
      },
      {
        role: "결론",
        text: "She creates a reality dependent upon observers, indeed a reality in which human beings must participate in order for it to exist at all.",
        note: "정답은 사람이 참여해야 존재한다는 내용",
      },
    ],
  },
  {
    id: 37,
    type: "순서",
    textType: "설명문",
    answer: "③",
    focus: "원인에서 기능, 효과로 이동",
    oneLine: "B가 원인, C가 기능, A가 집단 효과입니다.",
    steps: [
      "주어진 글의 마지막 표현인 social environment를 잡는다.",
      "B에서 혼자 있을 때는 얼굴을 붉히지 않는다는 사회적 원인을 붙인다.",
      "C의 However로 부정적 느낌에서 긍정 기능으로 전환한다.",
      "A에서 집단 응집이라는 장기 효과로 마무리한다.",
    ],
    sentences: [
      {
        role: "도입",
        text: "Darwin saw blushing as uniquely human, representing an involuntary physical reaction caused by embarrassment and self-consciousness in a social environment.",
        note: "얼굴 붉힘을 사회적 상황의 반응으로 제시",
      },
      {
        role: "근거",
        text: "If we feel awkward, embarrassed or ashamed when we are alone, we don't blush; it seems to be caused by our concern about what others are thinking of us.",
        note: "B 첫 문장: 사회적 시선이 원인임을 설명",
      },
      {
        role: "근거",
        text: "Studies have confirmed that simply being told you are blushing brings it on.",
        note: "B 둘째 문장: 연구 근거",
      },
      {
        role: "결과",
        text: "We feel as though others can see through our skin and into our mind.",
        note: "B 셋째 문장: 남의 시선에 노출된 느낌",
      },
      {
        role: "전환",
        text: "However, while we sometimes want to disappear when we involuntarily go bright red, psychologists argue that blushing actually serves a positive social purpose.",
        note: "C 첫 문장: 창피함에서 긍정 기능으로 전환",
      },
      {
        role: "핵심",
        text: "When we blush, it's a signal to others that we recognize that a social norm has been broken; it is an apology for a faux pas.",
        note: "C 둘째 문장: 얼굴 붉힘의 사회적 기능",
      },
      {
        role: "결과",
        text: "Maybe our brief loss of face benefits the long-term cohesion of the group.",
        note: "A 첫 문장: 집단 응집이라는 효과",
      },
      {
        role: "근거",
        text: "Interestingly, if someone blushes after making a social mistake, they are viewed in a more favourable light than those who don't blush.",
        note: "A 둘째 문장: 긍정 평가를 받는다는 마무리 근거",
      },
    ],
  },
  {
    id: 38,
    type: "삽입",
    textType: "설명문",
    answer: "⑤",
    focus: "Instead 앞뒤 연결 확인",
    oneLine: "공식 교육이 없으니 대신 동료에게 흡수합니다.",
    inserted:
      "Instead, much like the young child learning how to play 'nicely', the apprentice scientist gains his or her understanding of the moral values inherent in the role by absorption from their colleagues, socialization.",
    steps: [
      "주어진 문장 첫 단어 Instead를 확인한다.",
      "앞에는 반대되는 내용인 공식 교육 부재가 와야 한다.",
      "뒤에는 동료에게 흡수되는 가치가 위협받는다는 말이 이어져야 한다.",
      "넣은 뒤 앞뒤 두 문장이 자연스러운 위치를 고른다.",
    ],
    sentences: [
      {
        role: "도입",
        text: "As particular practices are repeated over time and become more widely shared, the values that they embody are reinforced and reproduced and we speak of them as becoming 'institutionalized'.",
        note: "가치가 제도화되는 과정 소개",
      },
      {
        role: "예시",
        text: "In some cases, this institutionalization has a formal face to it, with rules and protocols written down, and specialized roles created to ensure that procedures are followed correctly.",
        note: "공식 제도의 경우",
      },
      {
        role: "예시",
        text: "The main institutions of state, parliament, courts, police and so on, along with certain of the professions, exhibit this formal character.",
        note: "공식 성격을 가진 기관 예시",
      },
      {
        role: "전환",
        text: "Other social institutions, perhaps the majority, are not like this; science is an example.",
        note: "과학은 공식 제도와 다르다는 전환",
      },
      {
        role: "핵심",
        text: "Although scientists are trained in the substantive content of their discipline, they are not formally instructed in 'how to be a good scientist'.",
        note: "주어진 문장 앞에 와야 하는 공식 교육 부재",
      },
      {
        role: "결과",
        text: "Instead, much like the young child learning how to play 'nicely', the apprentice scientist gains his or her understanding of the moral values inherent in the role by absorption from their colleagues, socialization.",
        note: "⑤ 위치에 들어가는 문장",
      },
      {
        role: "결론",
        text: "We think that these values, along with the values that inform many of the professions, are under threat, just as the value of the professions themselves is under threat.",
        note: "흡수되는 가치가 위협받는다는 결론",
      },
    ],
  },
];

function getRoleStyle(role) {
  return ROLE_META[role] ?? { color: C.text, bg: "#f3f4f6" };
}

function RoleBadge({ role }) {
  const meta = getRoleStyle(role);
  return (
    <span
      className="es-role"
      style={{
        color: meta.color,
        background: meta.bg,
        borderColor: `${meta.color}33`,
      }}
    >
      {role}
    </span>
  );
}

function QuestionCard({ question, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`es-card ${selected ? "is-selected" : ""}`}
      style={{
        borderColor: selected ? C.green : C.line,
        background: selected ? C.greenSoft : C.white,
      }}
    >
      <div className="es-card-top">
        <strong>{question.id}번</strong>
        <span>{question.type}</span>
      </div>
      <div className="es-card-title">{question.focus}</div>
      <div className="es-card-meta">
        {question.textType} · 정답 {question.answer}
      </div>
    </button>
  );
}

function SentenceRow({ item, idx }) {
  return (
    <div className="es-sentence-row">
      <div className="es-sentence-no">{idx + 1}</div>
      <div className="es-sentence-body">
        <div className="es-sentence-head">
          <RoleBadge role={item.role} />
          <span>{item.note}</span>
        </div>
        <p>{item.text}</p>
      </div>
    </div>
  );
}

function QuestionDetail({ question }) {
  return (
    <section className="es-detail">
      <div className="es-detail-head">
        <div>
          <div className="es-eyebrow">
            {question.textType} · {question.type}
          </div>
          <h2>{question.id}번 구조독해</h2>
        </div>
        <div className="es-answer">정답 {question.answer}</div>
      </div>

      <div className="es-rule">{question.oneLine}</div>

      {question.inserted && (
        <div className="es-inserted">
          <div>주어진 문장</div>
          <p>{question.inserted}</p>
        </div>
      )}

      <div className="es-columns">
        <div className="es-section">
          <div className="es-section-title">문장별 역할표</div>
          <div className="es-sentences">
            {question.sentences.map((item, idx) => (
              <SentenceRow
                key={`${question.id}-${idx}`}
                item={item}
                idx={idx}
              />
            ))}
          </div>
        </div>

        <div className="es-section">
          <div className="es-section-title">유형별 풀이 순서</div>
          <ol className="es-steps">
            {question.steps.map((step, idx) => (
              <li key={`${question.id}-step-${idx}`}>
                <span>{idx + 1}</span>
                <p>{step}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

export default function EnglishStructure() {
  const [selectedId, setSelectedId] = useState(24);
  const selected =
    QUESTIONS.find((question) => question.id === selectedId) ?? QUESTIONS[0];

  return (
    <main className="english-structure-page">
      <style>{`
        .english-structure-page {
          min-height: 100vh;
          background: ${C.paper};
          color: ${C.ink};
          font-family: 'Noto Sans KR', sans-serif;
        }
        .es-hero {
          background: ${C.white};
          border-bottom: 1px solid ${C.line};
          padding: 42px 20px 30px;
        }
        .es-hero-inner {
          max-width: 1120px;
          margin: 0 auto;
        }
        .es-kicker {
          color: ${C.green};
          font-weight: 800;
          font-size: 0.78rem;
          margin-bottom: 10px;
        }
        .es-hero h1 {
          margin: 0;
          font-family: 'Noto Serif KR', serif;
          font-size: 2rem;
          line-height: 1.28;
          font-weight: 700;
          letter-spacing: 0;
        }
        .es-hero p {
          margin: 12px 0 0;
          color: ${C.muted};
          font-size: 0.95rem;
          line-height: 1.75;
          max-width: 680px;
          word-break: keep-all;
          overflow-wrap: break-word;
        }
        .es-content {
          max-width: 1120px;
          margin: 0 auto;
          padding: 22px 20px 48px;
        }
        .es-card-grid {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 18px;
        }
        .es-card {
          min-height: 132px;
          border: 1px solid;
          border-radius: 8px;
          padding: 14px;
          text-align: left;
          cursor: pointer;
          font-family: inherit;
          color: ${C.ink};
          transition: border-color 0.16s ease, background 0.16s ease, transform 0.16s ease;
        }
        .es-card:hover {
          transform: translateY(-1px);
        }
        .es-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          font-size: 0.78rem;
        }
        .es-card-top span {
          color: ${C.green};
          font-weight: 800;
        }
        .es-card-title {
          margin-top: 12px;
          color: ${C.ink};
          font-size: 0.9rem;
          line-height: 1.45;
          font-weight: 800;
          word-break: keep-all;
          overflow-wrap: break-word;
        }
        .es-card-meta {
          margin-top: 10px;
          color: ${C.muted};
          font-size: 0.78rem;
          line-height: 1.4;
        }
        .es-detail {
          background: ${C.white};
          border: 1px solid ${C.line};
          border-radius: 8px;
          padding: 22px;
        }
        .es-detail-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          border-bottom: 1px solid #eef2ee;
          padding-bottom: 16px;
        }
        .es-eyebrow {
          color: ${C.green};
          font-size: 0.78rem;
          font-weight: 800;
          margin-bottom: 6px;
        }
        .es-detail h2 {
          font-family: 'Noto Serif KR', serif;
          font-size: 1.35rem;
          line-height: 1.3;
          font-weight: 700;
          letter-spacing: 0;
          margin: 0;
        }
        .es-answer {
          flex: 0 0 auto;
          background: ${C.green};
          color: ${C.white};
          border-radius: 8px;
          padding: 8px 12px;
          font-weight: 800;
          font-size: 0.86rem;
        }
        .es-rule {
          margin-top: 16px;
          border-left: 4px solid ${C.green};
          background: ${C.greenSoft};
          padding: 12px 14px;
          color: ${C.ink};
          font-size: 0.93rem;
          font-weight: 800;
          line-height: 1.5;
          word-break: keep-all;
          overflow-wrap: break-word;
        }
        .es-inserted {
          margin-top: 16px;
          border: 1px solid ${C.line};
          border-radius: 8px;
          padding: 14px;
          background: #f8faf7;
        }
        .es-inserted div {
          color: ${C.green};
          font-size: 0.78rem;
          font-weight: 800;
          margin-bottom: 8px;
        }
        .es-inserted p {
          color: ${C.text};
          font-size: 0.92rem;
          line-height: 1.7;
        }
        .es-columns {
          display: grid;
          grid-template-columns: minmax(0, 1.35fr) minmax(300px, 0.65fr);
          gap: 20px;
          margin-top: 20px;
          align-items: start;
        }
        .es-section-title {
          color: ${C.ink};
          font-size: 0.92rem;
          font-weight: 900;
          margin-bottom: 12px;
        }
        .es-sentences {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .es-sentence-row {
          display: grid;
          grid-template-columns: 30px minmax(0, 1fr);
          gap: 10px;
          border-bottom: 1px solid #eef2ee;
          padding-bottom: 10px;
        }
        .es-sentence-no {
          width: 30px;
          height: 30px;
          border-radius: 50%;
          background: #f3f4f6;
          color: ${C.muted};
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.76rem;
          font-weight: 800;
        }
        .es-sentence-head {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px;
          margin-bottom: 6px;
        }
        .es-sentence-head span:last-child {
          color: ${C.muted};
          font-size: 0.8rem;
          font-weight: 700;
          line-height: 1.45;
        }
        .es-role {
          display: inline-flex;
          align-items: center;
          height: 24px;
          border: 1px solid;
          border-radius: 999px;
          padding: 0 9px;
          font-size: 0.74rem;
          font-weight: 900;
          white-space: nowrap;
        }
        .es-sentence-body p {
          color: ${C.text};
          font-size: 0.9rem;
          line-height: 1.72;
          word-break: keep-all;
          overflow-wrap: anywhere;
        }
        .es-steps {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin: 0;
          padding: 0;
        }
        .es-steps li {
          display: grid;
          grid-template-columns: 30px minmax(0, 1fr);
          gap: 10px;
          align-items: start;
          padding: 12px;
          border: 1px solid #eef2ee;
          border-radius: 8px;
          background: #fcfdfb;
        }
        .es-steps span {
          width: 30px;
          height: 30px;
          border-radius: 50%;
          background: ${C.green};
          color: ${C.white};
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.8rem;
          font-weight: 900;
        }
        .es-steps p {
          color: ${C.text};
          font-size: 0.9rem;
          line-height: 1.65;
          word-break: keep-all;
          overflow-wrap: break-word;
        }
        @media (max-width: 980px) {
          .es-card-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
          .es-columns {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 640px) {
          .es-hero {
            padding: 30px 16px 24px;
          }
          .es-hero h1 {
            font-size: 1.55rem;
          }
          .es-content {
            padding: 16px 12px 34px;
          }
          .es-card-grid {
            grid-template-columns: 1fr;
          }
          .es-detail {
            padding: 16px;
          }
          .es-detail-head {
            flex-direction: column;
          }
          .es-answer {
            width: 100%;
            text-align: center;
          }
          .es-sentence-row {
            grid-template-columns: 24px minmax(0, 1fr);
          }
          .es-sentence-no {
            width: 24px;
            height: 24px;
          }
        }
      `}</style>

      <section className="es-hero">
        <div className="es-hero-inner">
          <div className="es-kicker">2024학년도 6월 모의평가 영어</div>
          <h1>영어 구조독해</h1>
          <p>
            영어 지문을 논설문 또는 설명문으로 보고, 문장 역할을 먼저 잡은 뒤
            유형별 풀이 순서로 답을 확정하는 MVP입니다.
          </p>
        </div>
      </section>

      <section className="es-content">
        <div className="es-card-grid">
          {QUESTIONS.map((question) => (
            <QuestionCard
              key={question.id}
              question={question}
              selected={question.id === selected.id}
              onClick={() => setSelectedId(question.id)}
            />
          ))}
        </div>

        <QuestionDetail question={selected} />
      </section>
    </main>
  );
}
