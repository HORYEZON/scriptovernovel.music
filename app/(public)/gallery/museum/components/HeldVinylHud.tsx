"use client";

// HeldVinylHud.tsx
//
// The little "you're carrying a record" card, shown while a record is in the
// visitor's hands (MuseumScene's heldVinyl). A DOM overlay like
// InteractionPrompt — no per-frame work. It exists so a visitor who took a
// record and then wandered off still knows what they are holding and where
// to take it.
//
// Corner depends on the pointer. With a mouse there is nothing in the
// bottom-right, so it sits there, out of the way of the crosshair. On touch
// that corner is TouchControls' territory — the look pad and the jump
// button in portrait, the whole right-hand stack in landscape — and the card
// covered the joystick in both. So on a coarse pointer it moves to the
// top-right instead, tucked under MuseumClient's HUD stack (top-4, pill row,
// then the room indicator + dots, ~96px of it) rather than over the
// controls the visitor is actively dragging.
import { AnimatePresence, motion } from "framer-motion";
import Image from "@/components/ui/SafeImage";
import { Disc3 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MuseumVinylSleeve } from "@/types";

export function HeldVinylHud({
  vinyl,
  visible,
  onPutBack,
  isCoarsePointer,
}: {
  vinyl: MuseumVinylSleeve | null;
  visible: boolean;
  /** Return the record to its sleeve from here — a way out for a visitor
   *  who took one and doesn't want to walk it back. */
  onPutBack: () => void;
  isCoarsePointer?: boolean;
}) {
  // Slides in from whichever edge it is anchored to.
  const offset = isCoarsePointer ? -12 : 12;

  return (
    <AnimatePresence>
      {visible && vinyl && (
        <motion.div
          initial={{ opacity: 0, y: offset }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: offset }}
          transition={{ duration: 0.2 }}
          className={cn(
            "absolute right-4 z-40 flex items-center gap-3 rounded-2xl border border-white/10 bg-black/70 p-2 pr-3 backdrop-blur-md pointer-events-auto",
            isCoarsePointer
              ? // Under the HUD stack, and narrower so it doesn't reach back
                // across the screen towards the room indicator. 144px because
                // MuseumClient's stack measures 95px on a 393px-wide phone but
                // grows to ~135px when its pill row wraps to two lines (which
                // it does once the museum soundtrack toggle joins the row) —
                // clearing the taller case matters more than hugging the
                // shorter one.
                "top-36 max-w-[min(17rem,calc(100vw-2rem))]"
              : "bottom-4 max-w-[min(20rem,calc(100vw-2rem))]"
          )}
        >
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-black">
            <Image src={vinyl.coverImageUrl} alt="" fill className="object-cover" />
            <span className="absolute -right-2 -top-2 rounded-full bg-black/80 p-1 text-sepia-light">
              <Disc3 size={12} className="animate-[spin_4s_linear_infinite]" />
            </span>
          </div>
          <div className="min-w-0">
            <p className="font-body text-[10px] uppercase tracking-[0.3em] text-sepia-light">Holding</p>
            <p className="truncate font-display text-sm italic text-white">{vinyl.title}</p>
            <p className="truncate font-body text-[11px] text-white/50">
              {isCoarsePointer ? "Walk to the deck and tap Put on" : "Walk to the deck · [E] to put it on"}
            </p>
          </div>
          <button
            type="button"
            onClick={onPutBack}
            className="ml-1 shrink-0 rounded-full border border-white/15 px-2.5 py-1.5 font-body text-[10px] uppercase tracking-wider text-white/70 hover:bg-white/10 hover:text-white"
          >
            Put back
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
