const fs = require("fs");
const p = "C:/Users/downf/suneung-viewer/public/data/all_data_204.json";
const d = JSON.parse(fs.readFileSync(p, "utf8"));
const lit = d["2025_9월"].literature;

// 교체 대상: lsep25b, lsep25d 만
const targets = ["lsep25b", "lsep25d"];

const newData = [
  {
    id: "lsep25b",
    title: "북방에서 정현웅에게 / 살얼음 아래 같은 데 2-생가 / 이문원노종기",
    range: "22~27번",
    sents: [
      { id: "lsep25bs1", t: "(가)", sentType: "workTag" },
      {
        id: "lsep25bs2",
        t: "아득한 옛날에 나는 떠났다\n부여를 숙신을 발해를 여진을 요를 금을\n흥안령을 음산을 아무우르를 숭가리를\n범과 사슴과 너구리를 배반하고\n송어와 메기와 개구리를 속이고 나는 떠났다",
        sentType: "verse",
      },
      {
        id: "lsep25bs3",
        t: "나는 그때\n자작나무와 이깔나무의 슬퍼하던 것을 기억한다\n갈대와 장풍의 붙드던 말도 잊지 않았다\n오로촌이 멧돝을 잡아 나를 잔치해 보내던 것도\n쏠론이 십릿길을 따라 나와 울던 것도 잊지 않았다",
        sentType: "verse",
      },
      {
        id: "lsep25bs4",
        t: "나는 그때\n아무 이기지 못할 슬픔도 시름도 없이\n다만 게을리 먼 앞대로 떠나 나왔다\n그리하여 따사한 햇귀에서 하이얀 옷을 입고 매끄러운 밥을 먹고 단 샘을 마시고 낮잠을 잤다\n밤에는 먼 개소리에 놀라나고\n아침에는 지나가는 사람마다에게 절을 하면서도\n나는 나의 부끄러움을 알지 못했다",
        sentType: "verse",
      },
      {
        id: "lsep25bs5",
        t: "그동안 돌비는 깨어지고 많은 은금보화는 땅에 묻히고 가마귀도 긴 족보를 이루었는데\n이리하여 또 한 아득한 새 옛날이 비롯하는 때\n이제는 참으로 이기지 못할 슬픔과 시름에 쫓겨\n나는 나의 옛 하늘로 땅으로 나의 태반으로 돌아왔으나",
        sentType: "verse",
      },
      {
        id: "lsep25bs6",
        t: "이미 해는 늙고 달은 파리하고 바람은 미치고 보래구름만 혼자 넋 없이 떠도는데\n아, 나의 조상은 형제는 일가친척은 정다운 이웃은 그리운 것은 사랑하는 것은 우러르는 것은 나의 자랑은 나의 힘은 없다\n바람과 물과 세월과 같이 지나가고 없다",
        sentType: "verse",
      },
      {
        id: "lsep25bs7",
        t: "- 백석, 「북방에서 정현웅에게」-",
        sentType: "author",
      },
      { id: "lsep25bs8", t: "(나)", sentType: "workTag" },
      {
        id: "lsep25bs9",
        t: "겨울 아침 언 길을 걸어\n물가에 이르렀다\n나와 물고기 사이\n창이 하나 생겼다\n물고기네 지붕을 튼 살얼음의 창\n투명한 창 아래\n물고기네 방이 한눈에 훤했다",
        sentType: "verse",
      },
      {
        id: "lsep25bs10",
        t: "나의 생가 같았다\n창으로 나를 보고\n생가의 식구들이\n나를 못 알아보고\n사방 쪽방으로 흩어졌다\n젖을 갓 뗀 어린것들은\n찬 마루서 그냥저냥 그네끼리 놀고\n어미들은\n물속 쌓인 돌과 돌 그 틈새로\n그걸 깊은 데라고\n그걸 가장 깊은 속이라고 떼로 들어가\n나를 못 알아보고\n무슨 급한 궁리를 하느라\n그 비좁은 구석방에 빼곡히 서서",
        sentType: "verse",
      },
      {
        id: "lsep25bs11",
        t: "마음아, 너도 아직 이 생가에 살고 있는가\n시린 물속 시린 물고기의 눈을 달고",
        sentType: "verse",
      },
      {
        id: "lsep25bs12",
        t: "- 문태준, 「살얼음 아래 같은 데 2-생가(生家)」-",
        sentType: "author",
      },
      { id: "lsep25bs13", t: "(다)", sentType: "workTag" },
      {
        id: "lsep25bs14",
        t: "이문원 동쪽 늙은 나무가 있는데 적어도 백여 년은 된 것 같다. 그 몸통은 울퉁불퉁 옹이가 졌고 가지는 구불구불 뻗어서 멀찍이서 보면 가파른 산등성이나 성난 파도 같았고 다가가서 보면 둥그스름한 큰 집채 같았다. 기둥으로 나무를 받쳐 놓았는데 그 기둥이 모두 열두 개이다.",
        sentType: "body",
      },
      {
        id: "lsep25bs15",
        t: '하루는 내가 동료에게 다음과 같이 말했다.\n"이 나무는 정말 특이하군! 대체로 풀과 나무가 살아가려면 제각기 몸을 보전하는 계책이 있기 마련일세. 풀명자나 배, 귤이나 유자, 사과나 석류 같은 나무들은 열매가 커도 가지가 그 무게를 충분히 감당할 수 있다네. 하지만 질경이나 냉이, 강아지풀 같은 풀들은 살아가려면 땅바닥에 붙어 있어야 하네. 그래야 말발굽이 짓밟거나 수레가 밟고 지나가도 더 손상을 입지 않지. 지금 저 늙은 나무는 줄기의 길이가 몸통보다 갑절로 뻗어 사방에 드리워도 잘라 낼 줄 모르네. 만약 받쳐 주는 기둥이 없으면 부러지고야 말 걸세. 조물주가 이 나무에게는 사람의 손을 빌려 온전하도록 한 것인가?"',
        sentType: "body",
      },
      {
        id: "lsep25bs16",
        t: "아! 내가 암소의 뿔을 보니 뿔이 구부러져 안쪽으로 향했는데 심한 것은 사람이 반드시 톱으로 잘라 내야만 광대뼈를 뚫는 걱정을 모면하였다. 이제야 알겠구나. 늙은 나무를 가축에 견주자면 뿔을 잘라 내야 온전해질 수 있는 암소와 같다. 가축이 인간에게 의지하여 살아가듯이 늙은 나무도 인간에게 의지하여 살아간다. 나는 저 깊은 산중 인적 끊긴 골짜기에 이렇듯이 번성하게 자란 늙은 나무를 아직까지 보지 못했다.",
        sentType: "body",
      },
      {
        id: "lsep25bs17",
        t: "- 유본예, 「이문원노종기(摘文院老樹記)」-",
        sentType: "author",
      },
    ],
    vocab: [
      { word: "햇귀", mean: "해가 처음 솟을 때의 빛", sentId: "lsep25bs4" },
      { word: "돌비", mean: "돌로 만든 비석", sentId: "lsep25bs5" },
      {
        word: "계책",
        mean: "일을 이루기 위한 꾀나 방법",
        sentId: "lsep25bs15",
      },
    ],
  },
  {
    id: "lsep25d",
    title: "정철의 시조 / 조존성 호아곡",
    range: "32~34번",
    sents: [
      { id: "lsep25ds1", t: "(가)", sentType: "workTag" },
      {
        id: "lsep25ds2",
        t: "풍파에 일렁이던 배 어디로 갔단 말인가\n구름이 험하거늘 처음 나왔는가 어찌하여\n허술한 배 두신 분네는 모두 조심하소서",
        sentType: "verse",
      },
      { id: "lsep25ds3", t: "-정철의 시조-", sentType: "author" },
      { id: "lsep25ds4", t: "(나)", sentType: "workTag" },
      {
        id: "lsep25ds5",
        t: "심의산(深意山) 서너 바퀴 감돌아 휘돌아 들어\n오뉴월 한낮에 살얼음 엉긴 위에 된서리 섞어 치고 자취눈 내렸거늘 보았는가 임아 임아\n온 놈이 온 말을 하여도 임이 짐작하소서",
        sentType: "verse",
      },
      { id: "lsep25ds6", t: "-정철의 시조-", sentType: "author" },
      { id: "lsep25ds7", t: "(다)", sentType: "workTag" },
      {
        id: "lsep25ds8",
        t: "아이야 구럭 망태 찾아라 서쪽 산에 날 늦겠다\n밤 지낸 고사리 벌써 아니 자랐으랴\n이 몸이 이 나물 아니면 조석(朝夕) 어이 지내리 <제1수>",
        sentType: "verse",
      },
      {
        id: "lsep25ds9",
        t: "아이야 도롱이 삿갓 차려라 동쪽 시내에 비 내린다\n기나긴 낚싯대에 미늘 없는 낚시 매어\n저 고기 놀라지 마라 내 흥 겨워하노라 <제2수>",
        sentType: "verse",
      },
      {
        id: "lsep25ds10",
        t: "아이야 죽조반(粥早飯) 다오 남쪽 논밭에 일 많구나\n서투른 따비는 누구와 마주 잡을꼬\n두어라 성세궁경(聖世躬耕) 도 역군은(亦君恩)이시니라 <제3수>",
        sentType: "verse",
      },
      {
        id: "lsep25ds11",
        t: "아이야 소 먹여 내어라 북쪽 마을에서 새 술 먹자\n잔뜩 취한 얼굴을 달빛에 실어 오니\n어즈버 희황상인(羲皇上人)을 오늘 다시 보는구나 <제4수>",
        sentType: "verse",
      },
      { id: "lsep25ds12", t: "-조존성, 호아곡-", sentType: "author" },
      {
        id: "lsep25ds13",
        t: "*미늘: 고기가 물면 빠지지 않게 만든 낚시 끝의 안쪽에 있는 작은 갈고리.\n*따비: 풀뿌리를 뽑거나 밭을 가는 데 쓰는 농기구\n*성세궁경: 태평한 세월에 자기가 직접 농사를 지음.\n*희황상인: 세상일을 잊고 한가하고 태평하게 숨어 사는 사람을 이르는 말.",
        sentType: "footnote",
      },
    ],
    vocab: [
      {
        word: "미늘",
        mean: "낚시 끝 안쪽의 작은 갈고리",
        sentId: "lsep25ds13",
      },
      {
        word: "따비",
        mean: "풀뿌리 뽑거나 밭 가는 농기구",
        sentId: "lsep25ds13",
      },
      {
        word: "구럭",
        mean: "새끼 칡 등으로 엮어 만든 그릇",
        sentId: "lsep25ds8",
      },
      {
        word: "성세궁경(聖世躬耕)",
        mean: "태평한 세월에 직접 농사지음",
        sentId: "lsep25ds13",
      },
    ],
  },
];

// lsep25b, lsep25d 만 교체
targets.forEach(function (sid) {
  var idx = lit.findIndex(function (s) {
    return s.id === sid;
  });
  var n = newData.find(function (s) {
    return s.id === sid;
  });
  if (idx < 0 || !n) {
    console.log("WARN: not found - " + sid);
    return;
  }
  Object.assign(lit[idx], {
    title: n.title,
    range: n.range,
    sents: n.sents,
    vocab: n.vocab,
  });
  // questions는 기존 것 유지
  console.log("OK: " + sid + " sents:" + n.sents.length);
});

fs.writeFileSync(p, JSON.stringify(d, null, 2), "utf8");

// 검증
["lsep25a", "lsep25b", "lsep25c", "lsep25d"].forEach(function (id) {
  var s = lit.find(function (x) {
    return x.id === id;
  });
  console.log(
    id,
    "sents:",
    s?.sents?.length,
    "|",
    s?.sents?.slice(-1)[0]?.t?.slice(0, 30),
  );
});
console.log("Done");
