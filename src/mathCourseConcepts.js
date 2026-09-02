import {
  CALCULUS_CONCEPTS_BY_UNIT,
  CALCULUS_UNITS,
  SEQUENCE_LIMIT_CONCEPTS,
} from "./mathCalculusConcepts.js";
import {
  GEOMETRY_CONCEPTS_BY_UNIT,
  MATH1_SEQUENCE_CONCEPTS,
  MATH2_CONCEPTS_BY_UNIT,
  PROBABILITY_STATISTICS_CONCEPTS_BY_UNIT,
} from "./mathRemainingCourseConcepts.js";

export const MATH1_EXPONENT_LOG_CONCEPTS = [
  {
    id: "math1-roots-exponents",
    order: 1,
    title: "거듭제곱근과 지수법칙",
    question: "지수가 정수에서 유리수까지 넓어져도 같은 계산법을 쓸 수 있을까?",
    core: "a의 n제곱근과 유리수 지수 a^(m/n)은 같은 뜻이며, 밑의 조건을 확인한 뒤 지수법칙을 적용합니다.",
    intuition:
      "제곱은 같은 수를 여러 번 곱하는 일이고, 거듭제곱근은 그 과정을 거꾸로 찾는 일입니다. a^(1/n)을 a의 n제곱근으로 정하면 자연수 지수에서 쓰던 곱셈 규칙을 유리수 지수에서도 그대로 이어갈 수 있습니다.",
    formulas: [
      String.raw`a^{\frac1n}=\sqrt[n]{a}`,
      String.raw`a^{\frac mn}=\sqrt[n]{a^m}`,
      String.raw`a^ra^s=a^{r+s},\qquad (a^r)^s=a^{rs}`,
    ],
    example: {
      prompt: String.raw`27^{\frac23}`,
      steps: [
        String.raw`27^{\frac23}=\left(27^{\frac13}\right)^2`,
        String.raw`27^{\frac13}=3\text{이므로 }3^2=9`,
      ],
      answer: String.raw`9`,
    },
    mistake:
      "짝수제곱근을 다룰 때 밑의 조건을 빼먹지 않습니다. 실수 범위에서 a^(1/2)은 a≥0일 때 정의되고, √(a²)=|a|입니다.",
    check: {
      prompt: String.raw`16^{\frac34}`,
      answer: String.raw`8`,
      reason: "16의 네제곱근은 2이고, 이를 세제곱하면 8입니다.",
    },
    practice: [
      {
        prompt: String.raw`32^{\frac25}`,
        answer: String.raw`4`,
        reason: "32의 다섯제곱근은 2이고, 이를 제곱하면 4입니다.",
      },
      {
        prompt: String.raw`\frac{2^{\frac52}}{2^{\frac12}}`,
        answer: String.raw`4`,
        reason: "같은 밑의 나눗셈에서는 지수를 빼므로 2^(5/2-1/2)=2²=4입니다.",
      },
    ],
  },
  {
    id: "math1-logarithm-properties",
    order: 2,
    title: "로그의 뜻과 성질",
    question: "몇 번 거듭제곱해야 원하는 수가 되는지를 어떻게 나타낼까?",
    core: "log_a b는 a를 몇 제곱해야 b가 되는지를 나타내며, 곱은 합으로, 나눗셈은 차로 바꿉니다.",
    intuition:
      "로그는 새로운 계산이 아니라 지수의 질문을 거꾸로 쓴 기호입니다. log₂8=3은 2³=8과 완전히 같은 말입니다. 밑과 진수의 조건을 먼저 확인하면 복잡한 곱과 나눗셈도 지수의 덧셈과 뺄셈으로 읽을 수 있습니다.",
    formulas: [
      String.raw`\log_a b=c\iff a^c=b\quad(a>0,\ a\ne1,\ b>0)`,
      String.raw`\log_a(MN)=\log_aM+\log_aN`,
      String.raw`\log_a\frac MN=\log_aM-\log_aN`,
      String.raw`\log_a b=\frac{\log_c b}{\log_c a}`,
    ],
    example: {
      prompt: String.raw`\log_2 40-\log_2 5`,
      steps: [
        String.raw`\log_2 40-\log_2 5=\log_2\frac{40}{5}`,
        String.raw`\log_2 8=3`,
      ],
      answer: String.raw`3`,
    },
    mistake:
      "log_a(M+N)을 log_aM+log_aN으로 나눌 수 없습니다. 로그의 성질은 곱과 나눗셈에만 적용됩니다.",
    check: {
      prompt: String.raw`\log_3 9+\log_3 3`,
      answer: String.raw`3`,
      reason: "각각 2와 1이므로 합은 3입니다. 또는 log₃27로 합쳐도 됩니다.",
    },
    practice: [
      {
        prompt: String.raw`\log_5 125`,
        answer: String.raw`3`,
        reason: "5³=125이므로 log₅125=3입니다.",
      },
      {
        prompt: String.raw`\log_2 6+\log_2\frac43-\log_2 2`,
        answer: String.raw`2`,
        reason: "진수를 곱하고 나누면 6×(4/3)÷2=4이므로 log₂4=2입니다.",
      },
    ],
  },
  {
    id: "math1-exponential-function",
    order: 3,
    title: "지수함수의 그래프",
    question: "일정한 비율로 커지거나 작아지는 변화는 어떤 그래프를 만들까?",
    core: "y=a^x는 항상 (0,1)을 지나며, a>1이면 증가하고 0<a<1이면 감소합니다.",
    intuition:
      "x가 1만큼 늘 때마다 함수값에 같은 수 a가 곱해집니다. 따라서 직선처럼 같은 양만큼 변하지 않고, 현재 크기에 비례해 점점 빠르게 커지거나 0에 가까워집니다. 그래프의 방향은 밑 a가 1보다 큰지 작은지가 결정합니다.",
    formulas: [
      String.raw`y=a^x\quad(a>0,\ a\ne1)`,
      String.raw`a>1:\ x_1<x_2\Rightarrow a^{x_1}<a^{x_2}`,
      String.raw`0<a<1:\ x_1<x_2\Rightarrow a^{x_1}>a^{x_2}`,
    ],
    example: {
      prompt: String.raw`2^{x+1}=16`,
      steps: [
        String.raw`16=2^4\text{로 밑을 같게 만듭니다.}`,
        String.raw`x+1=4`,
      ],
      answer: String.raw`x=3`,
    },
    mistake:
      "0<a<1일 때도 함수값은 양수입니다. 그래프가 내려간다는 말은 음수가 된다는 뜻이 아니라 x가 커질수록 0에 가까워진다는 뜻입니다.",
    check: {
      prompt: String.raw`\left(\frac13\right)^{x-1}=9`,
      answer: String.raw`x=-1`,
      reason: "9=(1/3)^(-2)이므로 x-1=-2, 따라서 x=-1입니다.",
    },
    practice: [
      {
        prompt: String.raw`4^x=\frac18`,
        answer: String.raw`x=-\frac32`,
        reason: "4^x=2^(2x), 1/8=2^(-3)이므로 2x=-3입니다.",
      },
      {
        prompt: String.raw`3^{2x-1}>27`,
        answer: String.raw`x>2`,
        reason: "밑 3은 1보다 크므로 지수를 그대로 비교해 2x-1>3을 풉니다.",
      },
    ],
  },
  {
    id: "math1-logarithmic-function",
    order: 4,
    title: "로그함수의 그래프",
    question: "지수함수를 거꾸로 뒤집으면 그래프와 부등호는 어떻게 달라질까?",
    core: "y=log_a x는 y=a^x의 역함수이며 (1,0)을 지나고 정의역은 x>0입니다.",
    intuition:
      "로그함수는 지수함수에서 입력과 출력을 맞바꾼 함수입니다. 두 그래프는 y=x에 대해 대칭이고, 지수함수의 (0,1)은 로그함수의 (1,0)이 됩니다. 밑이 1보다 작으면 감소하므로 부등식을 풀 때 방향을 뒤집습니다.",
    formulas: [
      String.raw`y=\log_a x\quad(a>0,\ a\ne1,\ x>0)`,
      String.raw`a^{\log_a x}=x,\qquad \log_a(a^x)=x`,
      String.raw`\begin{gathered}0<a<1\\\log_a M>\log_a N\iff M<N\end{gathered}`,
    ],
    example: {
      prompt: String.raw`\log_2(x-1)=3`,
      steps: [
        String.raw`x-1=2^3=8`,
        String.raw`x=9\text{이고 }x-1>0\text{을 만족합니다.}`,
      ],
      answer: String.raw`x=9`,
    },
    mistake:
      "로그방정식을 풀어 얻은 값은 반드시 진수 조건에 다시 넣어 확인합니다. 진수가 0 이하가 되는 해는 버려야 합니다.",
    check: {
      prompt: String.raw`\log_3(x+2)=2`,
      answer: String.raw`x=7`,
      reason: "x+2=3²=9이므로 x=7이고 진수 조건도 만족합니다.",
    },
    practice: [
      {
        prompt: String.raw`\log_{\frac12}x=-2`,
        answer: String.raw`x=4`,
        reason: "x=(1/2)^(-2)=4입니다.",
      },
      {
        prompt: String.raw`\log_{\frac13}(x-1)>-1`,
        answer: String.raw`1<x<4`,
        reason: "밑이 1보다 작아 감소하므로 x-1<(1/3)^(-1)=3이고, 진수 조건 x>1을 함께 적용합니다.",
      },
    ],
  },
];

