export const CALCULUS_UNITS = [
  {
    id: "sequence-limits",
    label: "수열의 극한",
    description: "무한히 이어지는 수가 어디로 가까워지는지 읽습니다.",
    status: "available",
    conceptCount: 6,
    availableConceptCount: 6,
    kicker: "SEQUENCE LIMIT",
  },
  {
    id: "differentiation",
    label: "미분법",
    description: "여러 함수의 변화율을 구하고 그래프에 적용합니다.",
    status: "available",
    conceptCount: 10,
    availableConceptCount: 10,
    kicker: "DIFFERENTIATION",
  },
  {
    id: "integration",
    label: "적분법",
    description: "변화량을 누적해 넓이·부피·이동거리를 구합니다.",
    status: "available",
    conceptCount: 8,
    availableConceptCount: 8,
    kicker: "INTEGRATION",
  },
];

export const SEQUENCE_LIMIT_CONCEPTS = [
  {
    id: "convergence-divergence",
    order: 1,
    title: "수열의 수렴과 발산",
    question: "항이 끝없이 이어질 때, 어디로 가는지 어떻게 말할까?",
    core: "n이 한없이 커질 때 a_n이 일정한 값 α에 가까워지면 수열은 α에 수렴합니다.",
    intuition:
      "수열의 항을 수직선 위의 점이라고 생각해 보세요. 항들이 움직이면서 한 점에 계속 가까워지면 수렴이고, 끝없이 커지거나 두 값 사이를 오가면 발산입니다.",
    formulas: [String.raw`\lim_{n\to\infty}a_n=\alpha`],
    example: {
      prompt: String.raw`\lim_{n\to\infty}\left(2+\frac1n\right)`,
      steps: [
        String.raw`n\text{이 커질수록 }\frac1n\text{은 }0\text{에 가까워집니다.}`,
        String.raw`2+\frac1n\text{은 }2\text{에 가까워집니다.}`,
      ],
      answer: String.raw`2`,
    },
    mistake:
      "∞를 실제 숫자처럼 식에 대입하지 않습니다. n이 커질 때 각 항이 어떻게 변하는지를 비교해야 합니다.",
    check: {
      prompt: String.raw`\lim_{n\to\infty}\left(5-\frac2n\right)`,
      answer: String.raw`5`,
      reason: "2/n이 0으로 가까워지므로 5-2/n은 5에 수렴합니다.",
    },
    practice: [
      {
        prompt: String.raw`a_n=(-1)^n\text{일 때 수렴할까?}`,
        answer: String.raw`\text{발산}`,
        reason: "항이 1과 -1을 번갈아 가지므로 한 값에 가까워지지 않습니다.",
      },
      {
        prompt: String.raw`\lim_{n\to\infty}\frac{(-1)^n}{n}`,
        answer: String.raw`0`,
        reason: "부호는 바뀌지만 절댓값 1/n이 0으로 가므로 수열도 0에 수렴합니다.",
      },
    ],
  },
  {
    id: "limit-laws",
    order: 2,
    title: "극한값의 계산",
    question: "여러 수열이 더해지고 곱해지면 극한도 그대로 계산할 수 있을까?",
    core: "각 수열이 수렴하면 합·차·곱의 극한은 극한값끼리 계산할 수 있습니다.",
    intuition:
      "a_n이 α 가까이, b_n이 β 가까이 모이면 두 항을 더하거나 곱한 값도 각각 α+β, αβ 가까이 모입니다. 나눗셈은 분모의 극한값이 0이 아닐 때만 바로 적용합니다.",
    formulas: [
      String.raw`\lim(a_n\pm b_n)=\alpha\pm\beta`,
      String.raw`\lim(a_nb_n)=\alpha\beta`,
      String.raw`\lim\frac{a_n}{b_n}=\frac{\alpha}{\beta}\quad(\beta\ne0)`,
    ],
    example: {
      prompt: String.raw`\lim_{n\to\infty}\left(\sqrt{n^2+3n}-n\right)`,
      steps: [
        "그대로 보면 ∞-∞ 꼴이므로 켤레식을 곱합니다.",
        String.raw`\frac{3n}{\sqrt{n^2+3n}+n}=\frac3{\sqrt{1+\frac3n}+1}\to\frac32`,
      ],
      answer: String.raw`\frac32`,
    },
    mistake:
      "∞-∞, ∞/∞처럼 모양만 보고 답을 정하지 않습니다. 식을 변형해 실제로 남는 값을 확인합니다.",
    check: {
      prompt: String.raw`\lim_{n\to\infty}\frac{3n^2+1}{n^2-4}`,
      answer: String.raw`3`,
      reason: "분자와 분모를 n²으로 나누면 최고차항의 계수비만 남습니다.",
    },
    practice: [
      {
        prompt: String.raw`\lim_{n\to\infty}\left(\sqrt{n^2+2n}-n\right)`,
        answer: String.raw`1`,
        reason: "켤레식을 곱하면 2/{√(1+2/n)+1}이 되어 1로 수렴합니다.",
      },
      {
        prompt: String.raw`\lim_{n\to\infty}\frac{2n^2-1}{n^2+3n}`,
        answer: String.raw`2`,
        reason: "분자와 분모를 n²으로 나누면 낮은 차수의 항은 모두 0으로 갑니다.",
      },
    ],
  },
  {
    id: "geometric-sequence-limit",
    order: 3,
    title: "등비수열의 극한",
    question: "같은 수를 계속 곱할 때 항은 0으로 갈까, 커질까?",
    core: "rⁿ은 |r|<1이면 0에 수렴하고, 그 밖의 경우에는 r의 값에 따라 수렴하거나 발산합니다.",
    intuition:
      "절댓값이 1보다 작은 수를 반복해서 곱하면 크기가 계속 줄어듭니다. 절댓값이 1보다 크면 크기가 커지고, 음수이면 부호까지 번갈아 나타날 수 있습니다.",
    formulas: [
      String.raw`|r|<1\Rightarrow\lim_{n\to\infty}r^n=0`,
      String.raw`r=1\Rightarrow r^n=1`,
    ],
    example: {
      prompt: String.raw`\lim_{n\to\infty}\left(-\frac23\right)^n`,
      steps: [
        String.raw`\left|-\frac23\right|<1` ,
        "부호는 번갈아 바뀌지만 항의 크기가 0에 가까워집니다.",
      ],
      answer: String.raw`0`,
    },
    mistake:
      "r<1만 확인하면 안 됩니다. r=-2처럼 1보다 작아도 |r|은 1보다 커서 수렴하지 않습니다.",
    check: {
      prompt: String.raw`\lim_{n\to\infty}\left\{3\left(\frac12\right)^n+2\right\}`,
      answer: String.raw`2`,
      reason: "(1/2)ⁿ이 0으로 수렴하므로 3(1/2)ⁿ도 0으로 수렴합니다.",
    },
    practice: [
      {
        prompt: String.raw`\lim_{n\to\infty}\left(-\frac34\right)^n`,
        answer: String.raw`0`,
        reason: "공비의 절댓값 3/4이 1보다 작으므로 항의 크기가 0으로 갑니다.",
      },
      {
        prompt: String.raw`\lim_{n\to\infty}\frac{2^n}{3^n+1}`,
        answer: String.raw`0`,
        reason: "분자와 분모를 3ⁿ으로 나누면 (2/3)ⁿ과 (1/3)ⁿ이 모두 0으로 갑니다.",
      },
    ],
  },
  {
    id: "infinite-series",
    order: 4,
    title: "무한급수의 뜻",
    question: "항을 끝없이 더한다는 말을 수학적으로 어떻게 정할까?",
    core: "무한급수의 합은 앞에서부터 n개를 더한 부분합 S_n의 극한입니다.",
    intuition:
      "끝없이 많은 항을 한 번에 더할 수는 없습니다. 먼저 1개, 2개, 3개씩 더한 부분합을 만들고 그 부분합 수열이 한 값에 가까워지는지 확인합니다.",
    formulas: [
      String.raw`S_n=\sum_{k=1}^{n}a_k`,
      String.raw`\sum_{n=1}^{\infty}a_n=\lim_{n\to\infty}S_n`,
    ],
    example: {
      prompt: String.raw`\sum_{n=1}^{\infty}\frac1{n(n+1)}`,
      steps: [
        String.raw`\frac1{n(n+1)}=\frac1n-\frac1{n+1}`,
        String.raw`S_n=1-\frac1{n+1}\to1`,
      ],
      answer: String.raw`1`,
    },
    mistake:
      "a_n→0은 급수가 수렴하기 위한 필요조건일 뿐입니다. 항이 0으로 가더라도 급수는 발산할 수 있습니다.",
    check: {
      prompt: String.raw`1-1+1-1+\cdots\text{ 는 수렴할까?}`,
      answer: String.raw`\text{발산}`,
      reason: "부분합이 1, 0, 1, 0을 번갈아 가지므로 한 값에 수렴하지 않습니다.",
    },
    practice: [
      {
        prompt: String.raw`\sum_{n=1}^{\infty}\frac{n+1}{2n+1}\text{ 은 수렴할까?}`,
        answer: String.raw`\text{발산}`,
        reason: "일반항이 1/2로 가서 0이 아니므로 급수는 수렴할 수 없습니다.",
      },
      {
        prompt: String.raw`\sum_{n=1}^{\infty}\frac1{(n+1)(n+2)}`,
        answer: String.raw`\frac12`,
        reason: "일반항을 1/(n+1)-1/(n+2)로 나누면 중간 항이 지워지고 1/2만 남습니다.",
      },
    ],
  },
  {
    id: "geometric-series",
    order: 5,
    title: "등비급수",
    question: "일정한 비율로 작아지는 수를 끝없이 더하면 얼마가 될까?",
    core: "첫째항이 a이고 공비가 r인 등비급수는 |r|<1일 때 a/(1-r)로 수렴합니다.",
    intuition:
      "매번 남은 양의 일정 비율만큼 더한다고 생각하면 전체 합이 어떤 경계값에 가까워집니다. 공비의 절댓값이 1 이상이면 항 자체가 0으로 가지 않아 수렴할 수 없습니다.",
    formulas: [
      String.raw`\begin{gathered}a+ar+ar^2+\cdots\\=\frac{a}{1-r}\quad(|r|<1)\end{gathered}`,
    ],
    example: {
      prompt: String.raw`3+\frac32+\frac34+\frac38+\cdots`,
      steps: [
        String.raw`a=3,\quad r=\frac12`,
        String.raw`\frac{a}{1-r}=\frac3{1-\frac12}=6`,
      ],
      answer: String.raw`6`,
    },
    mistake:
      "공식부터 대입하지 말고 첫째항과 공비를 먼저 표시합니다. 특히 음의 공비와 시작 지수를 자주 잘못 읽습니다.",
    check: {
      prompt: String.raw`2-\frac23+\frac29-\frac2{27}+\cdots`,
      answer: String.raw`\frac32`,
      reason: "첫째항은 2, 공비는 -1/3이므로 2/{1-(-1/3)}=3/2입니다.",
    },
    practice: [
      {
        prompt: String.raw`1+\frac13+\frac1{9}+\frac1{27}+\cdots`,
        answer: String.raw`\frac32`,
        reason: "첫째항 1과 공비 1/3을 합 공식에 넣으면 1/(1-1/3)=3/2입니다.",
      },
      {
        prompt: String.raw`5-\frac52+\frac54-\frac58+\cdots`,
        answer: String.raw`\frac{10}3`,
        reason: "첫째항은 5, 공비는 -1/2이므로 합은 5/{1-(-1/2)}=10/3입니다.",
      },
    ],
  },
  {
    id: "geometric-series-applications",
    order: 6,
    title: "등비급수의 활용",
    question: "순환소수와 끝없이 반복되는 도형을 하나의 합으로 바꿀 수 있을까?",
    core: "반복되는 양을 첫째항과 공비로 표현하면 순환소수·길이·넓이를 등비급수로 계산할 수 있습니다.",
    intuition:
      "문제의 그림이나 소수를 바로 계산하려 하지 말고, 첫 번째 양과 다음 양이 몇 배인지 찾습니다. 닮은 도형의 길이비가 k라면 넓이비는 k²라는 점도 함께 확인합니다.",
    formulas: [
      String.raw`\begin{gathered}0.\overline{27}\\=\frac{27}{100}+\frac{27}{100^2}\\+\cdots\end{gathered}`,
      String.raw`\begin{gathered}\text{길이비}=k\\\text{넓이비}=k^2\end{gathered}`,
    ],
    example: {
      prompt: String.raw`\begin{gathered}0.\overline{27}\\\text{기약분수로 나타내기}\end{gathered}`,
      steps: [
        String.raw`a=\frac{27}{100},\quad r=\frac1{100}`,
        String.raw`\frac{\frac{27}{100}}{1-\frac1{100}}=\frac{27}{99}=\frac3{11}`,
      ],
      answer: String.raw`\frac3{11}`,
    },
    mistake:
      "도형의 길이가 1/2배가 될 때 넓이도 1/2배라고 생각하지 않습니다. 넓이는 (1/2)²=1/4배입니다.",
    check: {
      prompt: String.raw`\begin{gathered}0.\overline{36}\\\text{기약분수로 나타내기}\end{gathered}`,
      answer: String.raw`\frac4{11}`,
      reason: "36/100을 첫째항, 1/100을 공비로 두면 36/99=4/11입니다.",
    },
    practice: [
      {
        prompt: String.raw`\begin{gathered}0.\overline{45}\\\text{기약분수로 나타내기}\end{gathered}`,
        answer: String.raw`\frac5{11}`,
        reason: "45/100을 첫째항으로 하는 등비급수의 합은 45/99=5/11입니다.",
      },
      {
        prompt: String.raw`8+2+\frac12+\frac18+\cdots`,
        answer: String.raw`\frac{32}3`,
        reason: "첫째항 8, 공비 1/4인 등비급수이므로 합은 8/(1-1/4)=32/3입니다.",
      },
    ],
  },
];

