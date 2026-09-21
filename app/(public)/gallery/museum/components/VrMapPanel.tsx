"use client";

// In-world mirror of MuseumMap.tsx — the [M] corridor overview: every room
// in walking order, the current one highlighted, a "Second Floor" divider
// where the corridor crosses floors, and a press on any row teleports there
// (the same onSelectRoom MuseumClient.tsx turns into a RoomTravelRequest).
// See VrUi.tsx's header for why the DOM panels are mirrored.
import { useState } from "react";
import type { MuseumRoomPublic } from "@/types";
import { VrModal, VrButton, VrLabel, VrRule, VR_COLORS, VR_FONT_TITLE, VR_FONT_BODY_BOLD } from "./VrUi";

const W = 1.05;
const H = 0.96;
const PAD = 0.06;
const TEXT_X = -W / 2 + PAD;
const TEXT_W = W - PAD * 2;
const TOP = H / 2 - PAD;
const ROW_H = 0.1;
const PER_PAGE = 6;

// MuseumMap.tsx's own per-type labels.
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

function roomSubtitle(room: MuseumRoomPublic, freedomWallNoteCount: number): string {
  switch (room.roomType) {
    case "ABOUT":
      return "Meet the artist";
    case "STAIRS":
      return "Connects to the Second Floor";
    case "STORIES":
      return `Tales · ${room.stories.length} book${room.stories.length === 1 ? "" : "s"}`;
    case "FREEDOM_WALL":
      return `Freedom Wall · ${freedomWallNoteCount} sticky note${freedomWallNoteCount === 1 ? "" : "s"}`;
    case "ARCADE":
      return `Arcade · ${room.miniGames.length} available game${room.miniGames.length === 1 ? "" : "s"}`;
    case "COSPLAY":
      return `Cosplay · ${room.cosplays.length} standee${room.cosplays.length === 1 ? "" : "s"}`;
    case "VINYL":
      return `Vinyl Room · ${room.vinyls.length} record${room.vinyls.length === 1 ? "" : "s"}`;
    default:
      return `${ROOM_TYPE_LABEL[room.roomType] ?? room.roomType} · ${room.artworks.length} piece${room.artworks.length === 1 ? "" : "s"}`;
  }
}

export function VrMapPanel({
  rooms,
  currentRoomId,
  onSelectRoom,
  onClose,
  freedomWallNoteCount = 0,
}: {
  rooms: MuseumRoomPublic[];
  currentRoomId: string | null;
  onSelectRoom: (roomId: string) => void;
  onClose: () => void;
  freedomWallNoteCount?: number;
}) {
  // Open on the page the visitor is standing in.
  const currentIndex = Math.max(0, rooms.findIndex((r) => r.id === currentRoomId));
  const [page, setPage] = useState(Math.floor(currentIndex / PER_PAGE));
  const pageCount = Math.max(1, Math.ceil(rooms.length / PER_PAGE));
  const visible = rooms.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);
  const listTop = TOP - 0.13;

  return (
    <VrModal width={W} height={H} onClose={onClose} distance={1.3}>
      <VrLabel position={[TEXT_X, TOP, 0]} width={TEXT_W} fontSize={0.03} font={VR_FONT_TITLE} color={VR_COLORS.text} uppercase letterSpacing={0.12}>
        Museum Map
      </VrLabel>
      <VrLabel position={[TEXT_X, TOP - 0.045, 0]} width={TEXT_W} fontSize={0.02} color={VR_COLORS.textFaint} maxLines={1}>
        Rooms connect in order, north through each doorway — or press one to go straight there.
      </VrLabel>
      <VrRule position={[0, TOP - 0.085, 0]} width={TEXT_W} />

      {visible.map((room, i) => {
        const absolute = page * PER_PAGE + i;
        const isCurrent = room.id === currentRoomId;
        const enteringSecondFloor = room.floor === 1 && (absolute === 0 || rooms[absolute - 1].floor !== 1);
        const rowY = listTop - i * ROW_H;
        return (
          <group key={room.id} position={[0, rowY, 0]}>
            {enteringSecondFloor && (
              <VrLabel position={[TEXT_X, 0.04, 0]} width={TEXT_W} fontSize={0.016} color="#7dd3fc" uppercase letterSpacing={0.12} align="center">
                Second Floor
              </VrLabel>
            )}
            {/* The row is one wide button: press to travel. */}
            <VrButton
              label=""
              width={TEXT_W}
              height={ROW_H - 0.018}
              position={[0, -0.01, 0]}
              variant={isCurrent ? "primary" : "outline"}
              onClick={() => onSelectRoom(room.id)}
            />
            <VrLabel position={[TEXT_X + 0.03, 0.02, 0.004]} width={TEXT_W - 0.24} fontSize={0.026} font={VR_FONT_BODY_BOLD} color={VR_COLORS.text} maxLines={1}>
              {room.name}
            </VrLabel>
            <VrLabel position={[TEXT_X + 0.03, -0.014, 0.004]} width={TEXT_W - 0.24} fontSize={0.019} color={isCurrent ? "#d1fae5" : VR_COLORS.textFaint} maxLines={1}>
              {roomSubtitle(room, freedomWallNoteCount)}
            </VrLabel>
            {isCurrent && (
              <VrLabel position={[TEXT_X + TEXT_W - 0.2, 0.004, 0.004]} width={0.18} fontSize={0.016} color="#a7f3d0" uppercase letterSpacing={0.1}>
                You are here
              </VrLabel>
            )}
          </group>
        );
      })}

      {pageCount > 1 && (
        <group position={[TEXT_X, -H / 2 + PAD + 0.035, 0]}>
          <VrButton label="Previous" width={0.18} height={0.065} fontSize={0.022} position={[0.09, 0, 0]} variant="outline" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} />
          <VrButton label="Next" width={0.18} height={0.065} fontSize={0.022} position={[0.29, 0, 0]} variant="outline" disabled={page >= pageCount - 1} onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} />
          <VrLabel position={[0.42, 0.012, 0]} width={0.3} fontSize={0.02} color={VR_COLORS.textFaint}>
            {`${page + 1} / ${pageCount}`}
          </VrLabel>
        </group>
      )}
    </VrModal>
  );
}
