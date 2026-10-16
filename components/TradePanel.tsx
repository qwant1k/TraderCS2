import ItemGrid from "./ItemGrid";
import { parseTradeUrl, type Item } from "@/lib/steam";

// Панель принятого обмена. Кнопка открывает страницу Steam-трейда с партнёром.
// Расширение TradeGG Helper (если установлено) читает data-tradegg-plan, подставляет предметы
// и проверяет итоговый список. Без расширения предметы отмечаются вручную по списку ниже.
export default function TradePanel({ partnerTradeUrl, give, receive }: { partnerTradeUrl: string; give: Item[]; receive: Item[] }) {
  const partner = parseTradeUrl(partnerTradeUrl)?.partner;
  const slim = (it: Item) => ({ assetid: it.assetid, appid: it.appid, contextid: it.contextid, name: it.name });
  const plan = partner ? JSON.stringify({ partner, give: give.map(slim), receive: receive.map(slim) }) : undefined;

  return (
    <div className="card" style={{ borderColor: "rgba(46,229,157,.5)" }}>
      <div className="row between">
        <strong>Предложение принято. Отправьте обмен в Steam</strong>
        <a className="btn ok" href={partnerTradeUrl} target="_blank" rel="noopener noreferrer" data-tradegg-plan={plan}>
          Открыть трейд в Steam
        </a>
      </div>
      <div className="two" style={{ marginTop: 12 }}>
        <div>
          <div className="muted" style={{ marginBottom: 6 }}>Вы отдаёте:</div>
          <ItemGrid items={give} />
        </div>
        <div>
          <div className="muted" style={{ marginBottom: 6 }}>Вы получаете:</div>
          <ItemGrid items={receive} />
        </div>
      </div>
      <div className="muted" style={{ marginTop: 10 }}>
        С расширением TradeGG Helper предметы подставятся сами, а список будет сверен. Без него отметьте предметы вручную.
        Перед подтверждением в Steam всегда сверяйте предметы. Сайт никогда не просит пароль Steam.
      </div>
    </div>
  );
}
