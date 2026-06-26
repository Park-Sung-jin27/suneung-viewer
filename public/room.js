(function(){
  "use strict";

  const STEMS = ["甲","乙","丙","丁","戊","己","庚","辛","壬","癸"];
  const STEMS_KO = ["갑","을","병","정","무","기","경","신","임","계"];
  const BRANCHES = ["子","丑","寅","卯","辰","巳","午","未","申","酉","戌","亥"];
  const BRANCHES_KO = ["자","축","인","묘","진","사","오","미","신","유","술","해"];
  const ELEM_BY_STEM = ["목","목","화","화","토","토","금","금","수","수"];
  const AXES = [
    { key:"speed", label:"다가가는 속도" },
    { key:"attraction", label:"친해지는 방식" },
    { key:"expression", label:"말 꺼내는 법" },
    { key:"stability", label:"편한 정도" },
    { key:"recovery", label:"다시 푸는 법" }
  ];
  const ELEMENT_COORDS = {
    목:{ label:"자라나는 결", teaser:"같이 배우고 넓히는 흐름에서 대화가 열립니다.", scores:{speed:68,attraction:70,expression:66,stability:56,recovery:58}, levels:{speed:"먼저 제안함",attraction:"새 얘기 좋아함",expression:"아이디어 냄",stability:"변화가 편함",recovery:"말로 풀림"} },
    화:{ label:"밝게 켜지는 결", teaser:"표현과 반응이 살아날 때 금세 가까워집니다.", scores:{speed:84,attraction:82,expression:78,stability:48,recovery:52}, levels:{speed:"먼저 가자는 쪽",attraction:"금세 친해짐",expression:"리액션 큼",stability:"온도 오르내림",recovery:"바로 풀어야 함"} },
    토:{ label:"천천히 쌓이는 결", teaser:"반복되는 태도와 약속에서 편해집니다.", scores:{speed:52,attraction:58,expression:52,stability:82,recovery:70}, levels:{speed:"천천히 확인",attraction:"익숙하면 편함",expression:"담백하게 말함",stability:"약속이 편함",recovery:"시간 지나 풀림"} },
    금:{ label:"선명한 기준의 결", teaser:"말과 행동이 맞을 때 신뢰가 생깁니다.", scores:{speed:62,attraction:64,expression:60,stability:76,recovery:56}, levels:{speed:"판단 빠른 편",attraction:"태도 먼저 봄",expression:"짧고 정확함",stability:"기준이 편함",recovery:"정리 후 풀림"} },
    수:{ label:"깊게 스미는 결", teaser:"재촉 없이 기다릴 때 마음이 깊어집니다.", scores:{speed:38,attraction:62,expression:44,stability:68,recovery:82}, levels:{speed:"천천히 스며듦",attraction:"천천히 친해짐",expression:"늦게 말함",stability:"편해야 열림",recovery:"혼자 쉬고 옴"} }
  };
  const BRANCH_ADJUST = {
    인:{speed:7,attraction:5}, 묘:{attraction:9,expression:4}, 사:{speed:8,expression:7}, 오:{speed:10,attraction:7},
    신:{expression:5,stability:4}, 유:{stability:7,expression:3}, 자:{recovery:9,speed:-4}, 해:{recovery:8,attraction:3},
    축:{stability:7,recovery:3}, 미:{stability:5,recovery:4}, 진:{stability:6,speed:-2}, 술:{stability:7,recovery:-2}
  };
  const LUNAR_INFO = [
    0x04bd8,0x04ae0,0x0a570,0x054d5,0x0d260,0x0d950,0x16554,0x056a0,0x09ad0,0x055d2,
    0x04ae0,0x0a5b6,0x0a4d0,0x0d250,0x1d255,0x0b540,0x0d6a0,0x0ada2,0x095b0,0x14977,
    0x04970,0x0a4b0,0x0b4b5,0x06a50,0x06d40,0x1ab54,0x02b60,0x09570,0x052f2,0x04970,
    0x06566,0x0d4a0,0x0ea50,0x06e95,0x05ad0,0x02b60,0x186e3,0x092e0,0x1c8d7,0x0c950,
    0x0d4a0,0x1d8a6,0x0b550,0x056a0,0x1a5b4,0x025d0,0x092d0,0x0d2b2,0x0a950,0x0b557,
    0x06ca0,0x0b550,0x15355,0x04da0,0x0a5b0,0x14573,0x052b0,0x0a9a8,0x0e950,0x06aa0,
    0x0aea6,0x0ab50,0x04b60,0x0aae4,0x0a570,0x05260,0x0f263,0x0d950,0x05b57,0x056a0,
    0x096d0,0x04dd5,0x04ad0,0x0a4d0,0x0d4d4,0x0d250,0x0d558,0x0b540,0x0b6a0,0x195a6,
    0x095b0,0x049b0,0x0a974,0x0a4b0,0x0b27a,0x06a50,0x06d40,0x0af46,0x0ab60,0x09570,
    0x04af5,0x04970,0x064b0,0x074a3,0x0ea50,0x06b58,0x055c0,0x0ab60,0x096d5,0x092e0,
    0x0c960,0x0d954,0x0d4a0,0x0da50,0x07552,0x056a0,0x0abb7,0x025d0,0x092d0,0x0cab5,
    0x0a950,0x0b4a0,0x0baa4,0x0ad50,0x055d9,0x04ba0,0x0a5b0,0x15176,0x052b0,0x0a930,
    0x07954,0x06aa0,0x0ad50,0x05b52,0x04b60,0x0a6e6,0x0a4e0,0x0d260,0x0ea65,0x0d530,
    0x05aa0,0x076a3,0x096d0,0x04afb,0x04ad0,0x0a4d0,0x1d0b6,0x0d250,0x0d520,0x0dd45,
    0x0b5a0,0x056d0,0x055b2,0x049b0,0x0a577,0x0a4b0,0x0aa50,0x1b255,0x06d20,0x0ada0,
    0x14b63,0x09370,0x049f8,0x04970,0x064b0,0x168a6,0x0ea50,0x06b20,0x1a6c4,0x0aae0,
    0x0a2e0,0x0d2e3,0x0c960,0x0d557,0x0d4a0,0x0da50,0x05d55,0x056a0,0x0a6d0,0x055d4,
    0x052d0,0x0a9b8,0x0a950,0x0b4a0,0x0b6a6,0x0ad50,0x055a0,0x0aba4,0x0a5b0,0x052b0,
    0x0b273,0x06930,0x07337,0x06aa0,0x0ad50,0x14b55,0x04b60,0x0a570,0x054e4,0x0d160,
    0x0e968,0x0d520,0x0daa0,0x16aa6,0x056d0,0x04ae0,0x0a9d4,0x0a2d0,0x0d150,0x0f252,
    0x0d520
  ];

  const $ = (id) => document.getElementById(id);
  const state = { room:null, code:getRoomCode(), participantId:null };

  function clamp(n,min,max){ return Math.max(min, Math.min(max, Number(n)||0)); }
  function normalizeDate(value){
    const digits = String(value || "").replace(/\D/g, "").slice(0, 8);
    const y = digits.slice(0, 4), m = digits.slice(4, 6), d = digits.slice(6, 8);
    if(d) return y + "-" + m + "-" + d;
    if(m) return y + "-" + m;
    return y;
  }
  function parseDate(value){
    const formatted = normalizeDate(value);
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(formatted);
    if(!match) return null;
    const y=Number(match[1]), m=Number(match[2]), d=Number(match[3]);
    const dt = new Date(Date.UTC(y,m-1,d));
    if(dt.getUTCFullYear()!==y || dt.getUTCMonth()+1!==m || dt.getUTCDate()!==d) return null;
    return { y,m,d,formatted };
  }
  function leapMonthOf(y){ return LUNAR_INFO[y-1900] & 0xf; }
  function leapDays(y){ const lm=leapMonthOf(y); return lm ? ((LUNAR_INFO[y-1900] & 0x10000) ? 30 : 29) : 0; }
  function lunarMonthDays(y,m){ return (LUNAR_INFO[y-1900] & (0x10000 >> m)) ? 30 : 29; }
  function lunarYearDays(y){
    let sum=348, info=LUNAR_INFO[y-1900];
    for(let i=0x8000;i>0x8;i>>=1) sum += (info & i) ? 1 : 0;
    return sum + leapDays(y);
  }
  function lunarToSolar(ly,lm,ld){
    if(ly<1900 || ly>2100) throw new Error("1900~2100년 사이만 지원합니다.");
    let offset=0;
    for(let y=1900;y<ly;y++) offset += lunarYearDays(y);
    const leap=leapMonthOf(ly);
    for(let m=1;m<lm;m++) offset += lunarMonthDays(ly,m);
    if(leap && lm>leap) offset += leapDays(ly);
    const d = new Date(Date.UTC(1900,0,31) + (offset + ld - 1) * 86400000);
    return { y:d.getUTCFullYear(), m:d.getUTCMonth()+1, d:d.getUTCDate() };
  }
  function dayPillar(y,m,d){
    const a=Math.floor((14-m)/12), yy=y+4800-a, mm=m+12*a-3;
    const jdn=d+Math.floor((153*mm+2)/5)+365*yy+Math.floor(yy/4)-Math.floor(yy/100)+Math.floor(yy/400)-32045;
    const idx=(jdn+49)%60, stem=idx%10, branch=idx%12;
    return { stem:STEMS[stem], branch:BRANCHES[branch], stemKo:STEMS_KO[stem], branchKo:BRANCHES_KO[branch], element:ELEM_BY_STEM[stem] };
  }
  function hourPillar(dayStemIndex, time){
    if(!time) return null;
    const hour = Number(String(time).split(":")[0]);
    if(Number.isNaN(hour)) return null;
    const branchIndex = Math.floor((hour + 1) / 2) % 12;
    const stemIndex = ((dayStemIndex % 5) * 2 + branchIndex) % 10;
    return { stem:STEMS[stemIndex], branch:BRANCHES[branchIndex], stemKo:STEMS_KO[stemIndex], branchKo:BRANCHES_KO[branchIndex] };
  }
  function profileCoordinates(pillar, hour){
    const base = ELEMENT_COORDS[pillar.element] || ELEMENT_COORDS.토;
    const scores = { ...base.scores };
    const levels = { ...base.levels };
    const adj = hour ? BRANCH_ADJUST[hour.branchKo] : null;
    if(adj){
      Object.keys(adj).forEach((key) => { scores[key] = clamp((scores[key] || 56) + adj[key], 24, 90); });
      if(hour.branchKo==="사" || hour.branchKo==="오") levels.expression = "말이 잘 나옴";
      if(hour.branchKo==="자" || hour.branchKo==="해") levels.recovery = "혼자 쉬고 옴";
      if(hour.branchKo==="유" || hour.branchKo==="신") levels.stability = "기준이 또렷";
      if(hour.branchKo==="묘") levels.attraction = "말이 부드러움";
    }
    return {
      element:pillar.element,
      dayPillar:pillar.stemKo + pillar.branchKo + "(" + pillar.stem + pillar.branch + ")",
      hourPillar:hour ? hour.stemKo + hour.branchKo + "(" + hour.stem + hour.branch + ")" : "생시 미입력",
      teaser:base.teaser,
      axes:AXES.map((axis) => ({ key:axis.key, label:axis.label, score:clamp(scores[axis.key],24,90), level:levels[axis.key] || "중간" }))
    };
  }
  function readFormProfile(){
    const parsed = parseDate($("birthDate").value);
    if(!parsed) throw new Error("생년월일은 1999-09-09처럼 입력해 주세요.");
    $("birthDate").value = parsed.formatted;
    const solar = $("calendar").value === "lunar" ? lunarToSolar(parsed.y, parsed.m, parsed.d) : parsed;
    const pillar = dayPillar(solar.y, solar.m, solar.d);
    const hour = hourPillar(STEMS.indexOf(pillar.stem), $("birthTime").value);
    return profileCoordinates(pillar, hour);
  }
  function participantId(){
    const key = state.code ? "jippi-inyeon-id-" + state.code : "jippi-inyeon-id-new";
    const existing = localStorage.getItem(key);
    if(existing) return existing;
    const id = (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36)).slice(0, 36);
    localStorage.setItem(key, id);
    return id;
  }
  function getRoomCode(){
    const match = /^\/room\/([A-Z0-9]{6})/i.exec(location.pathname);
    return match ? match[1].toUpperCase() : "";
  }
  async function api(path, options){
    const method = String(options?.method || "GET").toUpperCase();
    const url = method === "GET" ? path + (path.includes("?") ? "&" : "?") + "t=" + Date.now() : path;
    const res = await fetch(url, { cache:"no-store", headers:{ "content-type":"application/json" }, ...options });
    const data = await res.json().catch(() => ({}));
    if(!res.ok || !data.ok) throw new Error(data.error || "요청을 처리하지 못했습니다.");
    return data.room;
  }
  function setStatus(text){ $("statusText").textContent = text || ""; }
  function roomUrl(code){ return location.origin + "/room/" + code; }
  function setupMode(){
    if(state.code){
      $("formTitle").textContent = "이 방에 참여하기";
      $("formDesc").textContent = "내 정보를 넣으면 방 친구들과의 케미 카드가 바로 열립니다.";
      $("submitBtn").textContent = "내 케미 보기";
    }
  }
  function showShare(code){
    const url = roomUrl(code);
    $("roomLinkBox").classList.remove("hidden");
    $("roomLinkBox").textContent = url;
    $("shareRow").classList.remove("hidden");
  }
  async function copyUrl(url,message){
    try {
      await navigator.clipboard.writeText(url);
      setStatus(message || "방 링크를 복사했어요.");
    } catch(e) {
      prompt("방 링크를 복사해 주세요.", url);
    }
  }
  async function copyRoomLink(){
    const code = state.room?.code || state.code;
    if(!code) return;
    await copyUrl(roomUrl(code));
  }
  function canOpenNativeShare(data){
    if(typeof navigator.share !== "function") return false;
    if(typeof navigator.canShare !== "function") return true;
    try { return navigator.canShare(data); } catch(e) { return false; }
  }
  async function shareRoom(){
    const code = state.room?.code || state.code;
    if(!code) return;
    const url = roomUrl(code);
    const shareData = {
      title:"JIPPI 단톡 케미 무료로 알아보기",
      text:"나랑 어떤 결로 통하는지 봐줘.",
      url
    };
    if(canOpenNativeShare(shareData)){
      try {
        await navigator.share(shareData);
        setStatus("공유창을 열었어요.");
        return;
      } catch(e) {
        if(e?.name === "AbortError") {
          setStatus("공유를 취소했어요.");
          return;
        }
        console.warn("[JIPPI room] native share failed", e);
      }
    }
    await copyUrl(url, "이 브라우저에서는 공유창을 열 수 없어 링크를 복사했어요. 모바일 크롬이나 사파리에서는 앱 공유창이 열립니다.");
  }
  function coordPoint(index,total,score,radius,cx,cy){
    const angle = Math.PI * 2 * index / total - Math.PI / 2;
    const r = radius * clamp(score,0,100) / 100;
    return { x:cx + Math.cos(angle)*r, y:cy + Math.sin(angle)*r };
  }
  function radar(a,b){
    const cx=82, cy=82, radius=56, colors=["#f1c987","#a9d7bf"];
    const rings=[33,66,100].map((level)=>"<polygon points=\"" + AXES.map((_,i)=>{ const p=coordPoint(i,AXES.length,level,radius,cx,cy); return p.x.toFixed(1)+","+p.y.toFixed(1); }).join(" ") + "\" fill=\"none\" stroke=\"rgba(241,201,135,.25)\"/>").join("");
    const polys=[a,b].map((person,pi)=>"<polygon points=\"" + person.profile.axes.map((axis,i)=>{ const p=coordPoint(i,person.profile.axes.length,axis.score,radius,cx,cy); return p.x.toFixed(1)+","+p.y.toFixed(1); }).join(" ") + "\" fill=\"" + colors[pi] + "\" fill-opacity=\".16\" stroke=\"" + colors[pi] + "\" stroke-width=\"2.2\"/>").join("");
    const labels=AXES.map((axis,i)=>{ const p=coordPoint(i,AXES.length,123,radius,cx,cy); return "<text x=\"" + p.x.toFixed(1) + "\" y=\"" + (p.y+3).toFixed(1) + "\" text-anchor=\"middle\" font-size=\"11\" font-weight=\"900\" fill=\"#ffe8c8\">" + axis.label.replace(/\s/g,"") + "</text>"; }).join("");
    return "<svg viewBox=\"0 0 164 164\" role=\"img\" aria-label=\"케미 레이더\">" + rings + polys + labels + "<circle cx=\"82\" cy=\"82\" r=\"2.8\" fill=\"#f1c987\"/></svg>";
  }
  function hourBranchKoFromProfile(profile){
    const match = /^([갑을병정무기경신임계])([자축인묘진사오미신유술해])/.exec(String(profile?.hourPillar || ""));
    return match ? match[2] : "";
  }
  function displayLevels(profile){
    const base = ELEMENT_COORDS[profile?.element] || ELEMENT_COORDS.토;
    const levels = { ...base.levels };
    const branchKo = hourBranchKoFromProfile(profile);
    if(branchKo==="사" || branchKo==="오") levels.expression = "말이 잘 나옴";
    if(branchKo==="자" || branchKo==="해") levels.recovery = "혼자 쉬고 옴";
    if(branchKo==="유" || branchKo==="신") levels.stability = "기준이 또렷";
    if(branchKo==="묘") levels.attraction = "말이 부드러움";
    return levels;
  }
  function axis(profile,key){
    const item = (profile?.axes || []).find((axisItem)=>axisItem.key===key) || { score:56, level:"중간" };
    return { ...item, level:displayLevels(profile)[key] || item.level || "중간" };
  }
  function hasFinalConsonant(value){
    const chars = String(value || "").trim();
    const ch = chars.charCodeAt(chars.length - 1);
    if(ch < 0xac00 || ch > 0xd7a3) return false;
    return (ch - 0xac00) % 28 !== 0;
  }
  function personName(person){
    return String(person?.name || "한 명").trim().slice(0, 20) || "한 명";
  }
  function topic(person){
    const name = personName(person);
    return name + (hasFinalConsonant(name) ? "은" : "는");
  }
  function subject(person){
    const name = personName(person);
    return name + (hasFinalConsonant(name) ? "이" : "가");
  }
  function roleByScore(a,b,key,high=true){
    const av = axis(a.profile,key).score;
    const bv = axis(b.profile,key).score;
    if(av === bv) return high ? a : b;
    return high ? (av > bv ? a : b) : (av < bv ? a : b);
  }
  const CHEM_KEYS = ["speed","attraction","expression","stability","recovery"];
  function axisValue(person,key){ return axis(person.profile,key).score; }
  function axisGapFor(a,b,key){ return Math.abs(axisValue(a,key) - axisValue(b,key)); }
  function axisAvgFor(a,b,key){ return (axisValue(a,key) + axisValue(b,key)) / 2; }
  function secondaryKey(a,b,skip=[]){
    const skipped = new Set(skip);
    return CHEM_KEYS
      .filter((key)=>!skipped.has(key))
      .map((key,index)=>({
        key,
        index,
        gap:axisGapFor(a,b,key),
        edge:Math.abs(axisAvgFor(a,b,key)-60)
      }))
      .sort((x,y)=>y.gap-x.gap || y.edge-x.edge || x.index-y.index)[0].key;
  }
  function elementFlavor(person){
    const flavors = {
      목:"얘깃거리를 잘 여는 쪽",
      화:"분위기를 먼저 밝히는 쪽",
      토:"자리를 편하게 잡는 쪽",
      금:"기준을 딱 잡는 쪽",
      수:"조용히 오래 보는 쪽"
    };
    return flavors[person?.profile?.element] || "자기 결이 분명한 쪽";
  }
  function topAxis(person){
    return CHEM_KEYS
      .map((key,index)=>({
        key,
        index,
        score:axisValue(person,key),
        edge:Math.abs(axisValue(person,key)-60)
      }))
      .sort((x,y)=>y.score-x.score || y.edge-x.edge || x.index-y.index)[0]?.key || "stability";
  }
  function hashText(value){
    let hash=2166136261;
    String(value || "").split("").forEach((ch)=>{
      hash ^= ch.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    });
    return hash >>> 0;
  }
  function pickByHash(list,hash,offset=0){
    return list[(hash + offset) % list.length];
  }
  function signaturePhrase(person){
    const element = person?.profile?.element || "토";
    const key = topAxis(person);
    const elementPhrases = {
      목:["할 얘기를 잘 찾는","새로운 걸 잘 꺼내는","얘기를 잘 넓히는"],
      화:["반응이 빠른","표정이 잘 보이는","먼저 웃는"],
      토:["편한 자리를 만드는","차분하게 맞추는","믿고 앉게 하는"],
      금:["기준이 또렷한","말을 깔끔하게 하는","선이 분명한"],
      수:["천천히 보는","분위기를 잘 읽는","말은 적어도 오래 보는"]
    };
    const axisPhrases = {
      speed:["먼저 움직이는","약속을 빨리 잡는","일단 해보는"],
      attraction:["재밌는 걸 잘 찾는","얘깃거리를 잘 줍는","같이 놀 틈을 보는"],
      expression:["리액션이 잘 보이는","말이 잘 나오는","반응이 또렷한"],
      stability:["같이 있어도 편한","차분히 맞추는","오래 있어도 편한"],
      recovery:["쉬고 다시 오는","다시 말 붙이는","시간 두고 푸는"]
    };
    const seed = [
      personName(person),
      element,
      key,
      person?.profile?.dayPillar || "",
      person?.profile?.hourPillar || ""
    ].join("|");
    const hash = hashText(seed);
    const first = pickByHash(elementPhrases[element] || elementPhrases.토, hash);
    const second = pickByHash(axisPhrases[key] || axisPhrases.stability, Math.floor(hash / 7));
    return first === second ? first : first + ", " + second;
  }
  function signatureLead(person){
    return topic(person) + " " + signaturePhrase(person) + " 쪽이에요.";
  }
  function signaturePoint(person){
    const key = topAxis(person);
    const phrases = {
      speed:[
        "약속이 생각보다 빨리 잡혀요.",
        "말하다 보면 어느새 시간이 정해져요.",
        "먼저 하자는 말이 빨리 나오는 편이에요."
      ],
      attraction:[
        "사진 하나, 메뉴 하나로 얘기가 다시 살아나요.",
        "같이 있으면 할 얘기가 옆으로 잘 새요.",
        "재밌는 포인트를 툭툭 잘 주워요."
      ],
      expression:[
        "리액션이 보여야 더 잘 굴러가요.",
        "표정이 살아 있어서 분위기 읽기가 쉬워요.",
        "짧은 반응 하나가 분위기를 살려요."
      ],
      stability:[
        "같이 있어도 힘이 덜 빠지는 쪽.",
        "급하게 안 굴려도 편한 쪽.",
        "앉아 있는 시간이 길어도 덜 어색해요."
      ],
      recovery:[
        "조금 쉬면 다시 말 붙는 쪽.",
        "잠깐 끊겨도 다시 이어붙일 수 있어요.",
        "식었다가도 톡 하나로 돌아오는 편."
      ]
    };
    const seed = [
      personName(person),
      key,
      person?.profile?.element || "",
      person?.profile?.dayPillar || "",
      person?.profile?.hourPillar || "",
      "point"
    ].join("|");
    return pickByHash(phrases[key] || phrases.stability, hashText(seed));
  }
  function speedSide(person){
    const score = axisValue(person,"speed");
    if(score >= 70) return "뭐든 일단 하자는 쪽";
    if(score <= 46) return "한 번 더 생각하고 가는 쪽";
    return "상황 보고 움직이는 쪽";
  }
  function friendlySide(person){
    const score = axisValue(person,"attraction");
    if(score >= 72) return "재밌는 걸 빨리 찾는 쪽";
    if(score <= 56) return "편한지 먼저 보는 쪽";
    return "천천히 친해지는 쪽";
  }
  function expressionSide(person){
    const score = axisValue(person,"expression");
    if(score >= 70) return "반응이 바로 보이는 쪽";
    if(score <= 50) return "말을 아껴서 하는 쪽";
    return "필요할 때 말하는 쪽";
  }
  function stabilitySide(person){
    const score = axisValue(person,"stability");
    if(score >= 74) return "약속이 잡히면 편한 쪽";
    if(score <= 54) return "그때그때 맞추는 쪽";
    return "적당히 맞춰가는 쪽";
  }
  function recoverySide(person){
    const score = axisValue(person,"recovery");
    if(score >= 72) return "조금 쉬고 다시 말하는 쪽";
    if(score <= 56) return "바로 풀고 싶은 쪽";
    return "짧게 확인하면 풀리는 쪽";
  }
  function secondaryDetail(key,a,b){
    if(key==="speed"){
      const fast=roleByScore(a,b,"speed",true), slow=roleByScore(a,b,"speed",false);
      return {
        label:"템포차",
        line:topic(fast) + " 먼저 하자는 말이 빠르고, " + topic(slow) + " 시간이나 상황을 한 번 더 봐요.",
        point:"약속 잡을 때 이 차이가 잘 보여요. 먼저 말한 쪽이 조금만 기다리면 편해져요."
      };
    }
    if(key==="expression"){
      const loud=roleByScore(a,b,"expression",true), quiet=roleByScore(a,b,"expression",false);
      return {
        label:"말투차",
        line:topic(loud) + " 반응이 바로 보이고, " + topic(quiet) + " 짧게 말해도 필요한 말은 해요.",
        point:"단톡에서는 한 명이 말을 열고, 한 명이 짧게 받아주면 잘 굴러가요."
      };
    }
    if(key==="recovery"){
      const quick=roleByScore(a,b,"recovery",false), slow=roleByScore(a,b,"recovery",true);
      return {
        label:"푸는 방식차",
        line:"뭔가 살짝 엇갈리면 " + topic(quick) + " 바로 말하고 싶고, " + topic(slow) + " 조금 있다가 말이 나와요.",
        point:"서두르지 말고 짧게 확인하면 다시 말 붙기 쉬워요."
      };
    }
    if(key==="stability"){
      const anchor=roleByScore(a,b,"stability",true), mover=roleByScore(a,b,"stability",false);
      return {
        label:"자리감차",
        line:topic(anchor) + " 시간과 장소가 정해지면 편하고, " + topic(mover) + " 그 안에서 바꿀 수 있는 걸 좋아해요.",
        point:"먼저 큰 틀만 잡아두면 둘 다 훨씬 편해져요."
      };
    }
    const spark=roleByScore(a,b,"attraction",true), steady=roleByScore(a,b,"attraction",false);
    return {
      label:"친해지는 결차",
      line:subject(spark) + " 재밌는 걸 먼저 찾고, " + subject(steady) + " 그게 편한지도 같이 봐요.",
      point:"새로운 걸 하더라도 너무 무리하지 않으면 잘 맞아요."
    };
  }
  function defaultPointByElement(a,b){
    return topic(a) + " " + elementFlavor(a) + ", " + topic(b) + " " + elementFlavor(b) + "이라 똑같은 자리에서도 보는 포인트가 달라요.";
  }
  function chem(a,b){
    const pa=a.profile, pb=b.profile;
    const speedGap=Math.abs(axis(pa,"speed").score - axis(pb,"speed").score);
    const speedAvg=(axis(pa,"speed").score + axis(pb,"speed").score)/2;
    const stabilityAvg=(axis(pa,"stability").score + axis(pb,"stability").score)/2;
    const stabilityGap=Math.abs(axis(pa,"stability").score - axis(pb,"stability").score);
    const attractionAvg=(axis(pa,"attraction").score + axis(pb,"attraction").score)/2;
    const attractionGap=Math.abs(axis(pa,"attraction").score - axis(pb,"attraction").score);
    const expressionGap=Math.abs(axis(pa,"expression").score - axis(pb,"expression").score);
    const recoveryGap=Math.abs(axis(pa,"recovery").score - axis(pb,"recovery").score);
    const recoveryAvg=(axis(pa,"recovery").score + axis(pb,"recovery").score)/2;
    let label="잔잔한데 은근 붙는 사이";
    let line=topic(a) + " " + friendlySide(a) + "이고, " + topic(b) + " " + friendlySide(b) + "이에요. 처음부터 확 붙진 않아도 같이 있으면 편해지는 사이예요.";
    let point="크게 뭘 하지 않아도 자주 마주치면 자연스럽게 가까워져요.";
    if(speedGap>=28){
      const fast=roleByScore(a,b,"speed",true), slow=roleByScore(a,b,"speed",false);
      const second=secondaryKey(a,b,["speed"]);
      const detail=secondaryDetail(second,a,b);
      if(second==="expression") label="한 명은 빠르고 한 명은 차분한 사이";
      else if(second==="recovery") label="속도가 달라도 풀 수 있는 사이";
      else if(second==="stability") label="바로 가는 쪽과 확인하는 쪽";
      else if(second==="attraction") label="먼저 가자는 쪽과 자리 보는 쪽";
      else label="속도가 달라도 맞출 수 있는 사이";
      line=topic(fast) + " " + speedSide(fast) + "이고, " + topic(slow) + " " + speedSide(slow) + "이에요. 그래서 " + subject(fast) + " 앞서가면 " + subject(slow) + " 맞춰야 할 때도 있는데, " + subject(fast) + " 조금만 기다려주면 둘이 맞아요.";
      point=signaturePoint(b) + " " + detail.point;
    } else if(attractionAvg>=74){
      const second=secondaryKey(a,b,["attraction"]);
      const detail=secondaryDetail(second,a,b);
      if(second==="expression") label="앉자마자 받아치는 사이";
      else if(second==="speed") label="말 붙고 바로 움직이는 사이";
      else if(second==="recovery") label="웃다가 각자 식히는 사이";
      else if(second==="stability") label="재밌는데 자리도 잡는 사이";
      else label="앉자마자 말 붙는 사이";
      line=topic(a) + " " + friendlySide(a) + "이고, " + topic(b) + " " + friendlySide(b) + "이에요. 둘 다 얘기가 붙는 속도가 빨라서, 메뉴 고르다가도 다른 얘기로 금방 넘어가요.";
      point=signaturePoint(b) + " " + detail.point;
    } else if(stabilityAvg>=74){
      const second=secondaryKey(a,b,["stability"]);
      const detail=secondaryDetail(second,a,b);
      if(second==="expression") label="조용한데 한마디가 정확한 사이";
      else if(second==="recovery") label="뜸해도 다시 이어지는 사이";
      else if(second==="speed") label="느긋한데 템포는 다른 사이";
      else if(second==="attraction") label="편해서 자꾸 앉게 되는 사이";
      else label="자주 안 봐도 편한 사이";
      line=topic(a) + " " + stabilitySide(a) + "이고, " + topic(b) + " " + stabilitySide(b) + "이에요. 막 매일 연락하지 않아도 서로 불편하지 않고, 오랜만에 봐도 다시 이어지기 쉬워요.";
      point=signaturePoint(b) + " 약속을 너무 빡빡하게 잡기보다 편하게 열어두면 좋아요.";
    } else if(expressionGap>=22){
      const loud=roleByScore(a,b,"expression",true), quiet=roleByScore(a,b,"expression",false);
      const second=secondaryKey(a,b,["expression"]);
      const detail=secondaryDetail(second,a,b);
      if(second==="speed") label="말투와 속도를 맞추는 사이";
      else if(second==="recovery") label="말 많은 쪽과 묵히는 쪽";
      else if(second==="stability") label="리액션과 기준선이 만나는 사이";
      else if(second==="attraction") label="표현은 다른데 장면은 같이 줍는 사이";
      else label="말 많은 쪽과 조용한 쪽";
      line=topic(loud) + " " + expressionSide(loud) + "이고, " + topic(quiet) + " " + expressionSide(quiet) + "이에요. " + personName(loud) + "이 먼저 말을 열어주고, " + personName(quiet) + "이 짧게 받아주면 대화가 편해져요.";
      point=signaturePoint(b) + " 말 많은 쪽이 기다려주면 조용한 쪽도 필요한 말은 해요.";
    } else if(recoveryGap>=24){
      const quick=roleByScore(a,b,"recovery",false), slow=roleByScore(a,b,"recovery",true);
      const second=secondaryKey(a,b,["recovery"]);
      const detail=secondaryDetail(second,a,b);
      if(second==="expression") label="바로 말하기와 늦게 정리하기 사이";
      else if(second==="speed") label="빨리 풀고 천천히 따라오는 사이";
      else if(second==="stability") label="툭 풀고 다시 자리 잡는 사이";
      else if(second==="attraction") label="엇갈려도 다시 재밌어지는 사이";
      else label="바로 푸는 쪽과 기다리는 쪽";
      line=topic(quick) + " " + recoverySide(quick) + "이고, " + topic(slow) + " " + recoverySide(slow) + "이에요. 그래서 뭔가 걸렸을 때 바로 답을 재촉하기보다, 조금 시간을 두면 다시 말이 이어져요.";
      point=signaturePoint(b) + " 짧게 '나중에 얘기하자'만 남겨도 서로 덜 불편해요.";
    } else if(speedAvg>=72){
      const second=secondaryKey(a,b,["speed"]);
      const detail=secondaryDetail(second,a,b);
      if(second==="expression") label="번개에 리액션까지 빠른 사이";
      else if(second==="stability") label="즉흥인데 은근 질서 있는 사이";
      else if(second==="recovery") label="빨리 모이고 빨리 푸는 사이";
      else if(second==="attraction") label="가자마자 새 장면 찾는 사이";
      else label="번개가 번개를 부르는 사이";
      line=topic(a) + " " + speedSide(a) + "이고, " + topic(b) + " " + speedSide(b) + "이에요. 둘 다 움직임이 빨라서 '잠깐 볼래?'가 진짜 약속이 되기 쉬워요.";
      point=signaturePoint(b) + " 대신 일정만 한 번 확인해두면 더 편하게 만나요.";
    } else if(speedAvg<=48 && recoveryAvg>=72){
      const second=secondaryKey(a,b,["speed","recovery"]);
      const detail=secondaryDetail(second,a,b);
      if(second==="expression") label="말은 적어도 이어지는 사이";
      else if(second==="stability") label="각자 잘 사는데 자리 잡힌 사이";
      else if(second==="attraction") label="조용한데 장면은 기억나는 사이";
      else label="각자 잘 사는데 묘하게 안 끊기는 사이";
      line=topic(a) + " " + speedSide(a) + "이고, " + topic(b) + " " + speedSide(b) + "이에요. 둘 다 자주 확인하지 않아도 한 번 이어진 얘기는 오래 남는 편이에요.";
      point=signaturePoint(b) + " 가끔 사진 하나나 짧은 안부만 던져도 다시 이어져요.";
    } else if(stabilityGap>=22){
      const anchor=roleByScore(a,b,"stability",true), mover=roleByScore(a,b,"stability",false);
      const second=secondaryKey(a,b,["stability"]);
      const detail=secondaryDetail(second,a,b);
      if(second==="expression") label="약속 잡고 말맛 살리는 사이";
      else if(second==="speed") label="자리 잡고 움직임 넣는 사이";
      else if(second==="recovery") label="흔들려도 다시 앉는 사이";
      else if(second==="attraction") label="기준과 재미가 같이 있는 사이";
      else label="자리 잡는 쪽과 바꾸는 쪽";
      line=topic(anchor) + " " + stabilitySide(anchor) + "이고, " + topic(mover) + " " + stabilitySide(mover) + "이에요. 먼저 시간과 장소만 정해두면, 그 안에서 뭘 할지는 자연스럽게 맞출 수 있어요.";
      point=signaturePoint(b) + " 큰 틀은 잡고, 세부 계획은 가볍게 두면 좋아요.";
    } else if(attractionGap>=22){
      const spark=roleByScore(a,b,"attraction",true), steady=roleByScore(a,b,"attraction",false);
      const second=secondaryKey(a,b,["attraction"]);
      const detail=secondaryDetail(second,a,b);
      if(second==="expression") label="장면 줍고 말맛 살리는 사이";
      else if(second==="speed") label="재미 찾는 속도가 다른 사이";
      else if(second==="recovery") label="다르게 놀고 다르게 쉬는 사이";
      else if(second==="stability") label="분위기와 기준이 같이 앉는 사이";
      else label="분위기 줍는 쪽과 기준 보는 쪽";
      line=topic(spark) + " " + friendlySide(spark) + "이고, " + topic(steady) + " " + friendlySide(steady) + "이에요. 그래서 새로 해보는 것도 좋지만, 둘 다 편한 선을 같이 봐야 오래 편해요.";
      point=signaturePoint(b) + " 새로운 걸 고를 땐 장소나 시간은 무리 없게 잡는 게 좋아요.";
    }
    line = signatureLead(b) + " " + line;
    const distinct = Math.round(speedGap + expressionGap + recoveryGap + Math.abs(stabilityAvg-60) + Math.abs(attractionAvg-60));
    return { label,line,point,score:distinct };
  }
  function normalizeCardText(text,me,other){
    return String(text || "")
      .split(personName(me)).join("나")
      .split(personName(other)).join("상대");
  }
  function warnDuplicateCards(cards,me){
    const seen = new Map();
    cards.forEach((item)=>{
      const key = [
        item.data.label,
        normalizeCardText(item.data.line,me,item.other),
        normalizeCardText(item.data.point,me,item.other)
      ].join("|");
      const names = seen.get(key) || [];
      names.push(item.other.name);
      seen.set(key,names);
    });
    const duplicates = Array.from(seen.entries()).filter(([,names])=>names.length>1);
    if(duplicates.length) console.warn("[JIPPI room] duplicate chemistry cards", duplicates.map(([key,names])=>({ key, names })));
  }
  function renderRoom(){
    const room=state.room;
    if(!room) return;
    const people=room.participants || [];
    $("resultSection").classList.remove("hidden");
    $("roomSummary").textContent = people.length + "명이 들어왔어요. 각 쌍의 다른 결을 따로 보여드립니다.";
    $("peopleList").innerHTML = people.map((p)=>"<span class=\"chip\">" + escapeHtml(p.name) + " · " + escapeHtml(p.profile.dayPillar || p.profile.element) + "</span>").join("");
    showShare(room.code);
    const myId = state.participantId || localStorage.getItem("jippi-inyeon-id-" + room.code) || "";
    const me = people.find((p)=>p.id===myId) || people[0];
    const others = people.filter((p)=>p.id!==me?.id);
    if(!me || !others.length){
      $("highlightBox").classList.add("hidden");
      $("chemGrid").innerHTML = "<div class=\"chem-card\"><div class=\"names\">아직 친구를 기다리는 중</div><p style=\"margin-top:10px\">방 링크를 단톡방에 보내면 친구들이 들어와 케미 카드가 열립니다.</p></div>";
      return;
    }
    const cards = others.map((other)=>({ other, data:chem(me,other) })).sort((a,b)=>b.data.score-a.data.score);
    warnDuplicateCards(cards,me);
    const top = cards.slice(0,2).map((item)=>escapeHtml(me.name) + " ↔ " + escapeHtml(item.other.name) + " = " + escapeHtml(item.data.label)).join(" · ");
    $("highlightBox").classList.remove("hidden");
    $("highlightBox").innerHTML = "<b>이 방에서 눈에 띄는 결</b><br>" + top;
    $("chemGrid").innerHTML = cards.map((item)=>cardHtml(me,item.other,item.data)).join("");
  }
  function cardHtml(a,b,data){
    const axes = AXES.slice(0,3).map((item)=>"<div><b>" + item.label + "</b>" + escapeHtml(a.name) + " " + escapeHtml(axis(a.profile,item.key).level) + " · " + escapeHtml(b.name) + " " + escapeHtml(axis(b.profile,item.key).level) + "</div>").join("");
    return "<article class=\"chem-card\">" +
      "<div class=\"chem-top\"><div class=\"names\">" + escapeHtml(a.name) + " ↔ " + escapeHtml(b.name) + "</div><span class=\"tag\">" + escapeHtml(data.label) + "</span></div>" +
      "<p>" + escapeHtml(data.line) + "</p><p>" + escapeHtml(data.point) + "</p>" +
      "<div class=\"radar-row\">" + radar(a,b) + "<div class=\"axis-list\">" + axes + "</div></div>" +
      "</article>";
  }
  function escapeHtml(value){
    return String(value == null ? "" : value).replace(/[&<>"']/g, (ch)=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[ch]));
  }
  async function loadRoom(){
    if(!state.code) return;
    try {
      state.room = await api("/api/inyeon-room/" + state.code, { method:"GET" });
      renderRoom();
      showShare(state.code);
    } catch(e) {
      setStatus("방을 찾지 못했어요. 링크를 다시 확인해 주세요.");
    }
  }
  async function submitForm(event){
    event.preventDefault();
    setStatus("계산하고 있어요...");
    $("submitBtn").disabled = true;
    try {
      const profile = readFormProfile();
      const body = {
        participantId: state.code ? participantId() : (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)),
        name:$("displayName").value,
        profile
      };
      const path = state.code ? "/api/inyeon-room/" + state.code : "/api/inyeon-room";
      state.room = await api(path, { method:"POST", body:JSON.stringify(body) });
      state.code = state.room.code;
      state.participantId = body.participantId;
      localStorage.setItem("jippi-inyeon-id-" + state.code, body.participantId);
      history.replaceState(null, "", "/room/" + state.code);
      setupMode();
      renderRoom();
      setStatus("단톡 케미가 열렸어요.");
    } catch(e) {
      setStatus(e.message || "처리하지 못했어요.");
    } finally {
      $("submitBtn").disabled = false;
    }
  }
  function bindDateMask(){
    const input = $("birthDate");
    input.addEventListener("input", () => { input.value = normalizeDate(input.value); });
    input.addEventListener("blur", () => { input.value = normalizeDate(input.value); });
  }
  function init(){
    setupMode();
    bindDateMask();
    $("roomForm").addEventListener("submit", submitForm);
    $("shareBtn").addEventListener("click", shareRoom);
    $("copyBtn").addEventListener("click", copyRoomLink);
    $("heroShareBtn").addEventListener("click", () => state.room || state.code ? shareRoom() : document.getElementById("joinPanel").scrollIntoView({behavior:"smooth"}));
    $("refreshBtn").addEventListener("click", loadRoom);
    loadRoom();
  }

  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
