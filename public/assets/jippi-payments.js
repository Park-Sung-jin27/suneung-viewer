(function () {
  const TOSS_CLIENT_KEY = "test_ck_pP2YxJ4K872Yyekv1dGmrRGZwXLO";
  const TOSS_SDK_URL = "https://js.tosspayments.com/v2/standard";

  const PRODUCTS = {
    fortune_theme_card: {
      service: "fortune",
      productId: "fortune_theme_card",
      orderPrefix: "JIPPI-FORTUNE",
      name: "지피사주 모바일 한장카드",
      amount: 3900,
    },
    fortune_theme_career: {
      service: "fortune",
      productId: "fortune_theme_career",
      orderPrefix: "JIPPI-FORTUNE",
      name: "지피사주 일·돈·이동 전략 리포트",
      amount: 9900,
    },
    fortune_theme_love: {
      service: "fortune",
      productId: "fortune_theme_love",
      orderPrefix: "JIPPI-FORTUNE",
      name: "지피사주 연애·재회·결혼 리포트",
      amount: 19900,
    },
    fortune_theme_destiny: {
      service: "fortune",
      productId: "fortune_theme_destiny",
      orderPrefix: "JIPPI-FORTUNE",
      name: "지피사주 인생 흐름·미래 인연 리포트",
      amount: 24900,
    },
    fortune_theme_premium: {
      service: "fortune",
      productId: "fortune_theme_premium",
      orderPrefix: "JIPPI-FORTUNE",
      name: "지피사주 프리미엄 종합 리포트",
      amount: 42900,
    },
    suneung_standard: {
      service: "suneung",
      productId: "suneung_standard",
      orderPrefix: "JIPPI-SUNEUNG",
      name: "JIPPI 수능 국어 논리진단 스탠다드",
      amount: 39900,
    },
    suneung_premium: {
      service: "suneung",
      productId: "suneung_premium",
      orderPrefix: "JIPPI-SUNEUNG",
      name: "JIPPI 수능 국어 논리진단 프리미엄",
      amount: 89000,
    },
  };

  function loadTossSDK() {
    if (window.TossPayments) return Promise.resolve(window.TossPayments);
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${TOSS_SDK_URL}"]`);
      if (existing) {
        existing.addEventListener("load", () => resolve(window.TossPayments));
        existing.addEventListener("error", () => reject(new Error("토스페이먼츠 SDK를 불러오지 못했습니다.")));
        return;
      }
      const script = document.createElement("script");
      script.src = TOSS_SDK_URL;
      script.async = true;
      script.onload = () => {
        if (window.TossPayments) resolve(window.TossPayments);
        else reject(new Error("토스페이먼츠 SDK 초기화에 실패했습니다."));
      };
      script.onerror = () => reject(new Error("토스페이먼츠 SDK를 불러오지 못했습니다."));
      document.head.appendChild(script);
    });
  }

  function randomPart() {
    return Math.random().toString(36).slice(2, 8).toUpperCase();
  }

  function getCustomerKey() {
    const key = "jippiCustomerKey";
    try {
      const saved = localStorage.getItem(key);
      if (saved) return saved;
      const next = `JIPPI_ANON_${Date.now()}_${randomPart()}`;
      localStorage.setItem(key, next);
      return next;
    } catch {
      return `JIPPI_ANON_${Date.now()}_${randomPart()}`;
    }
  }

  function createOrderId(product) {
    return `${product.orderPrefix}-${Date.now()}-${randomPart()}`;
  }

  function storePending(order) {
    try {
      const value = JSON.stringify(order);
      sessionStorage.setItem(`jippiPendingPayment:${order.orderId}`, value);
      sessionStorage.setItem("jippiLastPendingPayment", value);
      localStorage.setItem(`jippiPendingPayment:${order.orderId}`, value);
      localStorage.setItem("jippiLastPendingPayment", value);
    } catch (error) {
      console.warn("[JIPPI payment] pending order save failed", error);
    }
  }

  function getPendingOrder(orderId) {
    try {
      if (orderId) {
        return JSON.parse(
          sessionStorage.getItem(`jippiPendingPayment:${orderId}`) ||
            localStorage.getItem(`jippiPendingPayment:${orderId}`) ||
            "null",
        );
      }
      return JSON.parse(
        sessionStorage.getItem("jippiLastPendingPayment") ||
          localStorage.getItem("jippiLastPendingPayment") ||
          "null",
      );
    } catch {
      return null;
    }
  }

  async function requestPayment(productId, meta = {}) {
    const product = PRODUCTS[productId];
    if (!product) throw new Error("결제 상품 정보를 찾을 수 없습니다.");

    const TossPayments = await loadTossSDK();
    const orderId = meta.orderId || createOrderId(product);
    const order = {
      ...product,
      orderId,
      orderName: meta.orderName || product.name,
      amount: product.amount,
      requestedAt: new Date().toISOString(),
      customerName: meta.customerName || "",
      customerEmail: meta.customerEmail || "",
      customerPhone: meta.customerPhone || "",
      sourcePath: window.location.pathname,
      meta,
    };
    storePending(order);

    const tossPayments = TossPayments(TOSS_CLIENT_KEY);
    const payment = tossPayments.payment({ customerKey: getCustomerKey() });
    return payment.requestPayment({
      method: "CARD",
      amount: { currency: "KRW", value: product.amount },
      orderId,
      orderName: order.orderName,
      customerEmail: order.customerEmail || undefined,
      customerName: order.customerName || undefined,
      successUrl: `${window.location.origin}/payment-success.html`,
      failUrl: `${window.location.origin}/payment-fail.html`,
    });
  }

  window.JippiPayments = {
    clientKey: TOSS_CLIENT_KEY,
    products: PRODUCTS,
    requestPayment,
    getPendingOrder,
  };
})();
