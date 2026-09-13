"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import type { MuseumRoomPublic } from "@/types";
import { MuseumDoor } from "./MuseumDoor";

// Museum entrance lobby — the first screen a visitor sees before stepping
// into the 3D world. Shows every room as a MuseumDoor card so the visitor
// can choose where to begin (or just hit "Enter" to start at the entry room).
//
// Only mounted for visitors whose device supports WebGL — the unsupported
// branch in MuseumClient.tsx skips straight to MuseumGridFallback.
export function MuseumLobby({
  rooms,
  initialRoomId,
  onEnter,
}: {
  rooms: MuseumRoomPublic[];
  /** The admin-designated entry room — pre-selected in the lobby. */
  initialRoomId: string;
  /** Called with the room the visitor clicked (or the entry room if they just
   *  hit "Enter"). MuseumClient.tsx uses this to set the initial travel target
   *  before showing the 3D scene. */
  onEnter: (roomId: string) => void;
}) {
  const [selectedId, setSelectedId] = useState<string>(initialRoomId);

  const standardRooms = rooms.filter((r) => r.roomType !== "ABOUT");
  const aboutRoom = rooms.find((r) => r.roomType === "ABOUT") ?? null;

  // Single-room museum: skip the selection grid entirely and just show a
  // centered "Enter" prompt — no point picking from one option.
  const singleRoom = rooms.length === 1;

  function handleDoorClick(roomId: string) {
    setSelectedId(roomId);
    // Double-tap / re-click of already-selected door immediately enters.
    if (roomId === selectedId) onEnter(roomId);
  }

  return (
    <motion.div
      className="absolute inset-0 z-40 flex flex-col items-center justify-center overflow-y-auto"
      style={{
        background:
          "radial-gradient(ellipse 120% 80% at 50% 110%, rgba(12,10,20,0.0) 0%, #08070a 60%)",
        backgroundColor: "#08070a",
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="w-full max-w-2xl px-6 py-12 flex flex-col items-center gap-8">

        {/* Header */}
        <div className="flex flex-col items-center gap-2 text-center">
          <p
            className="font-mono text-[9px] tracking-[0.30em] uppercase"
            style={{ color: "rgba(228,222,210,0.30)" }}
          >
            Digital Museum
          </p>
          <h1
            className="font-grotesk text-xl font-medium"
            style={{ color: "rgba(228,222,210,0.82)" }}
          >
            {singleRoom ? rooms[0].name : "Choose a Gallery"}
          </h1>
          {!singleRoom && (
            <p
              className="font-body text-[12px]"
              style={{ color: "rgba(228,222,210,0.28)" }}
            >
              Select a room to begin, or press Enter to start at the main hall.
            </p>
          )}
        </div>

        {/* Door grid — hidden for single-room museums */}
        {!singleRoom && (
          <div className="w-full flex flex-col gap-3">
            {/* Standard rooms — 2 or 3 columns depending on count */}
            {standardRooms.length > 0 && (
              <div
                className="grid gap-3"
                style={{
                  gridTemplateColumns: `repeat(${Math.min(standardRooms.length, 3)}, 1fr)`,
                }}
              >
                {standardRooms.map((room, i) => (
                  <MuseumDoor
                    key={room.id}
                    title={room.name}
                    roomNumber={i + 1}
                    roomType={room.roomType}
                    isFeatured={false}
                    isCurrent={room.id === selectedId}
                    artworkCount={room.artworks.length}
                    layout="portrait"
                    onClick={() => handleDoorClick(room.id)}
                    className="h-52"
                  />
                ))}
              </div>
            )}

            {/* About ScriptOverNovel — always full-width landscape at the bottom */}
            {aboutRoom && (
              <MuseumDoor
                title={aboutRoom.name}
                roomType="ABOUT"
                isFeatured
                isCurrent={aboutRoom.id === selectedId}
                layout="landscape"
                onClick={() => handleDoorClick(aboutRoom.id)}
              />
            )}
          </div>
        )}

        {/* Enter button */}
        <motion.button
          type="button"
          onClick={() => onEnter(selectedId)}
          className="group flex items-center gap-3 px-8 py-3 rounded-[2px] transition-all duration-300"
          style={{
            background: "linear-gradient(135deg, rgba(228,222,210,0.10), rgba(228,222,210,0.06))",
            border: "1px solid rgba(228,222,210,0.18)",
            color: "rgba(228,222,210,0.80)",
          }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background =
              "linear-gradient(135deg, rgba(228,222,210,0.16), rgba(228,222,210,0.10))";
            e.currentTarget.style.borderColor = "rgba(228,222,210,0.30)";
            e.currentTarget.style.color = "rgba(228,222,210,0.95)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background =
              "linear-gradient(135deg, rgba(228,222,210,0.10), rgba(228,222,210,0.06))";
            e.currentTarget.style.borderColor = "rgba(228,222,210,0.18)";
            e.currentTarget.style.color = "rgba(228,222,210,0.80)";
          }}
        >
          <span className="font-grotesk text-[13px] font-medium tracking-wide">
            {singleRoom ? "Enter Museum" : "Enter Selected Room"}
          </span>
          <ArrowRight
            size={14}
            strokeWidth={1.5}
            className="transition-transform duration-300 group-hover:translate-x-1"
          />
        </motion.button>

        {/* Hint: click again to enter immediately */}
        {!singleRoom && (
          <p
            className="font-mono text-[9px] tracking-[0.15em] uppercase"
            style={{ color: "rgba(228,222,210,0.18)" }}
          >
            Tap a door twice to enter immediately
          </p>
        )}
      </div>
    </motion.div>
  );
}
