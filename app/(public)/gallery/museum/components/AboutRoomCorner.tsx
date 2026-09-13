"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Mail, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { SocialLinkItem } from "@/components/public/SocialLinkItem";
import { cn } from "@/lib/utils";
import type { MuseumAboutData } from "@/types";

/**
 * The only HTML the About room ever shows — everything readable (name,
 * bio, facts, skills, certificates) is real wall geometry now (see
 * AboutRoomContents.tsx), but a social link or a mailto: has to actually be
 * a clickable element, which 3D text can't be.
 *
 * A collapsed tab flush against the left edge, vertically centered —
 * expand it to reveal the social links/email/Full Profile as a small
 * slide-out drawer. Previously this was always-expanded as a bottom-right
 * card; on mobile that meant a permanent horizontal strip sitting right
 * over the floor/walking area the whole time a visitor was in the room
 * ("parang sagabal" — in the way), on top of needing to wrap once there
 * were more than a couple of social links. A collapsed-by-default sidebar
 * tab stays out of the view entirely until a visitor actually wants it.
 *
 * v3 — the left edge, not the right. In landscape TouchControls stacks the
 * look joystick *and* the jump button up the right-hand side, so a drawer
 * there had barely any clear height to open into and had to be shrunk to
 * fit around them. The left edge carries only the move joystick, down in
 * its bottom corner, which leaves roughly three times the clear run.
 *
 * v2 (same collapsed-tab shape, refined contents): the original drawer
 * force-shrunk SocialLinkItem's fixed 32px icons via a `scale-75` CSS
 * transform — a visual hack rather than a real size, and every icon sat
 * bare with no hover feedback of its own beyond the color swap. Each icon
 * now gets a real circular button (sized to its own natural 32px, not
 * scaled down) with a soft hover background, a small "Connect" label gives
 * the drawer a header instead of just appearing as an unlabeled icon pile,
 * and the icons/actions stagger in on open instead of all popping in at
 * once.
 */
