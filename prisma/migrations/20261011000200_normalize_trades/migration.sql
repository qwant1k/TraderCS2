ALTER TABLE "User" ADD COLUMN "emailVerifiedAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "socialVerifiedAt" DATETIME;
ALTER TABLE "Offer" ADD COLUMN "ownerConfirmedAt" DATETIME;
ALTER TABLE "Offer" ADD COLUMN "authorConfirmedAt" DATETIME;
ALTER TABLE "Offer" ADD COLUMN "completedAt" DATETIME;

CREATE TABLE "ListingItem" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "listingId" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "appId" INTEGER NOT NULL,
  "contextId" TEXT NOT NULL,
  "hash" TEXT NOT NULL,
  "dataJson" TEXT NOT NULL,
  CONSTRAINT "ListingItem_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "OfferItem" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "offerId" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "appId" INTEGER NOT NULL,
  "contextId" TEXT NOT NULL,
  "hash" TEXT NOT NULL,
  "dataJson" TEXT NOT NULL,
  CONSTRAINT "OfferItem_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ActiveListingItem" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "listingId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "appId" INTEGER NOT NULL,
  "contextId" TEXT NOT NULL,
  CONSTRAINT "ActiveListingItem_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ActiveListingItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "PriceSnapshot" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "hash" TEXT NOT NULL,
  "steam" REAL,
  "skinport" REAL,
  "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "Listing_status_createdAt_idx" ON "Listing"("status", "createdAt");
CREATE INDEX "Listing_userId_status_idx" ON "Listing"("userId", "status");
CREATE INDEX "Offer_listingId_status_idx" ON "Offer"("listingId", "status");
CREATE INDEX "Offer_userId_createdAt_idx" ON "Offer"("userId", "createdAt");
CREATE INDEX "ListingItem_hash_idx" ON "ListingItem"("hash");
CREATE UNIQUE INDEX "ListingItem_listingId_assetId_key" ON "ListingItem"("listingId", "assetId");
CREATE INDEX "OfferItem_assetId_idx" ON "OfferItem"("assetId");
CREATE UNIQUE INDEX "OfferItem_offerId_assetId_key" ON "OfferItem"("offerId", "assetId");
CREATE INDEX "ActiveListingItem_listingId_idx" ON "ActiveListingItem"("listingId");
CREATE UNIQUE INDEX "ActiveListingItem_userId_appId_contextId_assetId_key" ON "ActiveListingItem"("userId", "appId", "contextId", "assetId");
CREATE UNIQUE INDEX "ActiveListingItem_listingId_assetId_key" ON "ActiveListingItem"("listingId", "assetId");
CREATE INDEX "PriceSnapshot_hash_at_idx" ON "PriceSnapshot"("hash", "at");
