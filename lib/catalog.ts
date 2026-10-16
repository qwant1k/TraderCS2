export function catalogSearchKey(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/★/g, " ")
    .replace(/stattrak(?:™|tm)/gi, " ")
    .replace(/^\s*souvenir\s+/i, "")
    .replace(/[^a-z0-9а-яё|+\-]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function catalogScore(name: string, weapon: string, query: string) {
  const n = catalogSearchKey(name);
  const w = catalogSearchKey(weapon);
  const queryWords = query.split(" ").filter(Boolean);
  const nameWords = n.split(/[\s|]+/).filter(Boolean);
  if (n === query) return 0;
  if (n.startsWith(query)) return 1;
  if (queryWords.every((word) => nameWords.some((part) => part.startsWith(word)))) return 2;
  if (w === query) return 3;
  if (n.includes(`| ${query}`)) return 4;
  if (n.includes(query)) return 5;
  return 6;
}