export const MATH1_TRIGONOMETRY_CONCEPTS = [
  {
    id: "math1-general-angles-radians",
    order: 1,
    title: "일반각과 호도법",
    question: "각도를 360°보다 크게 돌리거나 음의 방향으로 돌리면 어떻게 나타낼까?",
    core: "호도법은 반지름과 같은 길이의 호가 만드는 중심각을 1라디안으로 정하며, 180°=π라디안입니다.",
    intuition:
      "도수법은 한 바퀴를 360으로 나누지만 호도법은 원의 반지름을 기준으로 각을 잽니다. 각 θ를 라디안으로 나타내면 호의 길이가 반지름의 θ배가 되어 원에서 길이와 넓이를 바로 계산할 수 있습니다.",
    formulas: [
      String.raw`180^\circ=\pi\text{ rad}`,
      String.raw`l=r\theta`,
      String.raw`S=\frac12r^2\theta`,
    ],
    example: {
      prompt: String.raw`150^\circ\text{를 호도법으로 나타내기}`,
      steps: [
        String.raw`150^\circ\times\frac{\pi}{180^\circ}`,
        String.raw`\frac{150}{180}\pi=\frac{5\pi}{6}`,
      ],
      answer: String.raw`\frac{5\pi}{6}`,
    },
    mistake:
      "호의 길이 l=rθ와 부채꼴의 넓이 S=(1/2)r²θ는 θ가 라디안일 때 쓰는 식입니다. 도 단위의 각을 그대로 넣지 않습니다.",
    check: {
      prompt: String.raw`\frac{7\pi}{6}\text{을 도수법으로 나타내기}`,
      answer: String.raw`210^\circ`,
      reason: "7π/6에 180°/π를 곱하면 210°입니다.",
    },
    practice: [
      {
        prompt: String.raw`-45^\circ\text{를 호도법으로 나타내기}`,
        answer: String.raw`-\frac{\pi}{4}`,
        reason: "-45°에 π/180°를 곱하면 -π/4입니다.",
      },
      {
        prompt: String.raw`\begin{gathered}r=3,\quad\theta=\frac{2\pi}{3}\\\text{호의 길이 }l\end{gathered}`,
        answer: String.raw`2\pi`,
        reason: "l=rθ에 r=3과 θ=2π/3을 넣으면 2π입니다.",
      },
    ],
  },
  {
    id: "math1-trigonometric-values",
    order: 2,
    title: "삼각함수의 뜻",
    question: "각이 예각이 아니어도 사인·코사인·탄젠트를 정할 수 있을까?",
    core: "단위원 위의 점 P(x,y)에 대해 cosθ=x, sinθ=y이고 tanθ=y/x입니다.",
    intuition:
      "반지름이 1인 원에서 양의 x축부터 θ만큼 회전한 점을 잡으면 그 점의 가로좌표가 코사인, 세로좌표가 사인입니다. 따라서 사분면에 따라 부호가 정해지고, 피타고라스 정리에서 sin²θ+cos²θ=1이 나옵니다.",
    formulas: [
      String.raw`P(\cos\theta,\sin\theta)`,
      String.raw`\tan\theta=\frac{\sin\theta}{\cos\theta}`,
      String.raw`\sin^2\theta+\cos^2\theta=1`,
    ],
    example: {
      prompt: String.raw`\begin{gathered}\theta=\frac{2\pi}{3}\\\sin\theta,\ \cos\theta,\ \tan\theta\end{gathered}`,
      steps: [
        String.raw`\frac{2\pi}{3}\text{은 제2사분면이고 기준각은 }\frac\pi3`,
        String.raw`\sin\theta=\frac{\sqrt3}{2},\quad\cos\theta=-\frac12`,
        String.raw`\tan\theta=\frac{\sin\theta}{\cos\theta}=-\sqrt3`,
      ],
      answer: String.raw`\left(\frac{\sqrt3}{2},-\frac12,-\sqrt3\right)`,
    },
    mistake:
      "기준각의 값만 외우고 부호를 빼먹지 않습니다. 먼저 각이 어느 사분면에 있는지 표시한 뒤 사인과 코사인의 부호를 정합니다.",
    check: {
      prompt: String.raw`\begin{gathered}P\left(-\frac35,\frac45\right)\\\sin\theta+\cos\theta\end{gathered}`,
      answer: String.raw`\frac15`,
      reason: "단위원 위 점의 y좌표가 사인, x좌표가 코사인이므로 4/5-3/5=1/5입니다.",
    },
    practice: [
      {
        prompt: String.raw`\begin{gathered}\cos\theta=-\frac45,\quad\theta\text{는 제2사분면}\\\sin\theta,\ \tan\theta\end{gathered}`,
        answer: String.raw`\sin\theta=\frac35,\quad\tan\theta=-\frac34`,
        reason: "제2사분면에서 사인은 양수이므로 sinθ=3/5이고, 이를 cosθ로 나누면 tanθ=-3/4입니다.",
      },
      {
        prompt: String.raw`\begin{gathered}\sin\theta=-\frac12,\quad\theta\text{는 제4사분면}\\\cos\theta\end{gathered}`,
        answer: String.raw`\frac{\sqrt3}{2}`,
        reason: "제4사분면에서 코사인은 양수이고 sin²θ+cos²θ=1이므로 cosθ=√3/2입니다.",
      },
    ],
  },
  {
    id: "math1-trigonometric-graphs",
    order: 3,
    title: "삼각함수의 그래프",
    question: "사인·코사인·탄젠트는 어떤 간격으로 같은 모양을 반복할까?",
    core: "sin x와 cos x의 주기는 2π, tan x의 주기는 π이며 계수와 평행이동이 그래프의 폭과 위치를 바꿉니다.",
    intuition:
      "원을 한 바퀴 돌면 가로좌표와 세로좌표가 처음 값으로 돌아오므로 사인과 코사인 그래프는 2π마다 반복됩니다. 탄젠트는 사인과 코사인의 비라서 반 바퀴 뒤에도 같은 값이 되어 π마다 반복됩니다.",
    formulas: [
      String.raw`\begin{gathered}\sin(x+2\pi)=\sin x\\\cos(x+2\pi)=\cos x\end{gathered}`,
      String.raw`\tan(x+\pi)=\tan x`,
      String.raw`\begin{gathered}-1\le\sin x\le1\\-1\le\cos x\le1\end{gathered}`,
    ],
    example: {
      prompt: String.raw`\begin{gathered}y=2\sin x-1\\\text{최댓값과 최솟값}\end{gathered}`,
      steps: [
        String.raw`-1\le\sin x\le1`,
        String.raw`-2\le2\sin x\le2`,
        String.raw`-3\le2\sin x-1\le1`,
      ],
      answer: String.raw`\text{최댓값 }1,\quad\text{최솟값 }-3`,
    },
    mistake:
      "y=sin bx의 주기를 2πb로 계산하지 않습니다. x가 2π/b만큼 변할 때 bx가 2π 변하므로 주기는 2π/|b|입니다.",
    check: {
      prompt: String.raw`y=\cos3x\text{의 주기}`,
      answer: String.raw`\frac{2\pi}{3}`,
      reason: "cos bx의 주기는 2π/|b|이므로 b=3일 때 2π/3입니다.",
    },
    practice: [
      {
        prompt: String.raw`y=\tan2x\text{의 주기}`,
        answer: String.raw`\frac\pi2`,
        reason: "tan bx의 주기는 π/|b|이므로 b=2일 때 π/2입니다.",
      },
      {
        prompt: String.raw`y=-3\cos x+2\text{의 최댓값과 최솟값}`,
        answer: String.raw`\text{최댓값 }5,\quad\text{최솟값 }-1`,
        reason: "-1≤cos x≤1에 -3을 곱하면 -3≤-3cos x≤3이고, 2를 더하면 -1부터 5까지입니다.",
      },
    ],
  },
  {
    id: "math1-sine-cosine-laws",
    order: 4,
    title: "사인법칙과 코사인법칙",
    question: "삼각형에서 각과 변의 길이를 어떻게 서로 바꿔 계산할까?",
    core: "마주 보는 변과 각의 쌍은 사인법칙으로, 두 변과 그 끼인각은 코사인법칙으로 연결합니다.",
    intuition:
      "사인법칙은 큰 각의 맞은편에 긴 변이 놓인다는 관계를 원의 반지름까지 확장한 식입니다. 코사인법칙은 피타고라스 정리에 각의 효과를 더한 식으로, 끼인각이 90°이면 cos90°=0이 되어 피타고라스 정리와 같아집니다.",
    formulas: [
      String.raw`\frac{a}{\sin A}=\frac{b}{\sin B}=\frac{c}{\sin C}=2R`,
      String.raw`a^2=b^2+c^2-2bc\cos A`,
      String.raw`S=\frac12bc\sin A`,
    ],
    example: {
      prompt: String.raw`\begin{gathered}b=3,\quad c=5,\quad A=60^\circ\\a\text{의 값}\end{gathered}`,
      steps: [
        String.raw`a^2=3^2+5^2-2\cdot3\cdot5\cos60^\circ`,
        String.raw`a^2=9+25-15=19`,
      ],
      answer: String.raw`\sqrt{19}`,
    },
    mistake:
      "코사인법칙에서 cos A 앞의 항은 A를 끼고 있는 두 변 b와 c의 곱입니다. 구하려는 변과 마주 보는 각의 짝을 먼저 표시합니다.",
    check: {
      prompt: String.raw`b=c=4,\quad A=120^\circ\text{일 때 }a`,
      answer: String.raw`4\sqrt3`,
      reason: "a²=16+16-32cos120°=32+16=48이므로 a=4√3입니다.",
    },
    practice: [
      {
        prompt: String.raw`a=6,\quad A=30^\circ\text{일 때 외접원의 반지름 }R`,
        answer: String.raw`6`,
        reason: "사인법칙에서 a/sinA=2R이므로 6/(1/2)=12=2R, 따라서 R=6입니다.",
      },
      {
        prompt: String.raw`b=5,\quad c=7,\quad A=60^\circ\text{일 때 삼각형의 넓이}`,
        answer: String.raw`\frac{35\sqrt3}{4}`,
        reason: "S=(1/2)bc sinA에 값을 넣으면 (1/2)×5×7×(√3/2)=35√3/4입니다.",
      },
    ],
  },
];