export function AboutRoomCorner({
  data,
  visible,
  landscape = false,
  isCoarsePointer = false,
  open,
  onOpenChange,
}: {
  data: MuseumAboutData | null;
  visible: boolean;
  /** True on touch devices — hides the desktop [F] hint / key handler. */
  isCoarsePointer?: boolean;
  /** Controlled by MuseumScene so opening it can release the pointer lock
   *  (the links aren't clickable while the cursor is captured). */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** True only on a touch device in landscape (MuseumClient.tsx's toggle).
   * The drawer is the one HUD element whose size is bounded by the drawn
   * area's *height* — which in landscape is only as tall as the phone is
   * wide (~390px), while a single column of seven links plus the header,
   * email, divider and Full Profile row comes to ~450px. It used to fit by
   * shrinking: smaller icon buttons, tighter gaps, less padding, and it
   * still filled the screen. It wraps into rows instead now — the width is
   * the axis with room to spare in landscape, and using it means the icons
   * stay the size they are everywhere else. A no-op in portrait, where one
   * column has the height it needs. */
  landscape?: boolean;
}) {
  // Collapse again the moment the room (or panel) that made this visible
  // goes away — walking back into the About room later should always start
  // from the same out-of-the-way collapsed tab, not wherever it was left.
  useEffect(() => {
    if (!visible && open) onOpenChange(false);
  }, [visible, open, onOpenChange]);

  // Desktop: press [F] to toggle the social-links drawer (same idea as the
  // Freedom Wall room's [E] to pin a note). Touch devices use the tab.
  useEffect(() => {
    if (isCoarsePointer || !visible) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "f" && e.key !== "F") return;
      const tag = (document.activeElement as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      e.preventDefault();
      onOpenChange(!open);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isCoarsePointer, visible, open, onOpenChange]);

  if (!data) return null;
  const hasSocials = data.socialLinks.length > 0;
  const hasAnyLinks = hasSocials || Boolean(data.email);
  // One combined, ordered list so the stagger animation below (and the
  // divider placement) only has to reason about a single index space
  // instead of three separately-indexed groups.
  const actionCount = hasAnyLinks ? 1 : 0; // "Full Profile" always renders

  // One size everywhere now. Landscape used to shrink these to 32px buttons
  // around 24px icons purely to survive the height; wrapping into rows means
  // it doesn't have to.
  const slotSize = "w-10 h-10";
  // min(vh, vw) is the drawn area's height in *both* landscape cases, with
  // no need to know which one is in play: real landscape has the viewport
  // itself short (so vh is the smaller), while the forced-landscape CSS
  // rotate leaves the viewport portrait and makes the box as tall as the
  // viewport is wide (so vw is). A bare 70vh measured the phone's full
  // height under the rotate — nearly twice the box — and so capped nothing.
  //
  // 50vmin ≈ 195px on a 390px-tall landscape screen. The wrapped layout
  // below comes in under that with the seven links this site carries, so the
  // cap is a backstop for a much longer list rather than something the
  // drawer normally runs into.
  //
  // Portrait/desktop is capped against the run it actually has rather than a
  // flat 70vh — see anchorY below for what is eating the rest.
  const maxHeight = landscape
    ? "max-h-[min(50vh,50vw)]"
    : "max-h-[min(70vh,100vh_-_19rem)]";
  // Both cases centre the drawer on the *clear run*, not on the whole edge.
  //
  // Landscape keeps TouchControls' move joystick in the bottom-left corner
  // (~2rem off the bottom, 6rem tall) and the top HUD's Back pill in the
  // top-left. 40% centres the drawer between the two.
  //
  // Portrait/desktop had the same problem and no such allowance: it sat at a
  // plain top-1/2, while the bottom-left corner is already spoken for — on
  // desktop by the always-on minimap and its stats card (MuseumClient.tsx: a
  // 240x200 map plus counter row and padding, scaled 0.78, 1rem off the
  // bottom, so ~13.5rem of corner), and on touch portrait by that same move
  // joystick. Centred against the full height, a seven-link column ran
  // straight into it: the map covered the end of the list and the "Full
  // Profile" row was unreachable.
  //
  // MuseumClient already shrank that map to 0.78 for this exact collision.
  // That bought clearance on a tall window and none on a short one, because
  // the drawer's overhang grows with the viewport while the map's height does
  // not — so the fix belongs here, on the thing whose position is wrong,
  // rather than in a third size reduction over there.
  //
  // Reserving ~15rem at the bottom and ~4rem at the top leaves the run the cap
  // above uses, and shifting the centre up by half their difference (5.5rem)
  // is what "centred in what's left" comes out to. Deliberately generous: the
  // minimap's size is an admin setting, and a couple of spare rem costs
  // nothing. A percentage — not 50vh — so this keeps measuring the same box
  // top-1/2 did, whatever the museum's wrapper turns out to be.
  const anchorY = landscape ? "top-[40%]" : "top-[calc(50%_-_5.5rem)]";
  // Four 40px slots and their gaps. Landscape lays the icons out in rows
  // across this width instead of one column down the screen; portrait keeps
  // the column, where height is the axis with room to spare.
  const listClass = landscape
    ? "flex flex-wrap items-center justify-center gap-1 w-[172px]"
    : "flex flex-col items-center gap-1";

  return (
    <>
      {/* Click-away backdrop — desktop only, and only while the drawer is
          open. Sits under the drawer (z-30 vs. its z-40) and over everything
          else, including the 3D canvas, so a click anywhere *outside* the
          drawer's own content closes it — same one-click "hide cursor, walk
          again" gesture a visitor already expects from clicking the scene,
          instead of requiring the exact [F] key or the collapse chevron.
          Kept as its own fixed sibling rather than nested inside the anchored
          wrapper below: that wrapper's motion.div can carry a transform mid-
          animation, which would turn a nested `fixed` element into one scoped
          to *its* box instead of the viewport. Touch has no such gesture to
          shortcut — the tab is already a deliberate tap either way. */}
      {!isCoarsePointer && (
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => onOpenChange(false)}
              className="fixed inset-0 z-30"
              aria-hidden="true"
            />
          )}
        </AnimatePresence>
      )}
      <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className={cn(
            // Left edge — see this file's v3 note. The tab renders first so
            // it sits flush against that edge with the drawer opening out to
            // its right.
            "absolute left-0 -translate-y-1/2 z-40 flex items-center pointer-events-none",
            anchorY
          )}
        >
          {/* Collapsed tab — always shown while in the room, regardless of
              open/closed, so there's always a way back in either direction. */}
          <button
            type="button"
            onClick={() => onOpenChange(!open)}
            aria-label={open ? "Hide profile links" : "Show profile links"}
            aria-expanded={open}
            className={cn(
              "pointer-events-auto flex items-center justify-center w-7 rounded-r-xl bg-black/60 backdrop-blur-md border border-white/10 border-l-0 text-white/60 hover:text-white hover:bg-black/70 transition-colors",
              landscape ? "h-12" : "h-16"
            )}
          >
            {open ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}
          </button>

          {/* Desktop hint — mirrors the Freedom Wall room's "Press E to pin
              a note". Only while closed; the tab / [F] toggle it open. */}
          {!open && !isCoarsePointer && (
            <div className="pointer-events-none ml-1.5 whitespace-nowrap">
              <p className="text-xs text-white/50 bg-black/40 backdrop-blur-sm px-3 py-1.5 rounded-full font-jakarta">
                Press <kbd className="font-bold text-emerald-300">F</kbd> for social links
              </p>
            </div>
          )}

          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ x: -24, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -24, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className={cn(
                  "pointer-events-auto flex flex-col items-center rounded-r-2xl bg-black/70 backdrop-blur-md border border-white/10 border-l-0 shadow-[inset_-1px_0_0_rgba(255,255,255,0.06)] overflow-y-auto",
                  landscape ? "gap-1 pt-2 pb-2.5 px-2" : "gap-1 pt-3 pb-4 px-2.5",
                  maxHeight
                )}
              >
                {hasAnyLinks && (
                  <span
                    className={cn(
                      "font-body text-[9px] tracking-[0.2em] uppercase text-white/35 select-none",
                      landscape ? "mb-1" : "mb-1.5"
                    )}
                  >
                    Connect
                  </span>
                )}
                <div className={listClass}>
                  {data.socialLinks.map((link, i) => (
                    <motion.span
                      key={`${link.iconKey}-${link.url}`}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.18, delay: i * 0.04 }}
                      className={cn(
                        "flex items-center justify-center rounded-full hover:bg-white/10 transition-colors",
                        slotSize
                      )}
                    >
                      <SocialLinkItem
                        url={link.url}
                        label={link.label}
                        iconKey={link.iconKey}
                        hoverColor={link.hoverColor}
                        iconClassName="w-8 h-8"
                      />
                    </motion.span>
                  ))}
                  {data.email && (
                    <motion.a
                      href={`mailto:${data.email}`}
                      title={data.email}
                      aria-label={`Email ${data.displayName}`}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.18, delay: data.socialLinks.length * 0.04 }}
                      className={cn(
                        "flex items-center justify-center rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors",
                        slotSize
                      )}
                    >
                      <Mail size={18} strokeWidth={1.5} />
                    </motion.a>
                  )}
                  {hasAnyLinks && (
                    // basis-full forces a line break in the wrapped landscape
                    // layout, so the rule reads as a rule across the drawer
                    // rather than as one more icon-sized thing in the row.
                    <span
                      className={cn(
                        "h-px bg-white/15",
                        landscape ? "basis-full w-full my-0.5" : "w-6 my-1.5"
                      )}
                    />
                  )}
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.18, delay: (data.socialLinks.length + actionCount) * 0.04 }}
                  >
                    <Link
                      href="/about"
                      title="Full Profile"
                      aria-label="Full Profile"
                      className={cn(
                        "flex items-center justify-center rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors",
                        slotSize
                      )}
                    >
                      <ExternalLink size={17} />
                    </Link>
                  </motion.div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
      </AnimatePresence>
    </>
  );
}
