"use client";

import { useRef, useState } from "react";
import Image from "@/components/ui/SafeImage";
import {
  AlertTriangle,
  ChevronDown,
  ImagePlus,
  Save,
  ToggleLeft,
  ToggleRight,
  Trash2,
} from "lucide-react";
import toast from "@/lib/toast";
import { toggleStaged } from "@/lib/admin/toggleToast";
import { cn } from "@/lib/utils";
import { describePreset } from "@/lib/minigames/registry";
import { formatScore, maxPossibleScore } from "@/lib/minigames/scoring";
import {
  MAX_LEADERBOARD_SIZE,
  MAX_REWARD_DESCRIPTION_LENGTH,
  MAX_SCORE_MULTIPLIER,
  MIN_LEADERBOARD_SIZE,
  MIN_SCORE_MULTIPLIER,
  TIME_LIMIT_PRESETS,
} from "@/lib/minigames/config";
import {
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  type AdminGameConfig,
  type Difficulty,
  type DifferenceRegion,
} from "@/lib/minigames/types";
import { GameIcon } from "@/components/public/minigames/GameIcon";
import { ArtworkPicker } from "./ArtworkPicker";
import { DifferenceEditor } from "./DifferenceEditor";
import type { ArtworkOption } from "./MiniGamesClient";
import { UnsavedChangesBar } from "@/components/admin/UnsavedChangesBar";

interface GameConfigPanelProps {
  game: AdminGameConfig;
  artworks: ArtworkOption[];
  onSaved: () => void;
}

/** The editable slice of a game's configuration. */
interface Draft {
  enabled: boolean;
  difficulty: Difficulty;
  artworkId: string | null;
  secondaryArtworkId: string | null;
  timeLimitSec: number;
  scoreMultiplier: number;
  leaderboardEnabled: boolean;
  leaderboardSize: number;
  rewardEnabled: boolean;
  rewardThreshold: number;
  rewardDescription: string;
  rewardRequireEmail: boolean;
  differences: DifferenceRegion[];
}

function draftFrom(game: AdminGameConfig): Draft {
  return {
    enabled: game.enabled,
    difficulty: game.difficulty,
    artworkId: game.artworkId,
    secondaryArtworkId: game.secondaryArtworkId,
    timeLimitSec: game.timeLimitSec,
    scoreMultiplier: game.scoreMultiplier,
    leaderboardEnabled: game.leaderboardEnabled,
    leaderboardSize: game.leaderboardSize,
    rewardEnabled: game.rewardEnabled,
    rewardThreshold: game.rewardThreshold,
    rewardDescription: game.rewardDescription ?? "",
    rewardRequireEmail: game.rewardRequireEmail,
    differences: game.differences,
  };
}