export const DIFFERENTIATION_CONCEPTS = [
  {
    id: "exponential-log-derivatives",
    order: 1,
    title: "지수함수와 로그함수의 미분",
    question: "밑이 e가 아닐 때는 왜 자연로그 값이 한 번 더 곱해질까?",
    core: "지수함수는 함수의 모양을 유지하며 미분되고, 로그함수는 x의 역수 꼴로 미분됩니다.",
    intuition:
      "eˣ은 어느 점에서나 함수값과 순간변화율이 같습니다. 밑이 a인 지수함수를 자연상수 e를 밑으로 바꾸어 생각하면 자연로그 값이 한 번 더 곱해집니다. 로그함수는 지수함수의 역함수이므로 두 함수의 기울기도 서로 뒤집힌 관계를 가집니다.",
    formulas: [
      String.raw`\frac{d}{dx}e^x=e^x`,
      String.raw`\begin{gathered}\frac{d}{dx}a^x=a^x\ln a\\a>0,\quad a\ne1\end{gathered}`,
      String.raw`\frac{d}{dx}\ln x=\frac1x`,
      String.raw`\frac{d}{dx}\log_a x=\frac1{x\ln a}`,
    ],
    example: {
      prompt: String.raw`\begin{gathered}f(x)=2^x+\ln x\\f'(1)\end{gathered}`,
      steps: [
        String.raw`f'(x)=2^x\ln2+\frac1x`,
        String.raw`f'(1)=2\ln2+1`,
      ],
      answer: String.raw`2\ln2+1`,
    },
    mistake:
      "지수함수에 거듭제곱함수의 미분 공식을 적용하지 않습니다. x²과 2ˣ은 서로 다른 종류의 함수입니다.",
    check: {
      prompt: String.raw`f(x)=\log_3x\text{ 일 때 }f'(3)`,
      answer: String.raw`\frac1{3\ln3}`,
      reason: "밑이 있는 로그함수의 도함수 공식에 x=3과 a=3을 대입합니다.",
    },
    practice: [
      {
        prompt: String.raw`f(x)=e^x+\ln x\text{ 일 때 }f'(1)`,
        answer: String.raw`e+1`,
        reason: "eˣ의 도함수는 eˣ이고 ln x의 도함수는 1/x이므로 x=1에서 e+1입니다.",
      },
      {
        prompt: String.raw`f(x)=2^x\text{ 일 때 }f'(0)`,
        answer: String.raw`\ln2`,
        reason: "2ˣ의 도함수는 2ˣln 2이므로 x=0에서 값은 ln 2입니다.",
      },
    ],
  },
  {
    id: "trigonometric-derivatives",
    order: 2,
    title: "삼각함수의 미분",
    question: "sin과 cos는 미분할 때 왜 서로 바뀌고 부호가 달라질까?",
    core: "sin은 cos로, cos는 -sin으로 미분되며 tan의 도함수는 cos²의 역수입니다.",
    intuition:
      "단위원 위의 점이 움직일 때 sin은 세로 좌표, cos는 가로 좌표의 변화를 나타냅니다. 두 변화는 서로 이어져 있지만 cos는 감소하는 구간을 지나므로 미분할 때 음의 부호가 붙습니다. 이 공식들은 각도를 라디안으로 나타낼 때 그대로 성립합니다.",
    formulas: [
      String.raw`\frac{d}{dx}\sin x=\cos x`,
      String.raw`\frac{d}{dx}\cos x=-\sin x`,
      String.raw`\frac{d}{dx}\tan x=\frac1{\cos^2x}`,
    ],
    example: {
      prompt: String.raw`\begin{gathered}f(x)=2\sin x-\cos x\\f'\left(\frac\pi2\right)\end{gathered}`,
      steps: [
        String.raw`f'(x)=2\cos x+\sin x`,
        String.raw`f'\left(\frac\pi2\right)=2\cdot0+1=1`,
      ],
      answer: String.raw`1`,
    },
    mistake:
      "cos를 미분할 때 음의 부호를 빠뜨리지 않습니다. 삼각함수의 미분에서는 각도를 라디안으로 나타내며, 탄젠트가 정의되지 않는 각에서는 미분할 수 없습니다.",
    check: {
      prompt: String.raw`f(x)=\sin x+\tan x\text{ 일 때 }f'(0)`,
      answer: String.raw`2`,
      reason: "sin의 도함수와 tan의 도함수에 x=0을 대입하면 각각 1이 됩니다.",
    },
    practice: [
      {
        prompt: String.raw`f(x)=3\sin x\text{ 일 때 }f'\left(\frac\pi3\right)`,
        answer: String.raw`\frac32`,
        reason: "3sin x의 도함수는 3cos x이고 cos(π/3)=1/2이므로 값은 3/2입니다.",
      },
      {
        prompt: String.raw`f(x)=\tan x\text{ 일 때 }f'\left(\frac\pi4\right)`,
        answer: String.raw`2`,
        reason: "tan의 도함수 1/cos²x에 x=π/4를 대입하면 1/(1/2)=2입니다.",
      },
    ],
  },
  {
    id: "product-quotient-derivatives",
    order: 3,
    title: "함수의 곱과 몫의 미분",
    question: "두 함수가 함께 변할 때는 어느 쪽을 먼저 미분해야 할까?",
    core: "곱은 한쪽씩 번갈아 미분해 더하고, 몫은 분모를 제곱한 뒤 두 곱의 차를 분자로 둡니다.",
    intuition:
      "가로와 세로가 동시에 변하는 직사각형의 넓이를 생각하면, 넓이의 변화는 가로가 변해서 생긴 부분과 세로가 변해서 생긴 부분을 더한 값입니다. 이것이 곱의 미분입니다. 몫은 분모의 변화까지 반영해야 하므로 단순히 위아래를 따로 미분해 나눌 수 없습니다.",
    formulas: [
      String.raw`(uv)'=u'v+uv'`,
      String.raw`\left(\frac uv\right)'=\frac{u'v-uv'}{v^2}\quad(v\ne0)`,
    ],
    example: {
      prompt: String.raw`\begin{gathered}f(x)=(x^2+1)e^x\\f'(0)\end{gathered}`,
      steps: [
        String.raw`f'(x)=2xe^x+(x^2+1)e^x`,
        String.raw`f'(0)=0+1=1`,
      ],
      answer: String.raw`1`,
    },
    mistake:
      "곱의 도함수를 두 도함수의 곱으로 쓰거나, 몫의 도함수를 두 도함수의 몫으로 쓰지 않습니다. 두 함수가 모두 변한다는 점을 공식에 반영해야 합니다.",
    check: {
      prompt: String.raw`\begin{gathered}g(x)=\frac{x^2+1}{x+1}\\g'(1)\end{gathered}`,
      answer: String.raw`\frac12`,
      reason: "분모의 제곱 위에 분자 미분과 분모의 곱에서 분자와 분모 미분의 곱을 뺀 뒤 x=1을 대입합니다.",
    },
    practice: [
      {
        prompt: String.raw`f(x)=xe^x\text{ 일 때 }f'(0)`,
        answer: String.raw`1`,
        reason: "곱의 미분을 적용하면 f'(x)=e^x+xe^x이고 x=0에서 1입니다.",
      },
      {
        prompt: String.raw`\begin{gathered}h(x)=\frac{x+1}{x-1}\\h'(0)\end{gathered}`,
        answer: String.raw`-2`,
        reason: "몫의 미분을 적용하면 h'(x)=-2/(x-1)²이므로 x=0에서 -2입니다.",
      },
    ],
  },
  {
    id: "chain-rule",
    order: 4,
    title: "합성함수의 미분",
    question: "함수 안에 함수가 들어 있으면 어느 부분부터 미분해야 할까?",
    core: "바깥 함수를 먼저 미분하고, 그대로 남겨 둔 안쪽 함수의 도함수를 한 번 더 곱합니다.",
    intuition:
      "x가 변하면 먼저 안쪽 함수 g(x)가 변하고, 그 변화가 다시 바깥 함수 f의 값을 바꿉니다. 최종 변화율에는 안쪽이 변하는 속도와 바깥이 반응하는 속도가 모두 들어가므로 두 값을 곱합니다.",
    formulas: [
      String.raw`\{f(g(x))\}'=f'(g(x))g'(x)`,
      String.raw`y=f(u),\quad u=g(x)`,
      String.raw`\frac{dy}{dx}=\frac{dy}{du}\frac{du}{dx}`,
    ],
    example: {
      prompt: String.raw`\begin{gathered}f(x)=(x^2+1)^3\\f'(1)\end{gathered}`,
      steps: [
        String.raw`f'(x)=3(x^2+1)^2\cdot2x`,
        String.raw`f'(1)=3\cdot2^2\cdot2=24`,
      ],
      answer: String.raw`24`,
    },
    mistake:
      "바깥 함수만 미분하고 끝내지 않습니다. 안쪽이 x가 아닌 식이면 그 식의 도함수를 반드시 곱해야 합니다.",
    check: {
      prompt: String.raw`\begin{gathered}g(x)=e^{2x-1}\\g'(0)\end{gathered}`,
      answer: String.raw`\frac2e`,
      reason: "e의 지수 부분을 그대로 둔 채 바깥 함수를 미분하고, 안쪽 2x-1의 도함수 2를 곱합니다.",
    },
    practice: [
      {
        prompt: String.raw`f(x)=(3x-1)^4\text{ 일 때 }f'(1)`,
        answer: String.raw`96`,
        reason: "바깥을 미분한 4(3x-1)³에 안쪽 미분 3을 곱한 뒤 x=1을 넣습니다.",
      },
      {
        prompt: String.raw`f(x)=\ln(x^2+1)\text{ 일 때 }f'(1)`,
        answer: String.raw`1`,
        reason: "바깥 로그를 미분한 1/(x²+1)에 안쪽 미분 2x를 곱합니다.",
      },
    ],
  },
  {
    id: "inverse-function-derivative",
    order: 5,
    title: "역함수의 미분",
    question: "역함수의 식을 직접 구하지 않고도 기울기를 알 수 있을까?",
    core: "원함수와 역함수의 대응점을 먼저 찾고, 원함수 기울기의 역수를 취합니다.",
    intuition:
      "역함수의 그래프는 원함수의 그래프를 직선 y=x에 대해 뒤집은 모습입니다. 이때 가로 변화량과 세로 변화량의 자리가 바뀌므로 기울기도 서로 역수가 됩니다. 단, 대응점에서 원함수의 기울기가 0이면 이 공식을 바로 쓸 수 없습니다.",
    formulas: [
      String.raw`\begin{gathered}g=f^{-1}\\g'(x)=\frac1{f'(g(x))}\end{gathered}`,
      String.raw`\begin{gathered}f(a)=b\\(f^{-1})'(b)=\frac1{f'(a)}\\f'(a)\ne0\end{gathered}`,
    ],
    example: {
      prompt: String.raw`\begin{gathered}f(x)=x^3+x+1\\g=f^{-1}\\g'(3)\end{gathered}`,
      steps: [
        String.raw`f(1)=3\Rightarrow g(3)=1`,
        String.raw`g'(3)=\frac1{f'(1)}=\frac1{3+1}=\frac14`,
      ],
      answer: String.raw`\frac14`,
    },
    mistake:
      "g'(b)를 구할 때 1/f'(b)를 바로 쓰지 않습니다. 먼저 f(a)=b가 되는 원함수의 입력 a를 찾은 뒤 1/f'(a)를 계산합니다.",
    check: {
      prompt: String.raw`\begin{gathered}f(x)=e^x+x,\quad g=f^{-1}\\g'(1)\end{gathered}`,
      answer: String.raw`\frac12`,
      reason: "f(0)=1이므로 대응하는 원함수의 입력은 0이고, f'(0)=e^0+1=2의 역수를 취합니다.",
    },
    practice: [
      {
        prompt: String.raw`\begin{gathered}f(x)=x^3+x,\quad g=f^{-1}\\g'(2)\end{gathered}`,
        answer: String.raw`\frac14`,
        reason: "f(1)=2이므로 대응점은 x=1이고 f'(1)=4의 역수를 취합니다.",
      },
      {
        prompt: String.raw`\begin{gathered}f(x)=2x+3,\quad g=f^{-1}\\g'(7)\end{gathered}`,
        answer: String.raw`\frac12`,
        reason: "원함수의 기울기가 항상 2이므로 역함수의 기울기는 항상 그 역수 1/2입니다.",
      },
    ],
  },
  {
    id: "parametric-derivative",
    order: 6,
    title: "매개변수로 나타낸 함수의 미분",
    question: "x와 y가 모두 t에 따라 움직일 때 곡선의 기울기는 어떻게 구할까?",
    core: "t에 대한 세로 변화율을 가로 변화율로 나누면 곡선 위 점에서의 기울기가 됩니다.",
    intuition:
      "점이 곡선 위를 움직일 때 dx/dt는 가로로 움직이는 속도이고 dy/dt는 세로로 움직이는 속도입니다. 기울기는 가로 변화량 1에 대한 세로 변화량이므로 두 속도의 비 (dy/dt)/(dx/dt)로 구합니다.",
    formulas: [
      String.raw`\begin{gathered}x=f(t),\quad y=g(t)\\\frac{dy}{dx}=\frac{dy/dt}{dx/dt}\end{gathered}`,
      String.raw`\frac{dx}{dt}\ne0`,
    ],
    example: {
      prompt: String.raw`\begin{gathered}x=t^2+1,\quad y=t^3-t\\t=1\text{에서 }\frac{dy}{dx}\end{gathered}`,
      steps: [
        String.raw`\frac{dx}{dt}=2t,\quad\frac{dy}{dt}=3t^2-1`,
        String.raw`\left.\frac{dy}{dx}\right|_{t=1}=\frac{2}{2}=1`,
      ],
      answer: String.raw`1`,
    },
    mistake:
      "dy/dt만 구하고 접선의 기울기라고 하지 않습니다. 반드시 dy/dt를 dx/dt로 나누고, dx/dt가 0인 경우에는 이 식을 바로 쓸 수 있는지 따로 확인합니다.",
    check: {
      prompt: String.raw`\begin{gathered}x=\cos t,\quad y=\sin t\\t=\frac\pi4\text{에서 }\frac{dy}{dx}\end{gathered}`,
      answer: String.raw`-1`,
      reason: "dx/dt=-sin t, dy/dt=cos t이므로 t=π/4에서 두 변화율의 비는 -1입니다.",
    },
    practice: [
      {
        prompt: String.raw`\begin{gathered}x=t^2+1,\quad y=t^3\\t=1\text{에서 }\frac{dy}{dx}\end{gathered}`,
        answer: String.raw`\frac32`,
        reason: "dx/dt=2t, dy/dt=3t²이므로 t=1에서 두 변화율의 비는 3/2입니다.",
      },
      {
        prompt: String.raw`\begin{gathered}x=e^t,\quad y=e^{-t}\\t=0\text{에서 }\frac{dy}{dx}\end{gathered}`,
        answer: String.raw`-1`,
        reason: "dx/dt=e^t, dy/dt=-e^(-t)이므로 t=0에서 비는 -1입니다.",
      },
    ],
  },
  {
    id: "implicit-differentiation",
    order: 7,
    title: "음함수의 미분",
    question: "y가 x에 대한 식으로 정리되지 않아도 접선의 기울기를 구할 수 있을까?",
    core: "양변을 x로 미분하되, y가 들어간 항을 미분할 때마다 연쇄법칙으로 y'을 붙입니다.",
    intuition:
      "식에 x와 y가 섞여 있어도 곡선 위에서는 y가 x에 따라 변합니다. 따라서 y²을 x로 미분하면 2y가 아니라 2y·y'이 됩니다. 모든 항을 미분한 뒤 y'이 붙은 항을 한쪽에 모으면 기울기를 구할 수 있습니다.",
    formulas: [
      String.raw`F(x,y)=0\Rightarrow\frac{d}{dx}F(x,y)=0`,
      String.raw`\frac{d}{dx}y^n=ny^{n-1}\frac{dy}{dx}`,
    ],
    example: {
      prompt: String.raw`\begin{gathered}x^2+y^2=25\\(3,4)\text{에서 }\frac{dy}{dx}\end{gathered}`,
      steps: [
        String.raw`2x+2y\frac{dy}{dx}=0`,
        String.raw`\frac{dy}{dx}=-\frac{x}{y}\Rightarrow-\frac34`,
      ],
      answer: String.raw`-\frac34`,
    },
    mistake:
      "y가 포함된 항을 보통 문자처럼 미분해 y'을 빠뜨리지 않습니다. xy처럼 x와 y가 곱이면 곱의 미분법도 함께 적용합니다.",
    check: {
      prompt: String.raw`\begin{gathered}x^2+xy+y^2=7\\(1,2)\text{에서 }\frac{dy}{dx}\end{gathered}`,
      answer: String.raw`-\frac45`,
      reason: "2x+y+xy′+2yy′=0에 (1,2)를 대입하면 4+5y′=0입니다.",
    },
    practice: [
      {
        prompt: String.raw`\begin{gathered}e^y+x=2\\(1,0)\text{에서 }\frac{dy}{dx}\end{gathered}`,
        answer: String.raw`-1`,
        reason: "eʸ·y′+1=0에 y=0을 대입하면 y′=-1입니다.",
      },
      {
        prompt: String.raw`\begin{gathered}x^2-y^2=3\\(2,1)\text{에서 }\frac{dy}{dx}\end{gathered}`,
        answer: String.raw`2`,
        reason: "2x-2yy′=0이므로 y′=x/y이고 (2,1)에서 값은 2입니다.",
      },
    ],
  },
  {
    id: "second-derivative",
    order: 8,
    title: "이계도함수",
    question: "기울기 자체가 커지는지 작아지는지는 어떻게 알 수 있을까?",
    core: "함수를 두 번 미분한 이계도함수는 기울기의 변화율이며, 위치함수에서는 가속도를 나타냅니다.",
    intuition:
      "일계도함수 f'은 그래프의 기울기와 움직이는 점의 속도를 알려 줍니다. 이 값을 한 번 더 미분한 f''은 기울기나 속도가 얼마나 빠르게 변하는지를 알려 줍니다. 따라서 위치를 두 번 미분하면 가속도가 됩니다.",
    formulas: [
      String.raw`f''(x)=\{f'(x)\}'=\frac{d^2y}{dx^2}`,
      String.raw`\begin{gathered}v(t)=s'(t)\\a(t)=v'(t)=s''(t)\end{gathered}`,
    ],
    example: {
      prompt: String.raw`\begin{gathered}f(x)=x^4-2x^2\\f''(1)\end{gathered}`,
      steps: [
        String.raw`f'(x)=4x^3-4x`,
        String.raw`f''(x)=12x^2-4\Rightarrow f''(1)=8`,
      ],
      answer: String.raw`8`,
    },
    mistake:
      "f''은 f'을 한 번 더 미분한 값이지 f'을 제곱한 값이 아닙니다. 위치·속도·가속도 문제에서는 몇 번 미분한 함수인지 먼저 표시합니다.",
    check: {
      prompt: String.raw`\begin{gathered}f(x)=x^3+2x^2-x\\f''(1)\end{gathered}`,
      answer: String.raw`10`,
      reason: "f'(x)=3x²+4x-1이고 f''(x)=6x+4이므로 x=1에서 10입니다.",
    },
    practice: [
      {
        prompt: String.raw`\begin{gathered}s(t)=t^3-3t^2+2t\\t=2\text{에서 가속도}\end{gathered}`,
        answer: String.raw`6`,
        reason: "속도는 s'(t)=3t²-6t+2이고 가속도는 s''(t)=6t-6이므로 a(2)=6입니다.",
      },
      {
        prompt: String.raw`f(x)=e^{2x}\text{ 일 때 }f''(0)`,
        answer: String.raw`4`,
        reason: "한 번 미분하면 2e²ˣ, 다시 미분하면 4e²ˣ이므로 x=0에서 4입니다.",
      },
    ],
  },
  {
    id: "tangent-normal-lines",
    order: 9,
    title: "접선과 법선의 방정식",
    question: "곡선 위 한 점에서 그래프와 같은 방향으로 나아가는 직선은 어떻게 구할까?",
    core: "접점의 좌표와 그 점에서의 도함수 값을 구한 뒤, 점과 기울기를 아는 직선의 식에 넣습니다.",
    intuition:
      "도함수 f'(a)는 x=a에서 곡선이 향하는 순간 방향, 즉 접선의 기울기입니다. 하지만 기울기만으로는 직선이 하나로 정해지지 않습니다. 접점 (a,f(a))까지 함께 넣어야 접선이 고정됩니다. 법선은 그 접점에서 접선과 수직인 직선입니다.",
    formulas: [
      String.raw`y-f(a)=f'(a)(x-a)`,
      String.raw`f'(a)\ne0\Rightarrow m_{\text{법선}}=-\frac1{f'(a)}`,
    ],
    example: {
      prompt: String.raw`\begin{gathered}f(x)=x^3-2x\\x=1\text{에서 접선}\end{gathered}`,
      steps: [
        String.raw`f(1)=-1,\quad f'(x)=3x^2-2\Rightarrow f'(1)=1`,
        String.raw`y+1=1(x-1)\Rightarrow y=x-2`,
      ],
      answer: String.raw`y=x-2`,
    },
    mistake:
      "x=a만 접점의 좌표로 쓰지 않습니다. 먼저 f(a)를 구해 접점 (a,f(a))를 완성합니다. 또한 법선의 기울기는 접선 기울기의 단순한 역수가 아니라 음의 역수입니다.",
    check: {
      prompt: String.raw`f(x)=x^2\text{ 위 }x=1\text{에서 접선}`,
      answer: String.raw`y=2x-1`,
      reason: "접점은 (1,1)이고 f'(1)=2이므로 y-1=2(x-1)입니다.",
    },
    practice: [
      {
        prompt: String.raw`f(x)=\ln x\text{ 위 }x=e\text{에서 접선}`,
        answer: String.raw`y=\frac{x}{e}`,
        reason: "접점은 (e,1)이고 기울기는 1/e이므로 y-1=(x-e)/e를 정리합니다.",
      },
      {
        prompt: String.raw`f(x)=e^x\text{ 위 }x=0\text{에서 법선}`,
        answer: String.raw`y=-x+1`,
        reason: "접점은 (0,1), 접선 기울기는 1이므로 법선 기울기는 -1입니다.",
      },
    ],
  },
  {
    id: "increasing-decreasing-extrema",
    order: 10,
    title: "함수의 증가·감소와 극값",
    question: "그래프를 전부 그리지 않고도 어느 지점에서 방향이 바뀌는지 알 수 있을까?",
    core: "도함수의 부호로 함수의 진행 방향을 읽고, 부호가 바뀌는 지점에서 극대와 극소를 판정합니다.",
    intuition:
      "도함수가 양수이면 그래프는 오른쪽으로 갈수록 올라가고, 음수이면 내려갑니다. 따라서 도함수의 부호가 양수에서 음수로 바뀌면 올라가다 내려가므로 극대, 음수에서 양수로 바뀌면 내려가다 올라가므로 극소입니다. 그래프 전체보다 도함수의 부호표를 먼저 그리면 방향 전환이 분명해집니다.",
    formulas: [
      String.raw`\begin{gathered}f'(x)>0\Rightarrow f(x)\text{ 증가}\\f'(x)<0\Rightarrow f(x)\text{ 감소}\end{gathered}`,
      String.raw`+\to-:\text{ 극대},\qquad-\to+:\text{ 극소}`,
    ],
    example: {
      prompt: String.raw`\begin{gathered}f(x)=x^3-3x\\\text{극댓값과 극솟값}\end{gathered}`,
      steps: [
        String.raw`f'(x)=3(x-1)(x+1)`,
        String.raw`+\to-\text{인 }x=-1\text{에서 }f(-1)=2`,
        String.raw`-\to+\text{인 }x=1\text{에서 }f(1)=-2`,
      ],
      answer: String.raw`\text{극댓값 }2,\quad\text{극솟값 }-2`,
    },
    mistake:
      "f'(a)=0이라는 사실만으로 x=a가 극대나 극소라고 단정하지 않습니다. 그 점의 왼쪽과 오른쪽에서 도함수의 부호가 실제로 바뀌는지 확인합니다.",
    check: {
      prompt: String.raw`f(x)=x^3-3x^2\text{의 극댓값과 극솟값}`,
      answer: String.raw`\text{극댓값 }0,\quad\text{극솟값 }-4`,
      reason: "f′(x)=3x(x-2)의 부호는 +, -, +로 바뀌므로 x=0에서 극댓값 0, x=2에서 극솟값 -4입니다.",
    },
    practice: [
      {
        prompt: String.raw`f(x)=x^4-2x^2\text{에서 }x=0\text{의 극값}`,
        answer: String.raw`\text{극댓값 }0`,
        reason: "f′(x)=4x(x-1)(x+1)은 x=0의 왼쪽에서 양수, 오른쪽에서 음수이므로 극댓값은 f(0)=0입니다.",
      },
      {
        prompt: String.raw`f'(x)=(x-1)^2(x+2)\text{일 때 극값을 갖는 }x`,
        answer: String.raw`x=-2`,
        reason: "x=-2에서는 도함수의 부호가 음수에서 양수로 바뀌지만, x=1에서는 바뀌지 않습니다.",
      },
    ],
  },
];

