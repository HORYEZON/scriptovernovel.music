"use client";

// lib/useItemAvailability.ts
//
// Follow-up live check for a persisted (localStorage) list of ids against
// one of the "/availability" endpoints (app/api/artworks/availability,
// app/api/products/availability) — shared by WishlistClient and
// CartClient, which have the exact same staleness problem for two
// different resources: both stores keep a point-in-time snapshot of an
// artwork/product, which can outlive the row it was saved from.
//
// Returns `null` until the check resolves — callers should treat that as
// "not known to be removed yet" (don't flag anything) rather than "removed
// pending confirmation," so a wishlist/cart never flashes every card as
// gone for the instant before the response arrives.
import { useEffect, useState } from "react";

export function useItemAvailability(
  endpoint: string,
  ids: string[]
): Record<string, boolean> | null {
  // Ids joined into one stable string so the effect only re-fires when the
  // actual set of ids changes, not on every render a new array literal
  // would otherwise trigger (items.map(...) is a fresh array each render).
  const key = [...new Set(ids)].sort().join(",");
  const [result, setResult] = useState<Record<string, boolean> | null>(null);

  useEffect(() => {
    if (!key) {
      setResult({});
      return;
    }
    let cancelled = false;
    fetch(`${endpoint}?ids=${encodeURIComponent(key)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data && typeof data === "object") setResult(data);
      })
      .catch(() => {
        // Offline / transient — leave whatever's already known (or still
        // unknown) alone rather than flagging every item as removed.
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, endpoint]);

  return result;
}
