(() => {
  "use strict";

  const TOKEN_RE = /^[A-Za-z0-9_-]{24,96}$/;
  const token = location.pathname.match(/^\/fortune\/delivery\/([^/]+)\/?$/)?.[1] || "";
  if (!TOKEN_RE.test(token) || document.querySelector("jippi-delivery-footer")) return;

  const host = document.createElement("jippi-delivery-footer");
  host.id = "jippi-library";
  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <style>
      :host { display:block; color:#25211d; font-family:Pretendard,"Noto Sans KR",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
      * { box-sizing:border-box; }
      .wrap { max-width:860px; margin:72px auto 48px; padding:0 20px; }
      .rule { width:48px; height:1px; margin:0 auto 32px; background:#b69565; }
      .panel { overflow:hidden; border:1px solid rgba(117,91,57,.22); border-radius:28px; background:#f8f2e8; box-shadow:0 24px 70px rgba(67,49,31,.10); }
      .save { padding:38px 38px 34px; }
      .eyebrow { margin:0 0 12px; color:#84683f; font-size:12px; font-weight:750; letter-spacing:.14em; }
      h2 { margin:0; font-family:"Noto Serif KR","Nanum Myeongjo",Georgia,serif; font-size:clamp(25px,5vw,36px); line-height:1.35; letter-spacing:-.04em; text-wrap:balance; }
      .lead { max-width:630px; margin:16px 0 0; color:#5f574d; font-size:16px; line-height:1.82; word-break:keep-all; }
      form { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:10px; margin-top:25px; }
      input { width:100%; min-height:52px; border:1px solid rgba(94,70,43,.28); border-radius:14px; background:#fffdfa; padding:0 16px; color:#25211d; font:inherit; font-size:16px; outline:none; }
      input:focus { border-color:#7a5d35; box-shadow:0 0 0 3px rgba(122,93,53,.12); }
      button,.link { min-height:52px; border:0; border-radius:14px; padding:0 20px; background:#283f36; color:#fff; font:inherit; font-weight:750; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; text-decoration:none; }
      button:disabled { opacity:.6; cursor:wait; }
      .helper,.status { margin:10px 2px 0; color:#776e63; font-size:13px; line-height:1.65; word-break:keep-all; }
      .status { min-height:22px; color:#315d4e; font-weight:650; }
      .cross { display:grid; grid-template-columns:1fr 1fr; border-top:1px solid rgba(117,91,57,.17); background:rgba(255,255,255,.45); }
      .card { min-width:0; padding:25px 28px 27px; color:inherit; text-decoration:none; }
      .card + .card { border-left:1px solid rgba(117,91,57,.17); }
      .card:hover { background:rgba(255,255,255,.7); }
      .card b { display:block; margin-bottom:7px; font-family:"Noto Serif KR","Nanum Myeongjo",serif; font-size:18px; letter-spacing:-.03em; }
      .card span { color:#70675c; font-size:14px; line-height:1.65; word-break:keep-all; }
      .quiet { display:flex; justify-content:center; gap:18px; flex-wrap:wrap; margin-top:20px; font-size:13px; }
      .quiet a { color:#71675d; text-underline-offset:4px; }
      @media (max-width:640px) {
        .wrap { margin:52px auto 32px; padding:0 14px; }
        .panel { border-radius:22px; }
        .save { padding:29px 22px 26px; }
        form { grid-template-columns:1fr; }
        button { width:100%; }
        .cross { grid-template-columns:1fr; }
        .card { padding:21px 22px; }
        .card + .card { border-left:0; border-top:1px solid rgba(117,91,57,.17); }
      }
      @media (prefers-reduced-motion:reduce) { * { scroll-behavior:auto!important; } }
    </style>
    <section class="wrap" aria-label="지피 리포트 보관">
      <div class="rule" aria-hidden="true"></div>
      <div class="panel">
        <div class="save">
          <p class="eyebrow">MY JIPPI LIBRARY</p>
          <h2>이 링크를 잃지 않게<br>내 보관함에 담아둘까요?</h2>
          <p class="lead">이메일로 본인 확인을 한 뒤 저장합니다. 리포트는 지금처럼 링크만으로 바로 읽을 수 있고, 보관함은 나중에 다시 찾을 때만 쓰면 돼요.</p>
          <form novalidate>
            <label><span style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)">이메일</span><input type="email" name="email" autocomplete="email" inputmode="email" placeholder="이메일 주소" required></label>
            <button type="submit">확인 메일 받기</button>
          </form>
          <p class="helper">비밀번호 없이 · 본인 확인 뒤 저장 · 광고 없음</p>
          <p class="status" role="status" aria-live="polite"></p>
        </div>
        <div class="cross" aria-label="다른 리포트 둘러보기">
          <a class="card" href="/fortune/#products" data-target="career"><b>일과 돈의 방향이 궁금하다면</b><span>내가 힘을 쓰기 좋은 환경과 다음 선택을 정리해요.</span></a>
          <a class="card" href="/fortune/#products" data-target="love"><b>관계의 다음 장면이 궁금하다면</b><span>끌림보다 오래 가는 조건과 대화의 순서를 살펴봐요.</span></a>
        </div>
      </div>
      <div class="quiet"><a href="/my">내 보관함 열기</a><a href="mailto:seongjinpark12@gmail.com?subject=JIPPI%20리포트%20후기">이 리포트, 어땠어요?</a></div>
    </section>`;
  document.body.appendChild(host);

  const form = shadow.querySelector("form");
  const button = shadow.querySelector("button");
  const status = shadow.querySelector(".status");
  const input = shadow.querySelector("input");
  const title = String(document.title || "지피 리포트").slice(0, 140);
  const productId = document.querySelector('meta[name="jippi:product-id"]')?.content || "unknown";
  const productName = document.querySelector('meta[name="jippi:product-name"]')?.content || "지피 리포트";

  const event = (name, target = "") => fetch("/api/inyeon-event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event: name, source: "delivery_footer", target }),
    keepalive: true,
  }).catch(() => {});

  fetch("/api/library/open", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deliveryToken: token }),
    keepalive: true,
  }).catch(() => {});

  let viewed = false;
  const observer = new IntersectionObserver((entries) => {
    if (!viewed && entries.some((entry) => entry.isIntersecting)) {
      viewed = true;
      event("library_block_view");
      observer.disconnect();
    }
  }, { threshold: 0.35 });
  observer.observe(host);

  shadow.querySelectorAll(".card").forEach((card) => {
    card.addEventListener("click", () => event("library_crosssell_click", card.dataset.target || ""));
  });

  form.addEventListener("submit", async (submitEvent) => {
    submitEvent.preventDefault();
    if (!input.validity.valid) {
      status.textContent = "확인할 수 있는 이메일 주소를 입력해 주세요.";
      input.focus();
      return;
    }
    button.disabled = true;
    status.textContent = "확인 메일을 준비하고 있어요.";
    event("library_claim_submit");
    try {
      const response = await fetch("/api/library/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: input.value,
          deliveryToken: token,
          productId,
          productName,
          title,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) throw new Error(result.error || "REQUEST_FAILED");
      status.textContent = "확인 메일을 보냈어요. 메일의 버튼을 누르면 보관함에 저장됩니다.";
      input.value = "";
      event("library_claim_success");
    } catch (error) {
      status.textContent = error?.message === "EMAIL_RATE_LIMITED"
        ? "조금 전에 메일을 보냈어요. 받은편지함을 먼저 확인해 주세요."
        : "메일을 보내지 못했어요. 잠시 뒤 다시 시도해 주세요.";
    } finally {
      button.disabled = false;
    }
  });
})();