export const INTEGRATION_CONCEPTS = [
  {
    id: "antiderivative-basics",
    order: 1,
    title: "부정적분의 뜻과 기본 공식",
    question: "미분한 결과를 알 때 원래 함수는 어떻게 되찾을까?",
    core: "부정적분은 미분을 거꾸로 되돌리는 계산이며, 미분하면 사라지는 적분상수 C를 반드시 붙입니다.",
    intuition:
      "미분은 함수에서 순간변화율을 꺼내는 과정이고, 부정적분은 그 변화율을 가진 원래 함수들을 찾는 과정입니다. 위아래로 평행이동한 함수들은 모두 같은 도함수를 가지므로 원래 함수는 하나로 정해지지 않습니다. 이 차이를 적분상수 C로 나타냅니다.",
    formulas: [
      String.raw`\begin{gathered}\int f(x)\,dx=F(x)+C\\F'(x)=f(x)\end{gathered}`,
      String.raw`\int x^n\,dx=\frac{x^{n+1}}{n+1}+C\quad(n\ne-1)`,
      String.raw`\int\frac1x\,dx=\ln|x|+C`,
    ],
    example: {
      prompt: String.raw`\begin{gathered}f'(x)=3x^2-4x+1\\f(0)=2\text{일 때 }f(x)\end{gathered}`,
      steps: [
        String.raw`f(x)=x^3-2x^2+x+C`,
        String.raw`f(0)=C=2`,
      ],
      answer: String.raw`f(x)=x^3-2x^2+x+2`,
    },
    mistake:
      "거듭제곱을 적분할 때 지수만 1 늘리고 끝내지 않습니다. 늘어난 지수로 나누고 적분상수 C를 붙입니다. 1/x은 거듭제곱 공식의 예외입니다.",
    check: {
      prompt: String.raw`\int(4x^3-2x)\,dx`,
      answer: String.raw`x^4-x^2+C`,
      reason: "각 항의 지수를 1씩 늘린 뒤 그 지수로 나누고 마지막에 적분상수 C를 붙입니다.",
    },
    practice: [
      {
        prompt: String.raw`\begin{gathered}f'(x)=2x+3,\quad f(1)=5\\f(2)\end{gathered}`,
        answer: String.raw`11`,
        reason: "f(x)=x²+3x+C이고 f(1)=5에서 C=1이므로 f(2)=11입니다.",
      },
      {
        prompt: String.raw`\int\left(e^x+\frac1x\right)\,dx`,
        answer: String.raw`e^x+\ln|x|+C`,
        reason: "eˣ은 그대로 적분되고 1/x의 부정적분은 ln|x|입니다.",
      },
    ],
  },
  {
    id: "definite-integral-basics",
    order: 2,
    title: "정적분의 뜻과 계산",
    question: "부정적분으로 구한 함수를 두 끝점에 대입하면 무엇을 알 수 있을까?",
    core: "정적분은 구간에서 쌓인 부호 있는 변화량이며, 한 부정적분의 윗끝값에서 아랫끝값을 빼서 계산합니다.",
    intuition:
      "부정적분이 같은 변화율을 가진 함수들의 모음이라면, 정적분은 그중 어떤 함수를 골라도 두 끝점 사이에서 얼마나 변했는지를 하나의 수로 나타냅니다. 두 끝값을 빼면 적분상수 C가 서로 사라지므로 정적분에는 C를 붙이지 않습니다.",
    formulas: [
      String.raw`\begin{gathered}\int_a^b f(x)\,dx=F(b)-F(a)\\F'(x)=f(x)\end{gathered}`,
      String.raw`\begin{gathered}\int_a^a f(x)\,dx=0\\\int_b^a f(x)\,dx=-\int_a^b f(x)\,dx\end{gathered}`,
      String.raw`\begin{gathered}\int_a^b f(x)\,dx+\int_b^c f(x)\,dx\\=\int_a^c f(x)\,dx\end{gathered}`,
    ],
    example: {
      prompt: String.raw`\int_0^2(3x^2-2x+1)\,dx`,
      steps: [
        String.raw`\int(3x^2-2x+1)\,dx=x^3-x^2+x+C`,
        String.raw`\left[x^3-x^2+x\right]_0^2=(8-4+2)-0`,
      ],
      answer: String.raw`6`,
    },
    mistake:
      "아랫끝값에서 윗끝값을 빼지 않습니다. 반드시 윗끝값에서 아랫끝값을 빼며, 정적분의 계산 결과에는 적분상수 C를 붙이지 않습니다.",
    check: {
      prompt: String.raw`\int_1^3(2x-1)\,dx`,
      answer: String.raw`6`,
      reason: "부정적분 x²-x에 3과 1을 차례로 대입한 뒤 윗끝값에서 아랫끝값을 뺍니다.",
    },
    practice: [
      {
        prompt: String.raw`\int_0^2x^2\,dx+\int_2^3x^2\,dx`,
        answer: String.raw`9`,
        reason: "이어진 두 구간을 0부터 3까지 하나로 합치면 [x³/3]₀³=9입니다.",
      },
      {
        prompt: String.raw`\int_1^4 f(x)\,dx=7\text{일 때 }\int_4^1 2f(x)\,dx`,
        answer: String.raw`-14`,
        reason: "구간의 순서를 바꾸면 부호가 바뀌고 함수에 곱한 2는 적분 밖으로 나옵니다.",
      },
    ],
  },
  {
    id: "integral-defined-function",
    order: 3,
    title: "정적분으로 정의된 함수",
    question: "적분의 끝점이 x에 따라 움직이면 누적값은 얼마나 빠르게 변할까?",
    core: "고정된 곳부터 x까지 f(t)를 누적한 함수의 도함수는 끝점 x에서의 높이 f(x)입니다.",
    intuition:
      "적분의 오른쪽 끝점을 x에서 아주 조금 옮기면, 새로 더해지는 양은 폭이 아주 좁고 높이가 f(x)인 조각과 같습니다. 따라서 누적값의 순간변화율은 그 끝점에서의 함수값 f(x)가 됩니다. 이것이 미분과 적분이 서로를 되돌리는 미적분의 기본정리입니다.",
    formulas: [
      String.raw`\begin{gathered}G(x)=\int_a^x f(t)\,dt\\G'(x)=f(x),\qquad G(a)=0\end{gathered}`,
      String.raw`\begin{gathered}H(x)=\int_x^a f(t)\,dt\\H'(x)=-f(x)\end{gathered}`,
      String.raw`\begin{gathered}K(x)=\int_a^{g(x)} f(t)\,dt\\K'(x)=f(g(x))g'(x)\end{gathered}`,
    ],
    example: {
      prompt: String.raw`\begin{gathered}G(x)=\int_1^{x^2}(t^3+1)\,dt\\G'(1)\end{gathered}`,
      steps: [
        String.raw`G'(x)=\bigl((x^2)^3+1\bigr)\cdot2x`,
        String.raw`G'(1)=(1+1)\cdot2`,
      ],
      answer: String.raw`4`,
    },
    mistake:
      "윗끝이 x가 아니라 g(x)이면 끝점의 함수값 f(g(x))만 쓰고 끝내지 않습니다. 합성함수의 미분처럼 g'(x)까지 곱해야 하며, x가 아랫끝이면 부호가 음수로 바뀝니다.",
    check: {
      prompt: String.raw`F(x)=\int_0^x(3t^2-2t)\,dt\text{일 때 }F'(2)`,
      answer: String.raw`8`,
      reason: "미적분의 기본정리에 따라 F'(x)=3x²-2x이고 x=2를 대입하면 8입니다.",
    },
    practice: [
      {
        prompt: String.raw`G(x)=\int_x^3(t^2+1)\,dt\text{일 때 }G'(1)`,
        answer: String.raw`-2`,
        reason: "x가 아랫끝이므로 G'(x)=-(x²+1)이고 x=1에서 -2입니다.",
      },
      {
        prompt: String.raw`H(x)=\int_0^{2x}\cos t\,dt\text{일 때 }H'\!\left(\frac{\pi}{6}\right)`,
        answer: String.raw`1`,
        reason: "H'(x)=2cos(2x)이므로 x=π/6에서 2cos(π/3)=1입니다.",
      },
    ],
  },
  {
    id: "areas-with-integrals",
    order: 4,
    title: "정적분과 넓이",
    question: "정적분값이 음수가 될 수 있는데 실제 넓이는 어떻게 항상 양수로 구할까?",
    core: "넓이는 음수가 될 수 없으므로 x축 아래에서는 부호를 바꾸고, 두 곡선 사이에서는 위 함수에서 아래 함수를 뺍니다.",
    intuition:
      "정적분은 x축 위의 영역은 양수, 아래의 영역은 음수로 더한 값입니다. 실제 넓이를 구할 때는 음수로 쌓인 부분도 양수로 바꾸어야 합니다. 두 곡선 사이의 넓이도 세로로 자른 조각의 높이가 ‘위 함수−아래 함수’가 되도록 만든 뒤 모두 더하는 계산입니다.",
    formulas: [
      String.raw`S=\int_a^b|f(x)|\,dx`,
      String.raw`f(x)\ge0:\quad S=\int_a^b f(x)\,dx`,
      String.raw`f(x)\le0:\quad S=-\int_a^b f(x)\,dx`,
      String.raw`f(x)\ge g(x)\quad(a\le x\le b)`,
      String.raw`S=\int_a^b\{f(x)-g(x)\}\,dx`,
    ],
    example: {
      prompt: String.raw`\begin{gathered}y=x-1,\quad y=0\\0\le x\le2\\\text{두 그래프 사이의 넓이}\end{gathered}`,
      steps: [
        String.raw`x=1\text{에서 x축과 만나므로 구간을 나눈다.}`,
        String.raw`\int_0^1(1-x)\,dx+\int_1^2(x-1)\,dx=\frac12+\frac12`,
      ],
      answer: String.raw`1`,
    },
    mistake:
      "교점이나 x축과 만나는 점을 찾지 않고 한 번에 적분하지 않습니다. 구간마다 어떤 함수가 위에 있는지 확인하고 넓이가 양수가 되도록 빼는 순서를 정합니다.",
    check: {
      prompt: String.raw`\begin{gathered}y=x^2-1,\quad y=0\\-1\le x\le1\\\text{두 그래프 사이의 넓이}\end{gathered}`,
      answer: String.raw`\frac43`,
      reason: "구간 전체에서 x²-1≤0이므로 ∫₋₁¹(1-x²)dx를 계산하면 4/3입니다.",
    },
    practice: [
      {
        prompt: String.raw`\begin{gathered}y=x,\quad y=x^2\\0\le x\le1\\\text{두 곡선 사이의 넓이}\end{gathered}`,
        answer: String.raw`\frac16`,
        reason: "0≤x≤1에서는 x≥x²이므로 ∫₀¹(x-x²)dx=1/6입니다.",
      },
      {
        prompt: String.raw`\begin{gathered}y=3x,\quad y=x^2\\\text{두 곡선 사이의 넓이}\end{gathered}`,
        answer: String.raw`\frac92`,
        reason: "교점은 x=0, 3이고 그 사이에서 3x≥x²이므로 ∫₀³(3x-x²)dx=9/2입니다.",
      },
    ],
  },
  {
    id: "motion-with-integrals",
    order: 5,
    title: "속도·위치 변화량·이동거리",
    question: "속도를 적분하면 언제 위치 변화량이고 언제 실제 이동거리가 될까?",
    core: "속도를 그대로 적분하면 방향을 포함한 위치 변화량이고, 속력인 |v(t)|를 적분하면 실제로 움직인 전체 거리입니다.",
    intuition:
      "속도가 양수이면 정방향, 음수이면 반대 방향으로 움직입니다. 위치 변화량은 되돌아온 만큼 서로 상쇄하지만, 이동거리는 어느 방향으로 갔든 움직인 양을 모두 더합니다. 따라서 v(t)=0인 시각을 찾아 방향이 바뀌는 구간을 나눈 뒤 각 구간의 적분값을 양수로 더합니다.",
    formulas: [
      String.raw`\begin{gathered}s(b)-s(a)=\int_a^b v(t)\,dt\\\text{위치 변화량}\end{gathered}`,
      String.raw`\begin{gathered}D=\int_a^b|v(t)|\,dt\\\text{이동거리}\end{gathered}`,
      String.raw`\begin{gathered}v(c)=0\\D=\left|\int_a^c v(t)\,dt\right|\\{}+\left|\int_c^b v(t)\,dt\right|\end{gathered}`,
    ],
    example: {
      prompt: String.raw`\begin{gathered}v(t)=2t-2,\quad 0\le t\le3\\\text{위치 변화량과 이동거리}\end{gathered}`,
      steps: [
        String.raw`t=1\text{에서 }v(t)=0\text{이므로 방향이 바뀐다.}`,
        String.raw`\int_0^3(2t-2)\,dt=3`,
        String.raw`-\int_0^1(2t-2)\,dt+\int_1^3(2t-2)\,dt=1+4`,
      ],
      answer: String.raw`\text{위치 변화량 }3,\quad\text{이동거리 }5`,
    },
    mistake:
      "위치 변화량의 절댓값과 이동거리를 같다고 보지 않습니다. 먼저 v(t)=0인 시각을 찾고, 속도가 음수인 구간의 적분값은 부호를 바꾸어 양수로 더합니다.",
    check: {
      prompt: String.raw`\begin{gathered}v(t)=t-2,\quad 0\le t\le4\\\text{이동거리}\end{gathered}`,
      answer: String.raw`4`,
      reason: "t=2에서 방향이 바뀌며, 0부터 2까지와 2부터 4까지의 이동거리가 각각 2이므로 전체는 4입니다.",
    },
    practice: [
      {
        prompt: String.raw`\begin{gathered}v(t)=3t^2-3,\quad 0\le t\le2\\\text{위치 변화량}\end{gathered}`,
        answer: String.raw`2`,
        reason: "위치 변화량은 속도의 부호를 바꾸지 않고 그대로 적분하므로 [t³-3t]₀²=2입니다.",
      },
      {
        prompt: String.raw`\begin{gathered}v(t)=4-2t,\quad 0\le t\le3\\\text{이동거리}\end{gathered}`,
        answer: String.raw`5`,
        reason: "t=2에서 방향이 바뀌며, 0부터 2까지의 거리 4와 2부터 3까지의 거리 1을 더하면 5입니다.",
      },
    ],
  },
  {
    id: "substitution-integration",
    order: 6,
    title: "치환적분법",
    question: "복잡한 합성함수 모양의 적분을 더 단순한 적분으로 어떻게 바꿀까?",
    core: "적분식에 안쪽 함수 g(x)와 그 도함수 g′(x)가 함께 보이면 u=g(x)로 묶어 하나의 단순한 변수로 바꿉니다.",
    intuition:
      "합성함수의 미분에서는 바깥 함수를 미분한 뒤 안쪽 함수의 도함수를 곱했습니다. 치환적분은 이 과정을 거꾸로 읽습니다. 반복되는 안쪽 식을 하나의 묶음 u로 보고, 옆에 붙은 g′(x)dx를 du로 바꾸면 복잡한 x의 적분이 익숙한 u의 적분이 됩니다.",
    formulas: [
      String.raw`\begin{gathered}u=g(x),\quad du=g'(x)\,dx\\\int f(g(x))g'(x)\,dx=\int f(u)\,du\end{gathered}`,
      String.raw`\begin{gathered}\int_a^b f(g(x))g'(x)\,dx\\=\int_{g(a)}^{g(b)}f(u)\,du\end{gathered}`,
      String.raw`\begin{gathered}\int f'(x)\{f(x)\}^n\,dx\\=\frac{\{f(x)\}^{n+1}}{n+1}+C\\(n\ne-1)\end{gathered}`,
      String.raw`\int\frac{f'(x)}{f(x)}\,dx=\ln|f(x)|+C`,
    ],
    example: {
      prompt: String.raw`\int_0^1 2x(x^2+1)^2\,dx`,
      steps: [
        String.raw`u=x^2+1\text{로 두면 }du=2x\,dx`,
        String.raw`x=0\Rightarrow u=1,\qquad x=1\Rightarrow u=2`,
        String.raw`\int_1^2u^2\,du=\left[\frac{u^3}{3}\right]_1^2`,
      ],
      answer: String.raw`\frac73`,
    },
    mistake:
      "안쪽 식만 u로 바꾸고 dx를 그대로 남기지 않습니다. g′(x)dx까지 du로 바뀌는지 확인하고, 정적분은 x의 끝값을 u의 끝값으로 함께 바꾼 뒤 계산합니다.",
    check: {
      prompt: String.raw`\int 3x^2(x^3+1)^4\,dx`,
      answer: String.raw`\frac{(x^3+1)^5}{5}+C`,
      reason: "u=x³+1로 두면 du=3x²dx이므로 ∫u⁴du를 계산한 뒤 다시 x로 되돌립니다.",
    },
    practice: [
      {
        prompt: String.raw`\int_0^1 xe^{x^2}\,dx`,
        answer: String.raw`\frac{e-1}{2}`,
        reason: "u=x²로 두면 du=2x dx이므로 1/2을 곱한 ∫₀¹eᵘdu가 되어 답은 (e-1)/2입니다.",
      },
      {
        prompt: String.raw`\int_1^2\frac{2x}{x^2+1}\,dx`,
        answer: String.raw`\ln\frac52`,
        reason: "u=x²+1로 두면 끝값이 2와 5로 바뀌고 ∫₂⁵(1/u)du=ln(5/2)입니다.",
      },
    ],
  },
  {
    id: "integration-by-parts",
    order: 7,
    title: "부분적분법",
    question: "서로 다른 두 함수가 곱해진 적분을 어떻게 더 쉬운 적분으로 바꿀까?",
    core: "곱의 미분 공식을 거꾸로 정리해, 미분하면 단순해지는 함수와 적분하기 쉬운 함수를 나누어 계산합니다.",
    intuition:
      "곱의 미분에서는 두 함수가 번갈아 한 번씩 미분되었습니다. 이 식을 적분의 관점에서 다시 정리하면 어려운 곱의 적분 하나를 경계항 uv와 더 쉬운 적분 하나로 바꿀 수 있습니다. 보통 다항식이나 로그함수처럼 미분하면 단순해지는 쪽을 u로 고릅니다.",
    formulas: [
      String.raw`(uv)'=u'v+uv'`,
      String.raw`\begin{gathered}\int u\,dv=uv-\int v\,du\\du=u'\,dx,\quad dv=v'\,dx\end{gathered}`,
      String.raw`\begin{gathered}\int_a^b u\,dv=[uv]_a^b\\{}-\int_a^b v\,du\end{gathered}`,
    ],
    example: {
      prompt: String.raw`\int_0^1 xe^x\,dx`,
      steps: [
        String.raw`u=x,\quad dv=e^x\,dx\text{로 두면 }du=dx,\quad v=e^x`,
        String.raw`\left[xe^x\right]_0^1-\int_0^1e^x\,dx`,
        String.raw`e-(e-1)`,
      ],
      answer: String.raw`1`,
    },
    mistake:
      "공식의 두 번째 적분 앞에 있는 음의 부호를 빠뜨리지 않습니다. dv를 그대로 옮기는 것이 아니라 먼저 적분해 v를 구하며, 정적분에서는 [uv]의 양 끝값도 함께 계산합니다.",
    check: {
      prompt: String.raw`\int x\cos x\,dx`,
      answer: String.raw`x\sin x+\cos x+C`,
      reason: "u=x, dv=cos x dx로 두면 v=sin x이므로 x sin x-∫sin x dx를 계산합니다.",
    },
    practice: [
      {
        prompt: String.raw`\int_0^{\frac\pi2}x\sin x\,dx`,
        answer: String.raw`1`,
        reason: "u=x, dv=sin x dx로 두면 v=-cos x이고 [-x cos x+sin x]₀^{π/2}=1입니다.",
      },
      {
        prompt: String.raw`\int\ln x\,dx`,
        answer: String.raw`x\ln x-x+C`,
        reason: "ln x를 u, 1·dx를 dv로 보면 x ln x-∫1 dx가 되어 x ln x-x+C입니다.",
      },
    ],
  },
  {
    id: "volumes-with-integrals",
    order: 8,
    title: "정적분과 입체도형의 부피",
    question: "입체를 얇은 단면으로 잘랐을 때 각 단면의 넓이로 전체 부피를 어떻게 구할까?",
    core: "x에서의 단면 넓이가 A(x)이면, 두께가 매우 얇은 A(x)dx를 구간 전체에 쌓아 부피 V를 구합니다.",
    intuition:
      "입체를 x축에 수직인 얇은 조각들로 자르면 각 조각은 ‘단면 넓이×아주 작은 두께’인 납작한 기둥과 같습니다. 이 작은 부피들을 모두 더한 것이 정적분입니다. 따라서 먼저 문제의 길이 정보를 원·정사각형·삼각형 등의 단면 넓이로 바꾼 뒤 적분해야 합니다.",
    formulas: [
      String.raw`V=\int_a^b A(x)\,dx`,
      String.raw`\begin{gathered}\text{x축 둘레의 회전체}\\V=\pi\int_a^b\{f(x)\}^2\,dx\end{gathered}`,
      String.raw`\begin{gathered}\text{속이 빈 회전체}\\V=\pi\int_a^b\{R(x)^2-r(x)^2\}\,dx\end{gathered}`,
      String.raw`\begin{gathered}\text{한 변 }h\text{인 정사각형}:\ A=h^2\\\text{한 변 }h\text{인 정삼각형}:\ A=\frac{\sqrt3}{4}h^2\end{gathered}`,
    ],
    example: {
      prompt: String.raw`\begin{gathered}0\le x\le4\\\text{x축에 수직인 단면은}\\\text{한 변이 }\sqrt{x}\text{인 정사각형}\end{gathered}`,
      steps: [
        String.raw`A(x)=(\sqrt{x})^2=x`,
        String.raw`V=\int_0^4x\,dx`,
        String.raw`\left[\frac{x^2}{2}\right]_0^4`,
      ],
      answer: String.raw`8`,
    },
    mistake:
      "문제에 주어진 길이를 그대로 적분하지 않습니다. 먼저 그 길이가 반지름인지 지름인지, 또는 정사각형이나 삼각형의 한 변인지 확인해 단면 넓이 A(x)를 만든 뒤 적분합니다.",
    check: {
      prompt: String.raw`\begin{gathered}y=x,\quad0\le x\le2\\\text{x축과 둘러싼 영역을}\\\text{x축 둘레로 회전한 부피}\end{gathered}`,
      answer: String.raw`\frac{8\pi}{3}`,
      reason: "반지름이 x인 원판의 넓이는 πx²이므로 π∫₀²x²dx=8π/3입니다.",
    },
    practice: [
      {
        prompt: String.raw`\begin{gathered}0\le x\le2\\\text{x축에 수직인 단면은}\\\text{한 변이 }x\text{인 정삼각형}\end{gathered}`,
        answer: String.raw`\frac{2\sqrt3}{3}`,
        reason: "단면적은 (√3/4)x²이므로 0부터 2까지 적분하면 2√3/3입니다.",
      },
      {
        prompt: String.raw`\begin{gathered}y=2,\quad y=x\\0\le x\le2\\\text{두 곡선 사이를 x축 둘레로}\\\text{회전한 부피}\end{gathered}`,
        answer: String.raw`\frac{16\pi}{3}`,
        reason: "바깥 반지름은 2, 안쪽 반지름은 x이므로 π∫₀²(4-x²)dx=16π/3입니다.",
      },
    ],
  },
];

