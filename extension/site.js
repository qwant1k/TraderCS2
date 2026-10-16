// Работает на страницах TradeGG. При нажатии «Открыть трейд в Steam» запоминает план обмена.
// План пишет только эта страница: подделать его ссылкой на Steam нельзя.
(() => {
  const TTL_MS = 30 * 60 * 1000;
  document.addEventListener(
    "click",
    (e) => {
      const el = e.target instanceof Element ? e.target.closest("[data-tradegg-plan]") : null;
      if (!el) return;
      try {
        const plan = JSON.parse(el.getAttribute("data-tradegg-plan"));
        if (!plan || typeof plan.partner !== "string" || !Array.isArray(plan.give) || !Array.isArray(plan.receive)) return;
        const href = new URL(el.getAttribute("href") || "", location.href);
        if (href.origin !== "https://steamcommunity.com" || href.pathname !== "/tradeoffer/new/" || href.searchParams.get("partner") !== plan.partner) return;
        plan.expires = Date.now() + TTL_MS;
        chrome.storage.local.set({ tradeggPlan: plan });
      } catch (_) {
        /* неверный план, ничего не сохраняем */
      }
    },
    true,
  );
})();