export const MATH1_UNITS = [
  {
    id: "math1-exponents-logs",
    label: "지수함수와 로그함수",
    description: "거듭제곱과 로그의 뜻을 익히고 두 함수의 그래프를 연결합니다.",
    status: "available",
    conceptCount: 4,
    availableConceptCount: 4,
    kicker: "EXPONENT & LOG",
  },
  {
    id: "math1-trigonometry",
    label: "삼각함수",
    description: "각의 크기와 주기적인 변화를 함수로 읽습니다.",
    status: "available",
    conceptCount: 4,
    availableConceptCount: 4,
    kicker: "TRIGONOMETRY",
  },
  {
    id: "math1-sequences",
    label: "수열",
    description: "수의 규칙을 일반항과 합으로 표현합니다.",
    status: "available",
    conceptCount: 4,
    availableConceptCount: 4,
    kicker: "SEQUENCES",
  },
];

const availableUnit = (id, label, description, kicker) => ({
  id,
  label,
  description,
  kicker,
  status: "available",
  conceptCount: 4,
  availableConceptCount: 4,
});

export const MATH2_UNITS = [
  availableUnit("math2-limits-continuity", "함수의 극한과 연속", "함수값이 가까워지는 과정과 그래프가 이어지는 조건을 익힙니다.", "LIMIT & CONTINUITY"),
  availableUnit("math2-differentiation", "미분", "다항함수의 순간변화율로 접선과 그래프의 모양을 읽습니다.", "DIFFERENTIATION"),
  availableUnit("math2-integration", "적분", "변화율을 거꾸로 쌓아 넓이와 이동 거리를 계산합니다.", "INTEGRATION"),
];

