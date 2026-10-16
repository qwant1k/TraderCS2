BEGIN;

UPDATE "ListingItem"
SET
  "name" = COALESCE(NULLIF(json_extract("dataJson", '$.name'), ''), "hash"),
  "baseKey" = lower(trim(replace(replace(replace(
    COALESCE(NULLIF(json_extract("dataJson", '$.name'), ''), "hash"),
    '★', ''), 'StatTrak™', ''), 'Souvenir ', ''))),
  "type" = json_extract("dataJson", '$.type'),
  "weapon" = json_extract("dataJson", '$.weapon'),
  "wear" = json_extract("dataJson", '$.wear'),
  "float" = json_extract("dataJson", '$.float'),
  "seed" = json_extract("dataJson", '$.seed'),
  "stattrak" = CASE WHEN json_extract("dataJson", '$.stattrak') = 1 THEN 1 ELSE 0 END
WHERE "baseKey" = '' OR "name" = '';

INSERT INTO "Want" (
  "id", "userId", "listingId", "kind", "text", "label", "createdAt"
)
SELECT
  COALESCE(NULLIF(json_extract(j.value, '$.id'), ''), lower(hex(randomblob(16)))),
  l."userId",
  l."id",
  'TEXT',
  COALESCE(NULLIF(json_extract(j.value, '$.text'), ''), j.value),
  COALESCE(NULLIF(json_extract(j.value, '$.text'), ''), j.value),
  CURRENT_TIMESTAMP
FROM "Listing" l, json_each(
  CASE WHEN json_valid(l."variantsJson") THEN l."variantsJson" ELSE '[]' END
) j
WHERE COALESCE(NULLIF(json_extract(j.value, '$.text'), ''), j.value) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM "Want" w
    WHERE w."listingId" = l."id"
      AND w."id" = COALESCE(NULLIF(json_extract(j.value, '$.id'), ''), '')
  );

COMMIT;
