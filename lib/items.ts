import type { Item } from "./steam";

type StoredItem = { dataJson: string };

export function itemRecord(item: Item) {
  return {
    assetId: item.assetid,
    appId: item.appid,
    contextId: item.contextid,
    hash: item.hash,
    dataJson: JSON.stringify(item),
  };
}

export function storedItems(rows: StoredItem[] | undefined, legacyJson: string): Item[] {
  if (rows?.length) return rows.map((row) => JSON.parse(row.dataJson) as Item);
  return JSON.parse(legacyJson) as Item[];
}