export const PROBABILITY_STATISTICS_UNITS = [
  availableUnit("probability-counting", "경우의 수", "순서를 구별하는 선택과 구별하지 않는 선택을 나누어 셉니다.", "COUNTING"),
  availableUnit("probability", "확률", "사건의 겹침과 조건, 독립시행의 확률을 연결합니다.", "PROBABILITY"),
  availableUnit("statistics", "통계", "확률분포에서 표본을 이용한 모평균 추정까지 익힙니다.", "STATISTICS"),
];

export const GEOMETRY_UNITS = [
  availableUnit("geometry-conics", "이차곡선", "거리 조건으로 포물선·타원·쌍곡선과 접선을 이해합니다.", "CONIC SECTIONS"),
  availableUnit("geometry-vectors", "평면벡터", "크기와 방향을 성분·내적·벡터방정식으로 표현합니다.", "PLANE VECTORS"),
  availableUnit("geometry-space", "공간도형과 공간좌표", "공간의 위치 관계와 정사영, 거리와 각을 계산합니다.", "SPACE GEOMETRY"),
];

export const MATH_COURSES = [
  {
    id: "math1",
    label: "수학Ⅰ",
    role: "공통",
    description: "지수·로그, 삼각함수, 수열",
    status: "available",
    availableConceptCount: 12,
    heroTitle: "수학Ⅰ을 식의 뜻부터 연결합니다.",
    heroCopy: "지수와 로그의 관계부터 시작해 삼각함수와 수열까지 공통과목의 계산 원리를 순서대로 익힙니다.",
    heroMarks: ["2¹", "2²", "2³", "2⁴", "2ⁿ"],
  },
  {
    id: "math2",
    label: "수학Ⅱ",
    role: "공통",
    description: "함수의 극한과 연속, 미분, 적분",
    status: "available",
    availableConceptCount: 12,
    heroTitle: "수학Ⅱ를 변화의 언어로 익힙니다.",
    heroCopy: "함수의 극한과 연속에서 출발해 다항함수의 미분과 적분을 그래프·넓이·운동 문제까지 연결합니다.",
    heroMarks: ["x", "x+h", "f′", "∫", "F"],
  },
  {
    id: "probability-statistics",
    label: "확률과 통계",
    role: "선택",
    description: "경우의 수, 확률, 통계",
    status: "available",
    availableConceptCount: 12,
    heroTitle: "확률과 통계를 세는 원리부터 익힙니다.",
    heroCopy: "경우의 수, 조건부확률, 확률분포와 통계적 추정을 한 흐름으로 연결해 식을 세우는 기준을 만듭니다.",
    heroMarks: ["n!", "nCr", "P(A)", "E(X)", "N"],
  },
  {
    id: "calculus",
    label: "미적분",
    role: "선택",
    description: "수열의 극한, 미분법, 적분법",
    status: "available",
    availableConceptCount: 24,
    heroTitle: "미적분을 공식보다 흐름으로 공부합니다.",
    heroCopy: "수열의 극한, 여러 함수의 미분과 적분을 순서대로 익히고 이해한 개념을 평가원 기출로 연결합니다.",
    heroMarks: ["a₁", "a₂", "a₃", "a₄", "aₙ"],
  },
  {
    id: "geometry",
    label: "기하",
    role: "선택",
    description: "이차곡선, 평면벡터, 공간도형",
    status: "available",
    availableConceptCount: 12,
    heroTitle: "기하를 그림과 좌표로 함께 봅니다.",
    heroCopy: "이차곡선의 거리 조건, 평면벡터의 방향, 공간도형의 거리와 각을 식이 생기는 이유부터 익힙니다.",
    heroMarks: ["F", "→", "·", "(x,y)", "(x,y,z)"],
  },
];

