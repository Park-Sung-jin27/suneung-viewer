(function(){
  "use strict";

  const STEMS = ["甲","乙","丙","丁","戊","己","庚","辛","壬","癸"];
  const STEMS_KO = ["갑","을","병","정","무","기","경","신","임","계"];
  const BRANCHES = ["子","丑","寅","卯","辰","巳","午","未","申","酉","戌","亥"];
  const BRANCHES_KO = ["자","축","인","묘","진","사","오","미","신","유","술","해"];
  const ELEM_BY_STEM = ["목","목","화","화","토","토","금","금","수","수"];
  const AXES = [
    { key:"speed", label:"반응 속도" },
    { key:"attraction", label:"친해지는 결" },
    { key:"expression", label:"표현" },
    { key:"stability", label:"편안함" },
    { key:"recovery", label:"회복" }
  ];
  const ELEMENT_COORDS = {
    목:{ label:"자라나는 결", teaser:"같이 배우고 넓히는 흐름에서 대화가 열립니다.", scores:{speed:68,attraction:70,expression:66,stability:56,recovery:58}, levels:{speed:"먼저 움직임",attraction:"같이 성장",expression:"제안형",stability:"변화 필요",recovery:"대화로 회복"} },
    화:{ label:"밝게 켜지는 결", teaser:"표현과 반응이 살아날 때 금세 가까워집니다.", scores:{speed:84,attraction:82,expression:78,stability:48,recovery:52}, levels:{speed:"빠르게 켜짐",attraction:"금세 친해짐",expression:"표현 선명",stability:"온도 변화",recovery:"사과가 중요"} },
    토:{ label:"천천히 쌓이는 결", teaser:"반복되는 태도와 약속에서 편해집니다.", scores:{speed:52,attraction:58,expression:52,stability:82,recovery:70}, levels:{speed:"천천히 확인",attraction:"익숙함",expression:"담백함",stability:"약속 중심",recovery:"시간으로 회복"} },
    금:{ label:"선명한 기준의 결", teaser:"말과 행동이 맞을 때 신뢰가 생깁니다.", scores:{speed:62,attraction:64,expression:60,stability:76,recovery:56}, levels:{speed:"판단 빠름",attraction:"태도 확인",expression:"짧고 정확",stability:"기준 중심",recovery:"정리 필요"} },
    수:{ label:"깊게 스미는 결", teaser:"재촉 없이 기다릴 때 마음이 깊어집니다.", scores:{speed:38,attraction:62,expression:44,stability:68,recovery:82}, levels:{speed:"천천히 깊게",attraction:"분위기",expression:"늦게 표현",stability:"안심 필요",recovery:"혼자 정리"} }
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
      if(hour.branchKo==="사" || hour.branchKo==="오") levels.expression = "표현이 살아남";
      if(hour.branchKo==="자" || hour.branchKo==="해") levels.recovery = "혼자 정리";
      if(hour.branchKo==="유" || hour.branchKo==="신") levels.stability = "태도와 기준";
      if(hour.branchKo==="묘") levels.attraction = "다정한 대화";
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
  async function copyRoomLink(){
    if(!state.room) return;
    const url = roomUrl(state.room.code);
    try {
      await navigator.clipboard.writeText(url);
      setStatus("방 링크를 복사했어요.");
    } catch(e) {
      prompt("방 링크를 복사해 주세요.", url);
    }
  }
  async function shareRoom(){
    const code = state.room?.code || state.code;
    if(!code) return;
    const url = roomUrl(code);
    const text = "JIPPI 단톡 케미 무료로 알아보기에서 나랑 어떤 결로 통하는지 봐줘.\n" + url;
    if(navigator.share){
      try { await navigator.share({ title:"JIPPI 단톡 케미 무료로 알아보기", text, url }); return; } catch(e) {}
    }
    await copyRoomLink();
  }
  function coordPoint(index,total,score,radius,cx,cy){
    const angle = Math.PI * 2 * index / total - Math.PI / 2;
    const r = radius * clamp(score,0,100) / 100;
    return { x:cx + Math.cos(angle)*r, y:cy + Math.sin(angle)*r };
  }
  function radar(a,b){
    const cx=82, cy=82, radius=52, colors=["#f1c987","#a9d7bf"];
    const rings=[33,66,100].map((level)=>"<polygon points=\"" + AXES.map((_,i)=>{ const p=coordPoint(i,AXES.length,level,radius,cx,cy); return p.x.toFixed(1)+","+p.y.toFixed(1); }).join(" ") + "\" fill=\"none\" stroke=\"rgba(241,201,135,.25)\"/>").join("");
    const polys=[a,b].map((person,pi)=>"<polygon points=\"" + person.profile.axes.map((axis,i)=>{ const p=coordPoint(i,person.profile.axes.length,axis.score,radius,cx,cy); return p.x.toFixed(1)+","+p.y.toFixed(1); }).join(" ") + "\" fill=\"" + colors[pi] + "\" fill-opacity=\".16\" stroke=\"" + colors[pi] + "\" stroke-width=\"2.2\"/>").join("");
    const labels=AXES.map((axis,i)=>{ const p=coordPoint(i,AXES.length,123,radius,cx,cy); return "<text x=\"" + p.x.toFixed(1) + "\" y=\"" + (p.y+3).toFixed(1) + "\" text-anchor=\"middle\" font-size=\"9\" font-weight=\"900\" fill=\"#ffe8c8\">" + axis.label.replace(" ","") + "</text>"; }).join("");
    return "<svg viewBox=\"0 0 164 164\" role=\"img\" aria-label=\"케미 레이더\">" + rings + polys + labels + "<circle cx=\"82\" cy=\"82\" r=\"2.8\" fill=\"#f1c987\"/></svg>";
  }
  function axis(profile,key){
    return profile.axes.find((item)=>item.key===key) || { score:56, level:"중간" };
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
      목:"새 얘깃거리를 잘 여는 쪽",
      화:"분위기를 먼저 밝히는 쪽",
      토:"자리를 오래 지키는 쪽",
      금:"기준을 또렷하게 잡는 쪽",
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
      목:["같이 배우고 넓히는","새 얘깃거리를 여는","얘기를 자연스럽게 넓히는"],
      화:["표정이 환한","반응이 빨리 밝아지는","먼저 웃음을 켜는"],
      토:["자리를 편하게 만드는","흐름을 차분히 붙잡는","믿고 앉게 만드는"],
      금:["기준이 또렷한","말을 깔끔하게 정리하는","선이 분명한"],
      수:["조용히 오래 보는","분위기를 깊게 읽는","말보다 여운이 긴"]
    };
    const axisPhrases = {
      speed:["첫 박자가 빠른","타이밍을 빨리 잡는","먼저 움직이는"],
      attraction:["같이 놀 포인트를 빨리 찾는","장면의 재미를 잘 줍는","분위기를 빨리 읽는"],
      expression:["리액션이 선명한","표정이 잘 보이는","말맛이 살아 있는"],
      stability:["자리를 편하게 잡는","흐름을 안정시키는","오래 앉아도 편한"],
      recovery:["잠깐 쉬고 돌아오는","분위기를 다시 누그러뜨리는","끊어진 말을 다시 이어주는"]
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
    return signaturePhrase(person) + " 느낌이라,";
  }
  function secondaryDetail(key,a,b){
    if(key==="speed"){
      const fast=roleByScore(a,b,"speed",true), slow=roleByScore(a,b,"speed",false);
      return {
        label:"템포차",
        line:topic(fast) + " 먼저 움직이고, " + topic(slow) + " 그 움직임이 괜찮은지 한 번 더 봐요.",
        point:"한 명은 바로 약속을 잡고, 한 명은 날짜와 분위기를 확인합니다. 그래서 즉흥도 되고 안전핀도 생겨요."
      };
    }
    if(key==="expression"){
      const loud=roleByScore(a,b,"expression",true), quiet=roleByScore(a,b,"expression",false);
      return {
        label:"말투차",
        line:topic(loud) + " 표정과 말이 먼저 보이고, " + topic(quiet) + " 짧게 받다가 나중에 한마디로 정리해요.",
        point:"둘이 있으면 누가 분위기를 켜고 누가 자막을 다는지 금방 보여요."
      };
    }
    if(key==="recovery"){
      const quick=roleByScore(a,b,"recovery",false), slow=roleByScore(a,b,"recovery",true);
      return {
        label:"푸는 방식차",
        line:"뭔가 엇갈리면 " + topic(quick) + " 빨리 털고 싶고, " + topic(slow) + " 조금 두었다가 말이 나와요.",
        point:"한 명은 바로 톡, 한 명은 읽고 생각하다가 한 줄. 둘 다 나름의 회복 버튼이 다릅니다."
      };
    }
    if(key==="stability"){
      const anchor=roleByScore(a,b,"stability",true), mover=roleByScore(a,b,"stability",false);
      return {
        label:"자리감차",
        line:topic(anchor) + " 기본 자리를 잡고, " + topic(mover) + " 그 안에서 재미있는 틈을 찾아요.",
        point:"모임을 잡으면 한 명은 시간표, 한 명은 사이드퀘스트. 계획이 덜 심심해집니다."
      };
    }
    const spark=roleByScore(a,b,"attraction",true), steady=roleByScore(a,b,"attraction",false);
    return {
      label:"친해지는 결차",
      line:subject(spark) + " 장면의 재미를 먼저 보고, " + subject(steady) + " 그 자리가 편한지 한 번 더 봐요.",
      point:"한 명은 색다른 메뉴, 한 명은 오래 앉기 좋은 자리. 그래서 애매하게 좋은 균형이 나옵니다."
    };
  }
  function defaultPointByElement(a,b){
    return topic(a) + " " + elementFlavor(a) + ", " + topic(b) + " " + elementFlavor(b) + "이라 같은 자리에서도 보는 포인트가 살짝 달라요.";
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
    let line="둘은 한 번에 확 붙기보다, 같이 있다 보면 어느새 같은 테이블에 오래 남는 그림이에요.";
    let point="처음엔 조용해도 묘하게 편해서, 나중에 보면 둘만 아는 농담이 하나씩 쌓입니다.";
    if(speedGap>=28){
      const fast=roleByScore(a,b,"speed",true), slow=roleByScore(a,b,"speed",false);
      const second=secondaryKey(a,b,["speed"]);
      const detail=secondaryDetail(second,a,b);
      if(second==="expression") label="불 지르고 자막 맞추는 사이";
      else if(second==="recovery") label="먼저 달리고 나중에 풀어가는 사이";
      else if(second==="stability") label="출발 버튼과 안전벨트 사이";
      else if(second==="attraction") label="먼저 가자는 쪽과 자리 보는 쪽";
      else label="불 지르고 천천히 데우는 사이";
      line=topic(fast) + " 먼저 '가자'가 나오고, " + topic(slow) + " '잠깐, 진짜?'를 한 번 거쳐요. " + detail.line;
      point=detail.point + " " + topic(fast) + " " + elementFlavor(fast) + "이라 장면을 먼저 움직입니다.";
    } else if(attractionAvg>=74){
      const second=secondaryKey(a,b,["attraction"]);
      const detail=secondaryDetail(second,a,b);
      if(second==="expression") label="앉자마자 받아치는 사이";
      else if(second==="speed") label="말 붙고 바로 움직이는 사이";
      else if(second==="recovery") label="웃다가 각자 식히는 사이";
      else if(second==="stability") label="재밌는데 자리도 잡는 사이";
      else label="앉자마자 말 붙는 사이";
      line="둘은 메뉴 고르기도 전에 얘기가 먼저 새는 사이예요. " + detail.line;
      point=detail.point;
    } else if(stabilityAvg>=74){
      const second=secondaryKey(a,b,["stability"]);
      const detail=secondaryDetail(second,a,b);
      if(second==="expression") label="조용한데 한마디가 정확한 사이";
      else if(second==="recovery") label="뜸해도 다시 이어지는 사이";
      else if(second==="speed") label="느긋한데 템포는 다른 사이";
      else if(second==="attraction") label="편해서 자꾸 앉게 되는 사이";
      else label="텐션은 낮은데 유통기한 긴 사이";
      line="둘은 매일 요란하지 않아도 잘 안 끊겨요. " + detail.line;
      point="며칠 조용하다가 '뭐해' 한마디면 바로 어제 본 듯합니다. " + detail.point;
    } else if(expressionGap>=22){
      const loud=roleByScore(a,b,"expression",true), quiet=roleByScore(a,b,"expression",false);
      const second=secondaryKey(a,b,["expression"]);
      const detail=secondaryDetail(second,a,b);
      if(second==="speed") label="자막 켜고 템포 맞추는 사이";
      else if(second==="recovery") label="말 많은 쪽과 묵히는 쪽";
      else if(second==="stability") label="리액션과 기준선이 만나는 사이";
      else if(second==="attraction") label="표현은 다른데 장면은 같이 줍는 사이";
      else label="자막 켜는 쪽과 무음모드 쪽";
      line=topic(loud) + " 표정과 말이 바로 보이고, " + topic(quiet) + " 반응을 짧게 남기는 편이에요. " + detail.line;
      point="가끔 '지금 웃긴 거 맞지?' 확인 타임이 생깁니다. " + detail.point;
    } else if(recoveryGap>=24){
      const quick=roleByScore(a,b,"recovery",false), slow=roleByScore(a,b,"recovery",true);
      const second=secondaryKey(a,b,["recovery"]);
      const detail=secondaryDetail(second,a,b);
      if(second==="expression") label="바로 말하기와 늦게 정리하기 사이";
      else if(second==="speed") label="빨리 풀고 천천히 따라오는 사이";
      else if(second==="stability") label="툭 풀고 다시 자리 잡는 사이";
      else if(second==="attraction") label="엇갈려도 다시 재밌어지는 사이";
      else label="바로 풀기와 숙성시키기 사이";
      line="뭔가 걸리면 " + topic(quick) + " 빨리 털고 싶고, " + topic(slow) + " 잠깐 조용히 뒀다가 돌아오는 쪽이에요. " + detail.line;
      point="그래도 판은 쉽게 안 깨집니다. " + detail.point;
    } else if(speedAvg>=72){
      const second=secondaryKey(a,b,["speed"]);
      const detail=secondaryDetail(second,a,b);
      if(second==="expression") label="번개에 리액션까지 빠른 사이";
      else if(second==="stability") label="즉흥인데 은근 질서 있는 사이";
      else if(second==="recovery") label="빨리 모이고 빨리 푸는 사이";
      else if(second==="attraction") label="가자마자 새 장면 찾는 사이";
      else label="번개가 번개를 부르는 사이";
      line="둘 다 움직이는 속도가 빨라서 '잠깐 볼래?'가 진짜 약속이 되기 쉬워요. " + detail.line;
      point="계획표보다 현장감이 먼저입니다. " + detail.point;
    } else if(speedAvg<=48 && recoveryAvg>=72){
      const second=secondaryKey(a,b,["speed","recovery"]);
      const detail=secondaryDetail(second,a,b);
      if(second==="expression") label="말은 적어도 자막이 남는 사이";
      else if(second==="stability") label="각자 잘 사는데 자리 잡힌 사이";
      else if(second==="attraction") label="조용한데 장면은 기억나는 사이";
      else label="각자 잘 사는데 묘하게 안 끊기는 사이";
      line="둘 다 자주 확인하지 않아도 자기 자리에서 조용히 이어지는 편이에요. " + detail.line;
      point="오래된 북마크처럼, 자주 열지 않아도 사라지지 않는 느낌이 있습니다. " + defaultPointByElement(a,b);
    } else if(stabilityGap>=22){
      const anchor=roleByScore(a,b,"stability",true), mover=roleByScore(a,b,"stability",false);
      const second=secondaryKey(a,b,["stability"]);
      const detail=secondaryDetail(second,a,b);
      if(second==="expression") label="판 깔고 말맛 살리는 사이";
      else if(second==="speed") label="자리 잡고 움직임 넣는 사이";
      else if(second==="recovery") label="흔들려도 다시 앉는 사이";
      else if(second==="attraction") label="기준과 재미가 같이 있는 사이";
      else label="판 까는 사람과 빈틈 찾는 사람";
      line=topic(anchor) + " 자리를 안정시키고, " + topic(mover) + " 그 안에서 재미있는 틈을 찾아요. " + detail.line;
      point=detail.point;
    } else if(attractionGap>=22){
      const spark=roleByScore(a,b,"attraction",true), steady=roleByScore(a,b,"attraction",false);
      const second=secondaryKey(a,b,["attraction"]);
      const detail=secondaryDetail(second,a,b);
      if(second==="expression") label="장면 줍고 말맛 살리는 사이";
      else if(second==="speed") label="재미 찾는 속도가 다른 사이";
      else if(second==="recovery") label="다르게 놀고 다르게 쉬는 사이";
      else if(second==="stability") label="분위기와 기준이 같이 앉는 사이";
      else label="분위기 줍는 쪽과 기준 보는 쪽";
      line=subject(spark) + " 장면의 재미를 먼저 보고, " + subject(steady) + " 그 장면이 편한지 한 번 더 봐요. " + detail.line;
      point="그래서 둘이 고른 장소는 너무 튀지도, 너무 심심하지도 않은 애매하게 좋은 곳이 됩니다. " + detail.point;
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