export const CALCULUS_CONCEPTS_BY_UNIT = {
  "sequence-limits": SEQUENCE_LIMIT_CONCEPTS,
  differentiation: DIFFERENTIATION_CONCEPTS,
  integration: INTEGRATION_CONCEPTS,
};

export function getCalculusConceptContext(conceptId, unitId) {
  for (const unit of CALCULUS_UNITS) {
    const concepts = CALCULUS_CONCEPTS_BY_UNIT[unit.id] ?? [];
    const concept = concepts.find((candidate) => candidate.id === conceptId);
    if (concept) return { unit, concepts, concept };
  }

  const requestedUnit = CALCULUS_UNITS.find(
    (unit) => unit.id === unitId && unit.status === "available",
  );
  const unit = requestedUnit ?? CALCULUS_UNITS[0];
  const concepts = CALCULUS_CONCEPTS_BY_UNIT[unit.id] ?? [];
  return {
    unit,
    concepts,
    concept: concepts[0] ?? SEQUENCE_LIMIT_CONCEPTS[0],
  };
}

export function getSequenceLimitConcept(conceptId) {
  return (
    SEQUENCE_LIMIT_CONCEPTS.find((concept) => concept.id === conceptId) ??
    SEQUENCE_LIMIT_CONCEPTS[0]
  );
}
