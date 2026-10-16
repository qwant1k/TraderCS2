import type { Item } from "./steam";

export type FeedItemView = Item & { priceUsd?: number };

export type FeedLot = {
  id: string;
  createdAt: string;
  owner: {
    steamId: string;
    name: string;
    avatar: string | null;
    trustLevel: 0 | 1 | 2 | 3;
  };
  offers: FeedItemView[];
  matchedMine?: FeedItemView;
  matchedAssetIds?: string[];
  matchedWishes?: Record<string, string>;
  wishVariantId?: string;
  altText?: string;
  wantsText?: string;
  mutual: boolean;
  giveUsd?: number;
  getUsd?: number;
  deltaUsd?: number;
};

export type FeedResponse = {
  priority: FeedLot[];
  rest: FeedLot[];
  counts: { all: number; wanted: number; mutual: number };
  wantedByAssetId: Record<string, number>;
};