export const MATH_UNITS_BY_COURSE = {
  math1: MATH1_UNITS,
  math2: MATH2_UNITS,
  "probability-statistics": PROBABILITY_STATISTICS_UNITS,
  calculus: CALCULUS_UNITS,
  geometry: GEOMETRY_UNITS,
};

export const MATH_CONCEPTS_BY_UNIT = {
  "math1-exponents-logs": MATH1_EXPONENT_LOG_CONCEPTS,
  "math1-trigonometry": MATH1_TRIGONOMETRY_CONCEPTS,
  "math1-sequences": MATH1_SEQUENCE_CONCEPTS,
  ...MATH2_CONCEPTS_BY_UNIT,
  ...PROBABILITY_STATISTICS_CONCEPTS_BY_UNIT,
  ...CALCULUS_CONCEPTS_BY_UNIT,
  ...GEOMETRY_CONCEPTS_BY_UNIT,
};

function flattenCourseConcepts(courseId) {
  return (MATH_UNITS_BY_COURSE[courseId] ?? []).flatMap((unit) =>
    (MATH_CONCEPTS_BY_UNIT[unit.id] ?? []).map((concept) => ({
      ...concept,
      courseId,
      courseLabel: MATH_COURSES.find((course) => course.id === courseId)?.label ?? "수학",
      unitId: unit.id,
      unitLabel: unit.label,
    })),
  );
}