export function GameConfigPanel({
  game,
  artworks,
  onSaved,
}: GameConfigPanelProps) {
  const initial = draftFrom(game);
  const [draft, setDraft] = useState<Draft>(initial);
  const savedRef = useRef<Draft>(initial);
  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState<"primary" | "secondary" | null>(null);

  const isDirty = JSON.stringify(draft) !== JSON.stringify(savedRef.current);
  const update = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const primaryArtwork =
    artworks.find((artwork) => artwork.id === draft.artworkId) ??
    (draft.artworkId === game.artworkId ? game.artwork : null);
  const secondaryArtwork =
    artworks.find((artwork) => artwork.id === draft.secondaryArtworkId) ??
    (draft.secondaryArtworkId === game.secondaryArtworkId
      ? game.secondaryArtwork
      : null);

  // Recomputed live from the same function the server scores with, so the
  // multiplier slider shows its real consequence rather than an estimate.
  const ceiling = maxPossibleScore(
    game.type,
    draft.difficulty,
    draft.scoreMultiplier
  );

  async function save() {
    setSaving(true);
    try {
      const response = await fetch("/api/minigames/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: game.type,
          ...draft,
          rewardDescription: draft.rewardDescription.trim() || null,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(data?.error ?? "Could not save these settings");
        return;
      }
      savedRef.current = { ...draft };
      toast.success(`${game.name} saved`);
      onSaved();
    } catch {
      toast.error("Could not reach the server");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="admin-card border rounded-2xl backdrop-blur-md shadow-sm p-4 sm:p-6 space-y-6">
        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4 border-b border-black/10 dark:border-white/10 pb-4">
          <div className="flex items-start gap-3 min-w-0">
            <span className="shrink-0 w-10 h-10 rounded-xl bg-sepia/10 text-sepia flex items-center justify-center">
              <GameIcon icon={game.icon} size={19} />
            </span>
            <div className="min-w-0">
              <h2 className="font-jakarta text-base font-semibold text-ink dark:text-cream">
                {game.name}
              </h2>
              <p className="font-body text-xs text-ink-400 dark:text-ink-300 mt-0.5">
                {game.description}
              </p>
            </div>
          </div>

          <Toggle
            checked={draft.enabled}
            onChange={(value) => {
              update("enabled", value);
              toggleStaged(game.name, value);
            }}
            label={draft.enabled ? "Turn this game off" : "Turn this game on"}
          />
        </div>

        {game.unavailableReason && (
          <p className="flex items-start gap-2 rounded-xl bg-amber-500/10 border border-amber-500/30 px-3 py-2.5 font-body text-xs text-amber-700 dark:text-amber-300">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            {game.unavailableReason}
          </p>
        )}

        {/* ── Artwork ── */}
        <section className="space-y-3">
          <SectionLabel>Artwork</SectionLabel>
          <div
            className={cn(
              "grid gap-3",
              game.needsSecondaryArtwork && "sm:grid-cols-2"
            )}
          >
            <ArtworkSlot
              label={game.needsSecondaryArtwork ? "Original image" : "Artwork"}
              artwork={primaryArtwork}
              onPick={() => setPicking("primary")}
              onClear={() => update("artworkId", null)}
            />
            {game.needsSecondaryArtwork && (
              <ArtworkSlot
                label="Modified image"
                artwork={secondaryArtwork}
                onPick={() => setPicking("secondary")}
                onClear={() => update("secondaryArtworkId", null)}
              />
            )}
          </div>
          <p className="font-body text-xs text-ink-400 dark:text-ink-300">
            Games use the artwork you already manage under Artworks — nothing is
            uploaded or duplicated here.
          </p>
        </section>

        {/* ── Difficulty ── */}
        <section className="space-y-3">
          <SectionLabel>Difficulty</SectionLabel>
          <div className="grid grid-cols-3 gap-2">
            {DIFFICULTIES.map((difficulty) => {
              const active = draft.difficulty === difficulty;
              return (
                <button
                  key={difficulty}
                  type="button"
                  onClick={() => update("difficulty", difficulty)}
                  aria-pressed={active}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-left transition-colors",
                    active
                      ? "border-sepia bg-sepia/10"
                      : "border-black/10 dark:border-white/10 hover:border-sepia/40"
                  )}
                >
                  <span className="block font-jakarta text-sm font-medium text-ink dark:text-cream">
                    {DIFFICULTY_LABELS[difficulty]}
                  </span>
                  <span className="block font-body text-[11px] text-ink-400 dark:text-ink-300 mt-0.5">
                    {describePreset(game.type, difficulty)}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* ── Find the Difference hotspots ── */}
        {game.needsSecondaryArtwork && (
          <section className="space-y-3">
            <SectionLabel>Differences</SectionLabel>
            <DifferenceEditor
              original={primaryArtwork}
              modified={secondaryArtwork}
              regions={draft.differences}
              onChange={(regions) => update("differences", regions)}
            />
          </section>
        )}

        {/* ── Scoring ── */}
        <section className="space-y-4">
          <SectionLabel>Scoring &amp; time</SectionLabel>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="mg-time-limit"
                className="block font-body text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2"
              >
                Time limit
              </label>
              <div className="relative">
                <select
                  id="mg-time-limit"
                  value={draft.timeLimitSec}
                  onChange={(event) =>
                    update("timeLimitSec", Number(event.target.value))
                  }
                  className="w-full px-4 py-2.5 pr-10 rounded-xl admin-input border text-ink dark:text-cream focus:outline-none focus:border-sepia transition-colors text-sm cursor-pointer appearance-none"
                >
                  {TIME_LIMIT_PRESETS.map((preset) => (
                    <option key={preset.value} value={preset.value}>
                      {preset.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={14}
                  className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-ink-400"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="mg-multiplier"
                className="block font-body text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2"
              >
                Score multiplier — {draft.scoreMultiplier.toFixed(1)}×
              </label>
              <input
                id="mg-multiplier"
                type="range"
                min={MIN_SCORE_MULTIPLIER}
                max={MAX_SCORE_MULTIPLIER}
                step={0.1}
                value={draft.scoreMultiplier}
                onChange={(event) =>
                  update("scoreMultiplier", Number(event.target.value))
                }
                className="w-full accent-sepia"
              />
              <p className="font-body text-xs text-ink-400 dark:text-ink-300 mt-1">
                Best possible score:{" "}
                <strong className="text-ink dark:text-cream font-mono">
                  {formatScore(ceiling)}
                </strong>
              </p>
            </div>
          </div>
        </section>

        {/* ── Leaderboard ── */}
        <section className="space-y-3">
          <SectionLabel>Leaderboard</SectionLabel>
          <div className="flex items-center justify-between gap-3">
            <p className="font-body text-sm text-ink dark:text-cream">
              Record scores for this game
            </p>
            <Toggle
              checked={draft.leaderboardEnabled}
              onChange={(value) => {
                update("leaderboardEnabled", value);
                toggleStaged("Leaderboard", value);
              }}
              label={
                draft.leaderboardEnabled
                  ? "Turn the leaderboard off"
                  : "Turn the leaderboard on"
              }
            />
          </div>

          {draft.leaderboardEnabled && (
            <div>
              <label
                htmlFor="mg-board-size"
                className="block font-body text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2"
              >
                Rows shown — {draft.leaderboardSize}
              </label>
              <input
                id="mg-board-size"
                type="range"
                min={MIN_LEADERBOARD_SIZE}
                max={MAX_LEADERBOARD_SIZE}
                value={draft.leaderboardSize}
                onChange={(event) =>
                  update("leaderboardSize", Number(event.target.value))
                }
                className="w-full accent-sepia"
              />
            </div>
          )}
        </section>

        {/* ── Reward ── */}
        <section className="space-y-3">
          <SectionLabel>Reward</SectionLabel>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-body text-sm text-ink dark:text-cream">
                Offer a reward for a high score
              </p>
              <p className="font-body text-xs text-ink-400 dark:text-ink-300 mt-0.5">
                You get an email whenever a visitor qualifies and claims.
              </p>
            </div>
            <Toggle
              checked={draft.rewardEnabled}
              onChange={(value) => {
                update("rewardEnabled", value);
                toggleStaged("High-score reward", value);
              }}
              label={
                draft.rewardEnabled
                  ? "Turn the reward off"
                  : "Turn the reward on"
              }
            />
          </div>

          {draft.rewardEnabled && (
            <div className="space-y-4 pt-1">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="mg-threshold"
                    className="block font-body text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2"
                  >
                    Target score
                  </label>
                  <input
                    id="mg-threshold"
                    type="number"
                    min={0}
                    max={ceiling}
                    value={draft.rewardThreshold}
                    onChange={(event) =>
                      update("rewardThreshold", Number(event.target.value) || 0)
                    }
                    className="w-full px-4 py-2.5 rounded-xl admin-input border text-ink dark:text-cream focus:outline-none focus:border-sepia transition-colors text-sm font-mono"
                  />
                  {/* A target above the ceiling is unreachable — worth saying
                      before it silently never fires. */}
                  {draft.rewardThreshold > ceiling && (
                    <p className="font-body text-xs text-vermillion mt-1">
                      Above the best possible score ({formatScore(ceiling)}) —
                      nobody can reach this.
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="mg-reward-text"
                    className="block font-body text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2"
                  >
                    Reward
                  </label>
                  <input
                    id="mg-reward-text"
                    type="text"
                    value={draft.rewardDescription}
                    onChange={(event) =>
                      update("rewardDescription", event.target.value)
                    }
                    maxLength={MAX_REWARD_DESCRIPTION_LENGTH}
                    placeholder="Free portrait"
                    className="w-full px-4 py-2.5 rounded-xl admin-input border text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <p className="font-body text-sm text-ink dark:text-cream">
                  Require an email to claim
                </p>
                <Toggle
                  checked={draft.rewardRequireEmail}
                  onChange={(value) => {
                    update("rewardRequireEmail", value);
                    toggleStaged("Email required to claim", value, { on: "on", off: "off" });
                  }}
                  label={
                    draft.rewardRequireEmail
                      ? "Stop requiring an email"
                      : "Require an email"
                  }
                />
              </div>
            </div>
          )}
        </section>

        {/* ── Stats ── */}
        <section className="pt-2 border-t border-black/10 dark:border-white/10">
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4">
            <Stat label="Rounds started" value={String(game.stats.plays)} />
            <Stat label="Completed" value={String(game.stats.completions)} />
            <Stat label="On the board" value={String(game.stats.entries)} />
            <Stat
              label="Best score"
              value={
                game.stats.bestScore !== null
                  ? formatScore(game.stats.bestScore)
                  : "—"
              }
            />
          </dl>
        </section>
      </div>

      {/* ── Actions ── */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving || !isDirty}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sepia hover:bg-sepia-dark text-white font-jakarta text-sm font-medium transition-all duration-200 shadow-md disabled:opacity-50"
        >
          {saving ? (
            <>
              <span className="w-4 h-4 border border-white/30 border-t-white rounded-full animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Save size={16} />
              Save {game.name}
            </>
          )}
        </button>
        {isDirty && !saving && (
          <button
            type="button"
            onClick={() => setDraft({ ...savedRef.current })}
            className="font-body text-xs text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream transition-colors"
          >
            Discard changes
          </button>
        )}
      </div>

      <UnsavedChangesBar
        dirty={isDirty}
        what={game.name}
        saving={saving}
        onSave={save}
        onReset={() => setDraft({ ...savedRef.current })}
        saveLabel={`Save ${game.name}`}
      />

      {picking && (
        <ArtworkPicker
          artworks={artworks}
          title={
            picking === "primary"
              ? "Choose artwork"
              : "Choose the modified image"
          }
          selectedId={
            picking === "primary" ? draft.artworkId : draft.secondaryArtworkId
          }
          onSelect={(id) => {
            update(
              picking === "primary" ? "artworkId" : "secondaryArtworkId",
              id
            );
            setPicking(null);
          }}
          onClose={() => setPicking(null)}
        />
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-body text-xs tracking-widest uppercase text-ink-400 dark:text-ink-300">
      {children}
    </p>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "shrink-0 p-1.5 rounded-lg transition-colors",
        checked
          ? "bg-sepia/10 text-sepia hover:bg-sepia/20"
          : "bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:bg-black/10 dark:hover:bg-white/10"
      )}
    >
      {checked ? <ToggleRight size={26} /> : <ToggleLeft size={26} />}
    </button>
  );
}

function ArtworkSlot({
  label,
  artwork,
  onPick,
  onClear,
}: {
  label: string;
  artwork: { id: string; title: string; imageUrl: string } | null;
  onPick: () => void;
  onClear: () => void;
}) {
  return (
    <div>
      <p className="font-body text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">
        {label}
      </p>
      {artwork ? (
        <div className="flex items-center gap-3 p-2 rounded-xl border border-black/10 dark:border-white/10">
          <div className="relative w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-black/5 dark:bg-white/5">
            <Image
              src={artwork.imageUrl}
              alt={artwork.title}
              fill
              className="object-cover"
              sizes="56px"
            />
          </div>
          <p className="flex-1 min-w-0 font-jakarta text-sm text-ink dark:text-cream truncate">
            {artwork.title}
          </p>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={onPick}
              className="px-2.5 py-1.5 rounded-lg font-body text-xs text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              Change
            </button>
            <button
              type="button"
              onClick={onClear}
              aria-label={`Remove ${artwork.title}`}
              className="p-1.5 rounded-lg text-ink-400 hover:text-vermillion hover:bg-vermillion/10 transition-colors"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={onPick}
          className="w-full flex items-center justify-center gap-2 py-5 rounded-xl border border-dashed border-black/15 dark:border-white/15 text-ink-400 dark:text-ink-300 hover:border-sepia/50 hover:text-sepia transition-colors font-body text-sm"
        >
          <ImagePlus size={16} />
          Select artwork
        </button>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-body text-[10px] tracking-widest uppercase text-ink-400 dark:text-ink-300">
        {label}
      </dt>
      <dd className="font-mono text-sm text-ink dark:text-cream tabular-nums mt-0.5">
        {value}
      </dd>
    </div>
  );
}
