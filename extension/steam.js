// Страница обмена Steam: подставляет предметы из плана TradeGG и проверяет итоговый список.
// Расширение НЕ нажимает «Готово» и не подтверждает обмен: это делает пользователь.
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const waitFor = async (fn, timeout = 8000, step = 150) => {
    const t = Date.now();
    while (Date.now() - t < timeout) {
      const v = fn();
      if (v) return v;
      await sleep(step);
    }
    return null;
  };

  const partner = new URLSearchParams(location.search).get("partner");

  // План пишет страница TradeGG чуть раньше открытия вкладки: даём ей до 3 секунд.
  let plan = null;
  for (let i = 0; i < 12 && !plan; i++) {
    const { tradeggPlan } = await chrome.storage.local.get("tradeggPlan");
    if (tradeggPlan && Date.now() < tradeggPlan.expires && tradeggPlan.partner === partner) plan = tradeggPlan;
    else await sleep(250);
  }
  if (!plan) return; // это не обмен из TradeGG

  const key = (it) => `${it.appid}_${it.contextid}_${it.assetid}`;
  const wantGive = new Set(plan.give.map(key));
  const wantReceive = new Set(plan.receive.map(key));
  const nameOf = new Map([...plan.give, ...plan.receive].map((it) => [key(it), it.name]));

  // ---------- Плашка ----------
  const host = document.createElement("div");
  host.id = "tradegg-banner";
  host.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:2147483647;";
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `
    <style>
      .b{font:14px/1.45 system-ui,sans-serif;color:#eaf0ff;background:#0a0e16;border-bottom:3px solid #19e3ff;padding:10px 16px;display:flex;gap:14px;align-items:center;flex-wrap:wrap;box-shadow:0 6px 24px rgba(0,0,0,.5)}
      .b.ok{border-color:#2ee59d}.b.bad{border-color:#ff5470;background:#2a0f17}
      .t{font-weight:700}.d{color:#9fb0d0;font-size:13px}
      button{font:inherit;font-weight:700;border:0;border-radius:8px;padding:6px 12px;cursor:pointer;background:#19e3ff;color:#04060b}
      button:disabled{opacity:.5;cursor:default}
      ul{margin:4px 0 0;padding-left:18px}
    </style>
    <div class="b" id="b"><div style="flex:1"><div class="t" id="t"></div><div class="d" id="d"></div></div><button id="btn">Подставить предметы</button></div>`;
  document.documentElement.appendChild(host);
  const $ = (id) => root.getElementById(id);

  // ---------- Чтение того, что сейчас в окне обмена ----------
  const readSlots = (selector) => {
    const out = new Set();
    document.querySelectorAll(`${selector} .item`).forEach((el) => {
      const m = /^item(\d+)_(\d+)_(\d+)$/.exec(el.id || "");
      if (m) out.add(`${m[1]}_${m[2]}_${m[3]}`);
    });
    return out;
  };
  const diff = (want, have) => ({
    missing: [...want].filter((k) => !have.has(k)),
    extra: [...have].filter((k) => !want.has(k)),
  });

  let busy = false;
  function render() {
    const give = diff(wantGive, readSlots("#your_slots"));
    const recv = diff(wantReceive, readSlots("#their_slots"));
    const problems = give.extra.length + recv.extra.length;
    const missing = give.missing.length + recv.missing.length;
    const b = $("b");
    const escape = (value) => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
    const list = (keys) => keys.map((k) => `<li>${escape(nameOf.get(k) || "Неизвестный предмет (" + k.split("_")[2] + ")")}</li>`).join("");

    if (problems === 0 && missing === 0) {
      b.className = "b ok";
      $("t").textContent = "Список совпадает с принятым предложением TradeGG";
      $("d").textContent = "Проверьте партнёра и нажмите «Готово» в Steam. Подтверждение остаётся за вами.";
    } else if (problems > 0) {
      b.className = "b bad";
      $("t").textContent = "ВНИМАНИЕ: в обмене есть предметы, которых не было в предложении";
      $("d").innerHTML = `Уберите лишние предметы или отмените обмен.<ul>${list([...give.extra, ...recv.extra])}</ul>`;
    } else {
      b.className = "b";
      $("t").textContent = `Не хватает предметов: ${missing}`;
      $("d").innerHTML = `Нажмите «Подставить предметы».<ul>${list([...give.missing, ...recv.missing])}</ul>`;
    }
    $("btn").disabled = busy || (problems === 0 && missing === 0);
  }

  // ---------- Подстановка ----------
  async function openInventory(side, appid, ctx) {
    const tab = document.getElementById(side === "you" ? "inventory_select_your_inventory" : "inventory_select_their_inventory");
    if (tab) tab.click();
    await sleep(300);
    const option = document.getElementById(`appselect_option_${side}_${appid}_${ctx}`);
    if (option) {
      option.click();
      await sleep(600);
    }
  }

  async function pickItem(side, it) {
    await openInventory(side, it.appid, it.contextid);
    for (let page = 0; page < 20; page++) {
      const el = await waitFor(() => document.getElementById(`item${it.appid}_${it.contextid}_${it.assetid}`), page === 0 ? 8000 : 800);
      if (el) {
        const inSlots = el.closest("#your_slots, #their_slots");
        if (!inSlots) el.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true, view: window }));
        await sleep(250);
        return true;
      }
      const next = document.getElementById("pagebtn_next");
      if (!next || next.classList.contains("disabled")) break;
      next.click();
      await sleep(500);
    }
    return false;
  }

  async function fill() {
    busy = true;
    render();
    $("t").textContent = "Подставляю предметы…";
    const haveGive = readSlots("#your_slots");
    const haveRecv = readSlots("#their_slots");
    for (const it of plan.give) if (!haveGive.has(key(it))) await pickItem("you", it);
    for (const it of plan.receive) if (!haveRecv.has(key(it))) await pickItem("them", it);
    busy = false;
    render();
  }

  $("btn").addEventListener("click", fill);

  // Следим за окном обмена: любая правка пересчитывает проверку.
  const area = await waitFor(() => document.getElementById("trade_area") || document.getElementById("your_slots"), 10000);
  if (area) new MutationObserver(() => !busy && render()).observe(document.body, { childList: true, subtree: true });

  // Партнёр в ссылке уже совпал с планом (иначе плана бы не было). Запускаем подстановку сразу.
  render();
  await fill();
})();