export const MATH_PROGRESS_CONCEPTS = [
  ...flattenCourseConcepts("math1"),
  ...flattenCourseConcepts("math2"),
  ...flattenCourseConcepts("probability-statistics"),
  ...flattenCourseConcepts("calculus"),
  ...flattenCourseConcepts("geometry"),
];

export function getMathCourseConcepts(courseId) {
  return flattenCourseConcepts(courseId);
}

export function getMathConceptContext(conceptId, unitId, courseId) {
  for (const course of MATH_COURSES) {
    for (const unit of MATH_UNITS_BY_COURSE[course.id] ?? []) {
      const concepts = MATH_CONCEPTS_BY_UNIT[unit.id] ?? [];
      const concept = concepts.find((candidate) => candidate.id === conceptId);
      if (concept) return { course, unit, concepts, concept };
    }
  }

  const requestedCourse = MATH_COURSES.find(
    (course) => course.id === courseId && course.status === "available",
  );
  const unitCourse = MATH_COURSES.find((course) =>
    (MATH_UNITS_BY_COURSE[course.id] ?? []).some(
      (unit) => unit.id === unitId && unit.status === "available",
    ),
  );
  const course = requestedCourse ?? unitCourse ?? MATH_COURSES.find((item) => item.id === "calculus");
  const units = MATH_UNITS_BY_COURSE[course.id] ?? [];
  const requestedUnit = units.find(
    (unit) => unit.id === unitId && unit.status === "available",
  );
  const unit = requestedUnit ?? units.find((item) => item.status === "available");
  const concepts = MATH_CONCEPTS_BY_UNIT[unit?.id] ?? [];
  return {
    course,
    unit,
    concepts,
    concept: concepts[0] ?? SEQUENCE_LIMIT_CONCEPTS[0],
  };
}
