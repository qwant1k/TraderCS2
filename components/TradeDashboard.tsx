"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Avatar from "./Avatar";
import ItemTile from "./ItemTile";
import type { FeedItemView, FeedLot, FeedResponse } from "@/lib/feedTypes";
import type { PriceSet } from "@/lib/prices";
import type { Item } from "@/lib/steam";

type InventoryResponse = {
  items: Item[];
  prices: Record<string, PriceSet>;
  busy: string[];
  fetchedAt: string | null;
};

type Sort = "wanted" | "price_desc" | "price_asc" | "float";
type Filter = "all" | "wanted" | "mutual";

const priceOf = (price?: PriceSet) => {
  const values = [price?.steam, price?.skinport].filter((value): value is number => value != null);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : undefined;
};

const usd = (value: number) => `$${value.toFixed(2)}`;

function minutesAgo(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 60_000));
  if (minutes < 1) return "только что";
  if (minutes < 60) return `${minutes} мин назад`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч назад`;
  return `${Math.floor(hours / 24)} дн назад`;
}

function FeedSkeleton() {
  return (
    <div className="feed-card-grid" aria-label="Загрузка обменов">
      {[0, 1].map((index) => <div className="feed-card feed-skeleton" key={index}><i /><i /><i /><i /></div>)}
    </div>
  );
}

function InventorySkeleton() {
  return (
    <div className="dashboard-inventory-grid" aria-label="Загрузка инвентаря">
      {Array.from({ length: 8 }, (_, index) => <div className="inventory-skeleton" key={index}><i /><i /><i /></div>)}
    </div>
  );
}

function TradeCard({
  lot,
  mine,
  variantId,
  priority,
  hasTradeUrl,
}: {
  lot: FeedLot;
  mine?: FeedItemView;
  variantId?: string;
  priority: boolean;
  hasTradeUrl: boolean;
}) {
  const query = mine
    ? `?pick=${encodeURIComponent(mine.assetid)}${variantId ? `&v=${encodeURIComponent(variantId)}` : ""}`
    : "";
  const delta = lot.deltaUsd;

  return (
    <article className={`feed-card${lot.mutual ? " is-mutual" : ""}`}>
      <div className="feed-card-owner">
        <Link href={`/u/${lot.owner.steamId}`} className="feed-owner-link">
          <Avatar src={lot.owner.avatar} name={lot.owner.name} size={36} />
          <span><strong>{lot.owner.name}</strong><small>Ур. доверия {lot.owner.trustLevel} · {minutesAgo(lot.createdAt)}</small></span>
        </Link>
        {priority && <span className={`feed-badge ${lot.mutual ? "mutual" : "wanted"}`}>{lot.mutual ? "Взаимная пара" : "Ищут ваш скин"}</span>}
      </div>

      <div className="feed-side-label">Предлагает</div>
      <div className="feed-items-row">
        {lot.offers.slice(0, 2).map((item) => <ItemTile item={item} size="trade" key={item.assetid} />)}
      </div>
      <div className={`feed-match-note${lot.mutual ? " visible" : ""}`}>{lot.mutual ? "Есть в вашем списке «Хочу»" : ""}</div>

      <div className="feed-swap" aria-hidden="true"><span /><b>↕</b><span /></div>

      {priority && mine ? (
        <>
          <div className="feed-side-label wanted">Хочет ваш</div>
          <div className="feed-mine"><ItemTile item={mine} size="trade" highlight="wanted" /></div>
          <div className="feed-match-note visible wanted">{lot.altText || "Флоат не важен"}</div>
        </>
      ) : (
        <>
          <div className="feed-side-label">Хочет взамен</div>
          <div className="feed-wants-box">{lot.wantsText || "Открыт для предложений"}</div>
          <div className="feed-match-note" />
        </>
      )}

      <div className="feed-card-bottom">
        {priority && lot.giveUsd != null && lot.getUsd != null && (
          <div className="feed-value-row">
            <span>{usd(lot.giveUsd)} отдаёте → {usd(lot.getUsd)} получаете</span>
            {delta != null && Math.abs(delta) >= 0.01 && (
              <strong className={delta >= 0 ? "positive" : "negative"}>
                {delta >= 0 ? "+" : "−"}{usd(Math.abs(delta))} {delta >= 0 ? "в вашу пользу" : "не в вашу пользу"}
              </strong>
            )}
          </div>
        )}
        {priority ? (
          <div className="feed-actions">
            <Link className="dashboard-button outline" href={`/listings/${lot.id}`}>Открыть</Link>
            <Link className="dashboard-button primary" href={hasTradeUrl ? `/listings/${lot.id}${query}` : "/settings?setup=1"}>
              {hasTradeUrl ? "Предложить обмен" : "Добавить трейд-ссылку"}
            </Link>
          </div>
        ) : (
          <Link className="dashboard-button outline wide" href={`/listings/${lot.id}`}>Смотреть лот</Link>
        )}
      </div>
    </article>
  );
}

export default function TradeDashboard({ hasTradeUrl }: { hasTradeUrl: boolean }) {
  const router = useRouter();
  const [inventory, setInventory] = useState<InventoryResponse | null>(null);
  const [feed, setFeed] = useState<FeedResponse | null>(null);
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("wanted");
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [staged, setStaged] = useState<string[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    setInventoryError(null);
    setFeedError(null);
    if (refresh) {
      setInventory(null);
      setFeed(null);
    }
    try {
      const inventoryResponse = await fetch(`/api/inventory${refresh ? "?refresh=1" : ""}`);
      const inventoryJson = await inventoryResponse.json();
      if (!inventoryResponse.ok) throw new Error(inventoryJson.message || (inventoryResponse.status === 429 ? "Steam временно ограничил запросы. Попробуйте позже." : "Не удалось загрузить инвентарь"));
      setInventory(inventoryJson);
    } catch (error) {
      setInventoryError(error instanceof Error ? error.message : "Не удалось загрузить инвентарь");
      setInventory({ items: [], prices: {}, busy: [], fetchedAt: null });
    }

    try {
      const feedResponse = await fetch("/api/feed");
      const feedJson = await feedResponse.json();
      if (!feedResponse.ok) throw new Error(feedJson.message || "Не удалось загрузить новые обмены");
      setFeed(feedJson);
    } catch (error) {
      setFeedError(error instanceof Error ? error.message : "Не удалось загрузить новые обмены");
      setFeed(null);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const itemViews = useMemo<FeedItemView[]>(() => (inventory?.items ?? []).map((item) => ({
    ...item,
    priceUsd: priceOf(inventory?.prices[item.hash]),
  })), [inventory]);
  const itemById = useMemo(() => new Map(itemViews.map((item) => [item.assetid, item])), [itemViews]);
  const busy = useMemo(() => new Set(inventory?.busy ?? []), [inventory]);
  const selectedItem = selectedAssetId ? itemById.get(selectedAssetId) : undefined;

  const shownItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const list = itemViews.filter((item) => !normalized || item.name.toLowerCase().includes(normalized));
    list.sort((a, b) => {
      if (sort === "wanted") {
        const demand = (feed?.wantedByAssetId[b.assetid] ?? 0) - (feed?.wantedByAssetId[a.assetid] ?? 0);
        return demand || (b.priceUsd ?? -1) - (a.priceUsd ?? -1);
      }
      if (sort === "price_desc") return (b.priceUsd ?? -1) - (a.priceUsd ?? -1);
      if (sort === "price_asc") return (a.priceUsd ?? Number.MAX_SAFE_INTEGER) - (b.priceUsd ?? Number.MAX_SAFE_INTEGER);
      return (a.float ?? Number.MAX_SAFE_INTEGER) - (b.float ?? Number.MAX_SAFE_INTEGER);
    });
    return list;
  }, [feed, itemViews, query, sort]);

  const priorityLots = useMemo(() => {
    if (!feed) return [];
    let lots = feed.priority;
    if (filter === "mutual") lots = lots.filter((lot) => lot.mutual);
    if (selectedAssetId) lots = lots.filter((lot) => lot.matchedAssetIds?.includes(selectedAssetId));
    return lots;
  }, [feed, filter, selectedAssetId]);

  const stagedItems = staged.map((assetId) => itemById.get(assetId)).filter((item): item is FeedItemView => !!item);

  async function publish() {
    if (!hasTradeUrl) {
      router.push("/settings?setup=1");
      return;
    }
    setPublishing(true);
    setPublishError(null);
    const response = await fetch("/api/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "OPEN", wants: [], note: "", assetIds: staged }),
    });
    const json = await response.json();
    setPublishing(false);
    if (!response.ok) {
      setPublishError(json.message || "Не удалось опубликовать лот");
      return;
    }
    router.push(`/listings/${json.id}`);
  }

  const refreshedText = inventory?.fetchedAt ? minutesAgo(inventory.fetchedAt) : "нет данных";

  return (
    <div className="trade-dashboard">
      <div className="dashboard-columns">
        <section className="dashboard-panel inventory-panel" aria-labelledby="inventory-title">
          <div className="dashboard-heading">
            <div><span className="dashboard-kicker">Ваши предметы</span><h1 id="inventory-title">Мой инвентарь</h1></div>
            <span>{inventory?.items.length ?? 0} предметов · обновлено {refreshedText}</span>
          </div>

          {!hasTradeUrl && <div className="dashboard-alert">Для публикации лотов и предложений добавьте <Link href="/settings?setup=1">трейд-ссылку Steam</Link>.</div>}
          {inventoryError && <div className="dashboard-alert error">{inventoryError} <button type="button" onClick={() => void load(true)}>Повторить</button></div>}

          <div className="dashboard-toolbar">
            <label className="dashboard-field"><span>Поиск по инвентарю</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Название оружия или скина" /></label>
            <label className="dashboard-field sort"><span>Сортировка</span><select value={sort} onChange={(event) => setSort(event.target.value as Sort)}>
              <option value="wanted">Сначала востребованные</option>
              <option value="price_desc">Дороже</option>
              <option value="price_asc">Дешевле</option>
              <option value="float">По флоату</option>
            </select></label>
          </div>
          <p className="dashboard-hint">Нажмите на предмет — в ленте останутся лоты, где его ищут</p>

          {inventory === null ? <InventorySkeleton /> : (
            <div className="dashboard-inventory-grid">
              {shownItems.map((item) => (
                <ItemTile
                  key={item.assetid}
                  item={item}
                  size="inventory"
                  highlight={selectedAssetId === item.assetid ? "selected" : (feed?.wantedByAssetId[item.assetid] ?? 0) > 0 ? "wanted" : "none"}
                  wantedCount={feed?.wantedByAssetId[item.assetid] ?? 0}
                  busy={busy.has(item.assetid)}
                  ariaPressed={selectedAssetId === item.assetid}
                  onClick={() => setSelectedAssetId((current) => current === item.assetid ? null : item.assetid)}
                />
              ))}
            </div>
          )}

          {inventory && shownItems.length === 0 && !inventoryError && <div className="dashboard-empty">Предметы не найдены.</div>}

          <div className="staging-panel">
            <div className="staging-panel-head">
              <div><span className="dashboard-kicker">Подготовка лота</span><h2>Ожидают предложений <b>{staged.length}/10</b></h2></div>
              {selectedItem && !staged.includes(selectedItem.assetid) && !busy.has(selectedItem.assetid) && (
                <button className="dashboard-button outline" type="button" onClick={() => setStaged((current) => [...current, selectedItem.assetid])}>Добавить выбранный</button>
              )}
            </div>
            {stagedItems.length > 0 ? (
              <div className="staged-list">{stagedItems.map((item) => <div className="staged-item" key={item.assetid}><ItemTile item={item} size="mini" /><button type="button" onClick={() => setStaged((current) => current.filter((id) => id !== item.assetid))} aria-label={`Убрать ${item.name}`}>×</button></div>)}</div>
            ) : <p>Выберите предмет в инвентаре и добавьте его сюда.</p>}
            {publishError && <div className="dashboard-alert error">{publishError}</div>}
            <button className="dashboard-button primary publish" type="button" disabled={staged.length === 0 || publishing} onClick={() => void publish()}>{publishing ? "Публикуем…" : "Опубликовать лот"}</button>
          </div>
        </section>

        <section className="dashboard-panel feed-panel" aria-labelledby="feed-title">
          <div className="dashboard-heading feed-heading"><div><span className="dashboard-kicker">Лента площадки</span><h1 id="feed-title">Новые обмены</h1><p>Сверху — лоты, где ищут предметы из вашего инвентаря</p></div></div>
          <div className="feed-filters" role="group" aria-label="Фильтр новых обменов">
            <button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>Все · {feed?.counts.all ?? 0}</button>
            <button type="button" aria-pressed={filter === "wanted"} onClick={() => setFilter("wanted")}>Ищут мои · {feed?.counts.wanted ?? 0}</button>
            <button type="button" aria-pressed={filter === "mutual"} onClick={() => setFilter("mutual")}>Взаимные · {feed?.counts.mutual ?? 0}</button>
          </div>

          {selectedItem && <div className="selected-feed-item"><span>Показаны лоты, где ищут: <strong>{selectedItem.name}</strong></span><button type="button" onClick={() => setSelectedAssetId(null)}>Сбросить</button></div>}
          {feedError && <div className="dashboard-alert error">{feedError} <button type="button" onClick={() => void load()}>Повторить</button></div>}
          {feed === null && !feedError ? <FeedSkeleton /> : (
            <>
              <div className="feed-section-title"><span className="wanted" /> <h2>Ищут ваши скины</h2><b>{priorityLots.length}</b></div>
              {priorityLots.length > 0 ? (
                <div className="feed-card-grid">{priorityLots.map((lot) => {
                  const assetId = selectedAssetId && lot.matchedAssetIds?.includes(selectedAssetId) ? selectedAssetId : lot.matchedMine?.assetid;
                  const mine = assetId ? itemById.get(assetId) || lot.matchedMine : lot.matchedMine;
                  const variantId = assetId ? lot.matchedWishes?.[assetId] || lot.wishVariantId : lot.wishVariantId;
                  return <TradeCard lot={lot} mine={mine} variantId={variantId} priority hasTradeUrl={hasTradeUrl} key={lot.id} />;
                })}</div>
              ) : (
                <div className="dashboard-empty feed-empty">Сейчас никто не ищет этот предмет. Выставьте его в лот — подбор пар сообщит, когда появится совпадение.</div>
              )}

              {filter === "all" && !selectedAssetId && (
                <>
                  <div className="feed-section-title all"><span /><h2>Все новые лоты</h2><Link href="/listings">Весь каталог</Link></div>
                  <div className="feed-card-grid">{feed?.rest.map((lot) => <TradeCard lot={lot} priority={false} hasTradeUrl={hasTradeUrl} key={lot.id} />)}</div>
                  {feed?.rest.length === 0 && <div className="dashboard-empty">Новых лотов пока нет.</div>}
                </>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
