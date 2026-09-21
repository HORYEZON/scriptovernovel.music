"use client";

import { X, MapPin, Landmark, Image as ImageIcon, Sparkles, User, StickyNote, ArrowDown, ArrowUpToLine, ShoppingBag, BookOpen, Gamepad2, Shirt, Disc3, type LucideProps } from "lucide-react";
import type { ForwardRefExoticComponent, RefAttributes } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { MuseumRoomPublic } from "@/types";

type LucideIcon = ForwardRefExoticComponent<Omit<LucideProps, "ref"> & RefAttributes<SVGSVGElement>>;
const ROOM_TYPE_ICON: Record<string, LucideIcon> = {
  MAIN_HALL: Landmark,
  GALLERY: ImageIcon,
  SPECIAL_EXHIBITION: Sparkles,
  ABOUT: User,
  FREEDOM_WALL: StickyNote,
  STAIRS: ArrowUpToLine,
  SERVICES: ShoppingBag,
  STORIES: BookOpen,
  ARCADE: Gamepad2,
  COSPLAY: Shirt,
  VINYL: Disc3,
};

const ROOM_TYPE_LABEL: Record<string, string> = {
  MAIN_HALL: "Main Hall",
  GALLERY: "Gallery",
  SPECIAL_EXHIBITION: "Special Exhibition",
  ABOUT: "About",
  FREEDOM_WALL: "Freedom Wall",
  STAIRS: "Stairs",
  SERVICES: "Services",
  STORIES: "Tales",
  ARCADE: "Arcade",
  COSPLAY: "Cosplay",
  VINYL: "Vinyl Room",
};

