(() => {
  "use strict";
  const loading = document.querySelector("#loading");
  const login = document.querySelector("#login");
  const library = document.querySelector("#library");
  const reports = library.querySelector(".reports");
  const identity = library.querySelector(".identity");
  const form = document.querySelector("#login-form");
  const status = login.querySelector(".status");
  const button = form.querySelector("button");
  const input = form.querySelector("input");

  function show(target) {
    [loading, login, library].forEach((element) => element.classList.toggle("hidden", element !== target));
  }

  function text(value) {
    return String(value ?? "");
  }

  function render(data) {
    const items = Array.isArray(data?.items) ? data.items : [];
    identity.textContent = data?.emailMasked ? `${data.emailMasked}로 확인됨` : "";
    reports.replaceChildren();
    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = "아직 저장한 리포트가 없어요. 받은 리포트 맨 아래에서 확인 메일을 요청하면 이곳에 담깁니다.";
      reports.appendChild(empty);
    } else {
      items.forEach((item) => {
        const link = document.createElement("a");
        link.className = "report";
        link.href = text(item.href);
        const copy = document.createElement("span");
        const title = document.createElement("b");
        title.textContent = text(item.title || item.productName || "지피 리포트");
        const meta = document.createElement("span");
        meta.textContent = item.savedAt ? `${text(item.savedAt).slice(0, 10)} 저장` : "저장한 리포트";
        const arrow = document.createElement("span");
        arrow.className = "arrow";
        arrow.setAttribute("aria-hidden", "true");
        arrow.textContent = "→";
        copy.append(title, meta);
        link.append(copy, arrow);
        reports.appendChild(link);
      });
    }
    show(library);
  }

  async function readLibrary() {
    const response = await fetch("/api/library", { cache: "no-store" });
    if (response.status === 401) {
      show(login);
      return;
    }
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) throw new Error(result.error || "LIBRARY_FAILED");
    render(result.library);
  }

  async function exchangeMagic() {
    const fragment = new URLSearchParams(location.hash.replace(/^#/, ""));
    const token = fragment.get("token") || "";
    if (!token) return false;
    history.replaceState({}, "", "/my");
    const response = await fetch("/api/library/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) throw new Error(result.error || "MAGIC_LINK_FAILED");
    render(result.library);
    return true;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!input.validity.valid) {
      status.textContent = "확인할 수 있는 이메일 주소를 입력해 주세요.";
      input.focus();
      return;
    }
    button.disabled = true;
    status.textContent = "확인 메일을 준비하고 있어요.";
    try {
      const response = await fetch("/api/library/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: input.value }),
      });
      if (!response.ok) throw new Error("LINK_FAILED");
      status.textContent = "계정이 있다면 확인 메일을 보냈어요. 받은편지함을 확인해 주세요.";
      input.value = "";
    } catch {
      status.textContent = "메일을 요청하지 못했어요. 잠시 뒤 다시 시도해 주세요.";
    } finally {
      button.disabled = false;
    }
  });

  library.querySelector(".logout").addEventListener("click", async () => {
    await fetch("/api/library/logout", { method: "POST" }).catch(() => {});
    show(login);
  });

  (async () => {
    try {
      if (!(await exchangeMagic())) await readLibrary();
    } catch (error) {
      show(login);
      status.textContent = ["MAGIC_TOKEN_EXPIRED", "INVALID_OR_EXPIRED_MAGIC_TOKEN", "MAGIC_TOKEN_USED"].includes(error?.message)
        ? "확인 링크가 만료되었거나 이미 사용됐어요. 새 링크를 요청해 주세요."
        : "보관함을 열지 못했어요. 이메일로 새 링크를 요청해 주세요.";
    }
  })();
})();
