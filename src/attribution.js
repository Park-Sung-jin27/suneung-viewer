// src/attribution.js — 가입 유입 경로 기록 (발주 F-1 / 판정 261)
//   ① 최초 진입 시 localStorage 에 캡처 (가입 전 유실 방지, 첫 진입 보존)
//      ★ 심사관 지시: sessionStorage → localStorage 승격 + 30일 만료.
//        탭 종료·브라우저 재시작을 넘겨 유입 정보를 보존한다.
//   ② 가입(세션 획득) 직후 signup_attribution 에 1회 INSERT
//   ③ 이미 행이 있는 user_id 는 INSERT 안 함
//
//   ★ 이 모듈의 실패는 절대 가입을 막지 않는다.
//     supabase insert 는 throw 하지 않으므로 { error } 를 직접 확인하고
//     console.warn 으로만 남긴다. 모든 export 는 예외를 삼킨다.
import { supabase } from "./supabase";

const LS_KEY = "signupAttribution";
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30일

// 저장값 읽기 — 만료됐으면 제거하고 null 반환
function readStored() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const box = JSON.parse(raw);
    if (!box || typeof box !== "object" || !box.payload) return null;
    if (!box.savedAt || Date.now() - box.savedAt > TTL_MS) {
      localStorage.removeItem(LS_KEY);
      return null;
    }
    return box.payload;
  } catch {
    return null;
  }
}

// 최초 진입 정보 캡처 — 이미 값이 있으면 덮어쓰지 않는다.
export function captureAttribution() {
  try {
    if (readStored()) return; // 첫 진입 보존 — 만료 전이면 덮어쓰지 않는다
    const p = new URLSearchParams(window.location.search);
    const payload = {
      referrer: document.referrer || null,
      utm_source: p.get("utm_source"),
      utm_medium: p.get("utm_medium"),
      utm_campaign: p.get("utm_campaign"),
      landing_path: window.location.pathname + window.location.search,
      user_agent: navigator.userAgent || null,
    };
    localStorage.setItem(
      LS_KEY,
      JSON.stringify({ savedAt: Date.now(), payload }),
    );
  } catch (e) {
    console.warn("[attribution] capture 실패:", e?.message);
  }
}

// 가입 직후 1회 기록. 실패해도 가입 흐름에 영향 없음.
export async function recordAttribution(user) {
  if (!user?.id) return { skipped: "no user" };
  try {
    const payload = readStored();
    if (!payload) return { skipped: "no captured payload" };

    // ③ 최초 1회만 — 기존 행 확인
    const { data: existing, error: selErr } = await supabase
      .from("signup_attribution")
      .select("id")
      .eq("user_id", user.id)
      .limit(1);
    if (selErr) {
      console.warn("[attribution] select 실패:", selErr.message);
      return { error: selErr };
    }
    if (existing && existing.length > 0) return { skipped: "already recorded" };

    const { error: insErr } = await supabase
      .from("signup_attribution")
      .insert({ user_id: user.id, ...payload });
    if (insErr) {
      // UNIQUE(user_id) 채택 — 경합으로 2번째 INSERT 가 오면 23505.
      //   이는 "이미 기록됨"이므로 실패가 아니다.
      if (insErr.code === "23505") return { skipped: "unique conflict" };
      // 가입은 이미 성공한 상태 — 기록 실패만 남기고 흐름 유지
      console.warn("[attribution] insert 실패:", insErr.message);
      return { error: insErr };
    }
    return { ok: true };
  } catch (e) {
    console.warn("[attribution] 기록 중 예외:", e?.message);
    return { error: e };
  }
}
