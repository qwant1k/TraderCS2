-- Baseline of the schema that existed before migrations were introduced.
CREATE TABLE "User" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "steamId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "avatar" TEXT,
  "tradeUrl" TEXT,
  "email" TEXT,
  "bio" TEXT,
  "discord" TEXT,
  "telegram" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Listing" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "wanted" TEXT,
  "variantsJson" TEXT NOT NULL DEFAULT '[]',
  "note" TEXT,
  "itemsJson" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Listing_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "Offer" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "listingId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "itemsJson" TEXT NOT NULL,
  "variantId" TEXT,
  "message" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Offer_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Offer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "InventoryCache" (
  "steamId" TEXT NOT NULL PRIMARY KEY,
  "json" TEXT NOT NULL,
  "fetchedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "User_steamId_key" ON "User"("steamId");
