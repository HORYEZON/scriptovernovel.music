"use client";

// components/public/minigames/games/OrderList.tsx
//
// Shared board for Tracklist Order and Release Timeline: a list of items in
// a shuffled order; tap two to swap them. The client knows the target
// (order[slot] = the item's true index) only to detect completion — the
// server replays the swaps against its own copy either way.
import { useState } from "react";
import { ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { imageVariantUrl } from "@/lib/images/variants";

export interface OrderItem {
  key: string;
  label: string;
  imageUrl?: string;
}

export function OrderList({
  items,
  order,
  interactive,
  onProgress,
  onComplete,
  playMoveSound,
  hint,
}: {
  /** Items as shown, slot by slot. */
  items: OrderItem[];
  /** order[slot] = true index of the item in that slot. */
  order: number[];
  interactive: boolean;
  onProgress: (moves: number) => void;
  onComplete: (swaps: [number, number][]) => void;
  playMoveSound: () => void;
  hint: string;
}) {
  const [board, setBoard] = useState(order.map((_, i) => i)); // board[slot] = original slot
  const [selected, setSelected] = useState<number | null>(null);
  const [swaps, setSwaps] = useState<[number, number][]>([]);
  const [done, setDone] = useState(false);

  function tap(slot: number) {
    if (!interactive || done) return;
    if (selected === null) {
      setSelected(slot);
      return;
    }
    if (selected === slot) {
      setSelected(null);
      return;
    }
    playMoveSound();
    const next = [...board];
    [next[selected], next[slot]] = [next[slot], next[selected]];
    const nextSwaps: [number, number][] = [...swaps, [selected, slot]];
    setBoard(next);
    setSwaps(nextSwaps);
    setSelected(null);
    onProgress(nextSwaps.length);
    // Solved when every slot holds the item whose true index equals the slot.
    if (next.every((orig, s) => order[orig] === s)) {
      setDone(true);
      onComplete(nextSwaps);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <ol className="space-y-2">
        {board.map((orig, slot) => {
          const item = items[orig];
          return (
            <li key={item.key}>
              <button
                type="button"
                onClick={() => tap(slot)}
                disabled={!interactive || done}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
                  selected === slot ? "border-sepia bg-sepia/10" : "border-white/15 hover:border-white/50 hover:bg-white/5",
                  done && "border-emerald-400/40",
                  "disabled:cursor-default"
                )}
              >
                <span className="w-6 shrink-0 font-mono text-xs text-white/40">{String(slot + 1).padStart(2, "0")}</span>
                {item.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imageVariantUrl(item.imageUrl, "thumb")} alt="" draggable={false} className="h-10 w-10 shrink-0 rounded-md object-cover" />
                )}
                <span className="min-w-0 flex-1 truncate font-body text-sm text-white">{item.label}</span>
                <ArrowUpDown size={14} className="shrink-0 text-white/30" />
              </button>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-center font-body text-[11px] text-white/40">{hint}</p>
    </div>
  );
}