// Corridor overview — every room is one connected walkable space now (see
// roomLayout.ts), shown in walking order with wherever the visitor
// currently is highlighted. Clicking a row teleports there (see
// onSelectRoom — MuseumClient.tsx turns this into a RoomTravelRequest that
// PlayerControls.tsx picks up), so a visitor doesn't have to walk the whole
// corridor to backtrack to an earlier room.
export function MuseumMap({
  open,
  rooms,
  currentRoomId,
  onClose,
  onSelectRoom,
  freedomWallNoteCount = 0,
}: {
  open: boolean;
  rooms: MuseumRoomPublic[];
  currentRoomId: string | null;
  onClose: () => void;
  /** Room row clicked — MuseumClient.tsx both teleports there and closes this modal. */
  onSelectRoom: (roomId: string) => void;
  /** How many sticky notes are currently on the Freedom Wall — that room
   *  carries no `artworks` of its own, so without this its row would always
   *  read "0 artworks" the way the Stories Room's own `stories.length`
   *  special-case already avoids for podiums. */
  freedomWallNoteCount?: number;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
        >
          <motion.div
            // min(80vh, 100%), not a bare 80vh. `vh` measures the real
            // browser viewport, which under the museum's forced-landscape
            // CSS rotate is not the box this modal is actually drawn into:
            // the overlay above is `fixed inset-0`, and a transformed
            // ancestor becomes the containing block for fixed descendants,
            // so it fills the *pre-rotation* box — as tall as the phone is
            // wide (~390px), while 80vh still measured 80% of the phone's
            // ~845px height. The modal was sized to nearly twice the space
            // it had and overflowed straight off the screen. The 100% term
            // resolves against that real containing block, so it wins
            // exactly when the two disagree; desktop and un-rotated mobile,
            // where 80vh is the smaller of the two, are unchanged.
            className="relative w-full max-w-md bg-[#121212] border border-white/10 rounded-2xl overflow-hidden shadow-2xl max-h-[min(80vh,100%)] flex flex-col"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 p-5 border-b border-white/10">
              <div className="flex items-center gap-2">
                <MapPin size={16} className="text-emerald-400" />
                <h2 className="font-grotesk text-sm uppercase tracking-widest text-white">
                  Museum Map
                </h2>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Close map"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto">
              <p className="font-body text-[11px] text-white/40 mb-4 text-center">
                Rooms connect in order, north through each doorway — or tap one below to go straight there.
              </p>
              <div className="flex flex-col items-stretch">
                {rooms.map((room, i) => {
                  const Icon = ROOM_TYPE_ICON[room.roomType] ?? ImageIcon;
                  const isCurrent = room.id === currentRoomId;
                  // A "— Second Floor —" divider the moment the corridor
                  // crosses into floor 1 (see docs/SecondFloorStairs_Spec.md)
                  // — this list is walking order already, so the boundary
                  // is just wherever floor goes from 0 to 1.
                  const enteringSecondFloor = room.floor === 1 && (i === 0 || rooms[i - 1].floor !== 1);
                  return (
                    <div key={room.id} className="flex flex-col items-center w-full">
                      {enteringSecondFloor && (
                        <div className="flex items-center gap-2 w-full my-1">
                          <div className="h-px flex-1 bg-sky-500/20" />
                          <span className="font-body text-[10px] uppercase tracking-wider text-sky-400">
                            Second Floor
                          </span>
                          <div className="h-px flex-1 bg-sky-500/20" />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => onSelectRoom(room.id)}
                        title={`Travel to ${room.name}`}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-colors ${
                          isCurrent
                            ? "bg-emerald-500/10 border-emerald-500/30"
                            : "border-white/10 hover:bg-white/5 hover:border-white/20"
                        }`}
                      >
                        <div
                          className={`shrink-0 p-2 rounded-lg ${
                            isCurrent ? "bg-emerald-500/20 text-emerald-400" : "bg-white/5 text-white/60"
                          }`}
                        >
                          <Icon size={16} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-body text-sm text-white truncate">{room.name}</p>
                          <p className="font-body text-[11px] text-white/40">
                            {room.roomType === "ABOUT"
                              ? "Meet the artist"
                              : room.roomType === "STAIRS"
                              ? "Connects to the Second Floor"
                              : // The Stories Room carries no wall artworks —
                                // its contents stand on podiums, so counting
                                // `artworks` would always read "0 artworks".
                                room.roomType === "STORIES"
                              ? `Tales · ${room.stories.length} book${room.stories.length === 1 ? "" : "s"}`
                              : // Same reasoning for the Freedom Wall — its
                                // content is visitor-submitted sticky notes,
                                // not `artworks`, which would otherwise always
                                // read "0 artworks" here.
                                room.roomType === "FREEDOM_WALL"
                              ? `Freedom Wall · ${freedomWallNoteCount} sticky note${freedomWallNoteCount === 1 ? "" : "s"}`
                              : // And again for the Arcade Room — what stands
                                // in it is one cabinet (or poster) per playable
                                // mini game, mirrored from the Minigames
                                // module, so `miniGames` is the only count that
                                // means anything here.
                                room.roomType === "ARCADE"
                              ? `Arcade · ${room.miniGames.length} available game${room.miniGames.length === 1 ? "" : "s"}`
                              : // And the Cosplay Room, whose contents are
                                // standees mirrored from the Cosplays module —
                                // `cosplays` is the only count that means
                                // anything here for the same reason.
                                room.roomType === "COSPLAY"
                              ? `Cosplay · ${room.cosplays.length} standee${room.cosplays.length === 1 ? "" : "s"}`
                              : // And the Vinyl Room — records mirrored from
                                // Music → Vinyls.
                                room.roomType === "VINYL"
                              ? `Vinyl Room · ${room.vinyls.length} record${room.vinyls.length === 1 ? "" : "s"}`
                              : `${ROOM_TYPE_LABEL[room.roomType] ?? room.roomType} · ${room.artworks.length} piece${room.artworks.length === 1 ? "" : "s"}`}
                          </p>
                        </div>
                        {isCurrent && (
                          <span className="shrink-0 font-body text-[10px] uppercase tracking-wider text-emerald-400">
                            You are here
                          </span>
                        )}
                      </button>
                      {i < rooms.length - 1 && (
                        <ArrowDown size={14} className="text-white/20 my-1.5" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
