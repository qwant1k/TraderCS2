"use client";

import { useEffect, useRef, useState } from "react";
import { MAP_NAMES, SkinViewer, useSkinViewer, type MapName, type ViewerView } from "@skinhub/viewer";
import type { Item } from "@/lib/steam";

const ORIGIN = process.env.NEXT_PUBLIC_CS2_VIEWER_ORIGIN || "https://skinhub.gg";
const MAPS: MapName[] = [...MAP_NAMES];

const FullscreenIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" /></svg>;
const ResetIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4v6h6M20 20v-6h-6M5.5 15a7 7 0 0 0 11.3 2M18.5 9A7 7 0 0 0 7.2 7" /></svg>;

export default function Viewer3D({ item }: { item: Item }) {
  const stage = useRef<HTMLDivElement>(null);
  const viewer = useSkinViewer();
  const [view, setView] = useState<ViewerView>("gun");
  const [map, setMap] = useState<MapName>("Dust II");
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const onFullscreen = () => setFullscreen(document.fullscreenElement === stage.current);
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => document.removeEventListener("fullscreenchange", onFullscreen);
  }, []);

  useEffect(() => {
    setReady(false);
    setFailed(false);
  }, [item.inspect]);

  async function toggleFullscreen() {
    if (!stage.current) return;
    if (document.fullscreenElement) await document.exitFullscreen();
    else await stage.current.requestFullscreen();
  }

  if (!item.inspect) {
    return <ViewerFallback item={item} text="Для этого предмета Steam не предоставил inspect-ссылку." />;
  }

  return (
    <div ref={stage} className={`skin3d ${fullscreen ? "is-fullscreen" : ""}`}>
      <div className="skin3d-head">
        <div className="skin3d-title">
          <span className="skin3d-live"><i /> LIVE 3D</span>
          <strong>{item.name}</strong>
        </div>
        <div className="skin3d-head-actions">
          <span className={`skin3d-status ${ready ? "ready" : failed ? "error" : ""}`}>
            {ready ? "Точный экземпляр" : failed ? "Ошибка рендера" : "Загрузка модели"}
          </span>
          <button type="button" className="skin3d-icon" onClick={toggleFullscreen} title="Полный экран" aria-label="Полный экран"><FullscreenIcon /></button>
        </div>
      </div>

      <div className="skin3d-canvas">
        <div className="skin3d-grid" />
        <SkinViewer
          inspectLink={item.inspect}
          origin={ORIGIN}
          view={view}
          settings={{
            camera: { fov: view === "gun" ? 25 : 68, defaultZoom: view === "gun" ? 1.08 : 1 },
            quality: { bloom: 1, bloomSpill: 0.25, renderScale: 2, antialias: true, shadows: false },
            environment: { map, rain: true, background: map },
            locale: { labels: { loading: "Загрузка 3D", loadingView: "Переключаем вид", noModel: "3D-модель пока недоступна" } },
          }}
          interactions={{ orbit: true, zoom: true, dragStickers: false, dragCharm: false }}
          handle={viewer}
          onReady={() => { setReady(true); setFailed(false); }}
          onError={() => { setReady(false); setFailed(true); }}
          loading={<div className="skin3d-loader"><i /><span>Собираем точный скин по inspect-ссылке…</span></div>}
          fallback={<ViewerFallback item={item} text="Не удалось получить точную 3D-модель. Показано изображение Steam." compact />}
          className="skin3d-frame"
          title={`3D-просмотр ${item.name}`}
        />
        <div className="skin3d-hint">ЛКМ — вращение · колесо — масштаб · ПКМ — перемещение</div>
      </div>

      <div className="skin3d-controls">
        <div className="skin3d-segment" aria-label="Режим просмотра">
          <button type="button" className={view === "gun" ? "active" : ""} onClick={() => setView("gun")}>Предмет</button>
          <button type="button" className={view === "hands" ? "active" : ""} onClick={() => setView("hands")}>В руках</button>
        </div>
        <label className="skin3d-map">
          <span>Карта и свет</span>
          <select value={map} onChange={(event) => setMap(event.target.value as MapName)}>
            {MAPS.filter((name) => MAP_NAMES.includes(name)).map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
        <button type="button" className="skin3d-reset" onClick={viewer.reload}><ResetIcon /> Сбросить камеру</button>
      </div>
    </div>
  );
}

function ViewerFallback({ item, text, compact = false }: { item: Item; text: string; compact?: boolean }) {
  return (
    <div className={`skin3d-fallback ${compact ? "compact" : ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/api/img?u=${encodeURIComponent(item.icon)}`} alt={item.name} />
      <div><strong>{item.name}</strong><span>{text}</span></div>
    </div>
  );
}
