"use client";

// app/(admin)/admin/press/PressClient.tsx
//
// The press-kit editor: the handful of fields /press needs that the rest of the
// site has no reason to store. Everything else on that page — the bio, the
// members, the photos, the records, the shows — is edited where it already
// lives, and this page says so rather than offering a second place to change it.
//
// One staged form, one Save, writing through the same PUT /api/profile every
// other Profile editor uses.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Info, Loader2, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import toast from "@/lib/toast";
import { cn, getErrorMessage } from "@/lib/utils";
import { FieldLabel, ImageField, TextField } from "@/app/(admin)/admin/site-design/fields";
import {
  MAX_PRESS_BOOKING_NAME,
  MAX_PRESS_PHOTO_CREDIT,
  MAX_PRESS_QUOTE,
  MAX_PRESS_QUOTES,
  MAX_PRESS_QUOTE_SOURCE,
  MAX_PRESS_SHORT_BIO,
  MAX_PRESS_TECH_RIDER,
  type PressQuote,
} from "@/lib/press";

const inputBase =
  "w-full px-4 py-2.5 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors text-sm font-jakarta";

export interface PressFormState {
  pressShortBio: string;
  pressBookingName: string;
  pressBookingEmail: string;
  pressTechRider: string;
  pressStagePlot: string | null;
  pressPhotoCredit: string;
  pressQuotes: PressQuote[];
}

export function PressClient({ initial }: { initial: PressFormState }) {
  const router = useRouter();
  const [form, setForm] = useState<PressFormState>(initial);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof PressFormState>(key: K, value: PressFormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function setQuote(index: number, patch: Partial<PressQuote>) {
    setForm((f) => ({
      ...f,
      pressQuotes: f.pressQuotes.map((q, i) => (i === index ? { ...q, ...patch } : q)),
    }));
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          // Rows with no text or no source are dropped server-side anyway;
          // doing it here too means the form doesn't keep a blank row after a
          // save that silently discarded it.
          pressQuotes: form.pressQuotes.filter((q) => q.quote.trim() && q.source.trim()),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to save");
      toast.success("Press kit saved");
      router.refresh();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to save"));
    } finally {
      setSaving(false);
    }
  }

  const shortBioWords = form.pressShortBio.trim() ? form.pressShortBio.trim().split(/\s+/).length : 0;

  return (
    <div className="space-y-8">
      {/* What this page does and doesn't own */}
      <div className="flex items-start gap-3 rounded-2xl border border-sepia/25 bg-sepia/5 p-4">
        <Info size={16} className="mt-0.5 shrink-0 text-sepia" />
        <div className="min-w-0 font-body text-xs leading-relaxed text-ink-400 dark:text-ink-300">
          Most of the press kit builds itself from what&apos;s already in the admin — the long bio, based-in and
          genres from <Link href="/admin/about" className="underline hover:text-ink dark:hover:text-cream">About</Link>,
          the line-up from{" "}
          <Link href="/admin/band-members" className="underline hover:text-ink dark:hover:text-cream">Band Members</Link>,
          the press photos from About&apos;s profile images, the records from{" "}
          <Link href="/admin/releases" className="underline hover:text-ink dark:hover:text-cream">Releases</Link>, and the
          dates from <Link href="/admin/events" className="underline hover:text-ink dark:hover:text-cream">Shows</Link>.
          What&apos;s below is only the part a press kit needs and the site has nowhere else to put.
          <Link
            href="/press"
            target="_blank"
            className="mt-2 inline-flex items-center gap-1 text-sepia-dark underline dark:text-sepia-light"
          >
            View the page <ExternalLink size={11} />
          </Link>
        </div>
      </div>

      {/* Short bio */}
      <section className="rounded-2xl border border-black/10 bg-black/5 p-5 dark:border-white/10 dark:bg-white/5">
        <FieldLabel hint={`${form.pressShortBio.length}/${MAX_PRESS_SHORT_BIO} · ${shortBioWords} words`}>
          Short bio
        </FieldLabel>
        <textarea
          rows={5}
          maxLength={MAX_PRESS_SHORT_BIO}
          value={form.pressShortBio}
          onChange={(e) => set("pressShortBio", e.target.value)}
          placeholder="Forty or fifty words a listing can print as-is."
          className={cn(inputBase, "resize-none")}
        />
        <p className="mt-1.5 font-body text-xs text-ink-400 dark:text-ink-300">
          Its own paragraph, not the first few lines of the long bio — what a gig listing or a festival programme
          asks for. It&apos;s also the subtitle of the press page and the one journalists copy first. Around 40–60
          words reads best.
        </p>
      </section>

      {/* Booking contact */}
      <section className="rounded-2xl border border-black/10 bg-black/5 p-5 dark:border-white/10 dark:bg-white/5">
        <h2 className="mb-4 font-body text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300">
          Booking contact
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            label="Name"
            value={form.pressBookingName}
            onChange={(v) => set("pressBookingName", v)}
            maxLength={MAX_PRESS_BOOKING_NAME}
            placeholder="e.g. Ryan (band manager)"
          />
          <div>
            <FieldLabel>Email</FieldLabel>
            <input
              type="email"
              value={form.pressBookingEmail}
              onChange={(e) => set("pressBookingEmail", e.target.value)}
              placeholder="booking@…"
              className={inputBase}
            />
            <p className="mt-1 font-body text-xs text-ink-400 dark:text-ink-300">
              Leave blank to use the general address from About.
            </p>
          </div>
        </div>
      </section>

      {/* Photo credit */}
      <section className="rounded-2xl border border-black/10 bg-black/5 p-5 dark:border-white/10 dark:bg-white/5">
        <TextField
          label="Photo credit"
          value={form.pressPhotoCredit}
          onChange={(v) => set("pressPhotoCredit", v)}
          maxLength={MAX_PRESS_PHOTO_CREDIT}
          placeholder="e.g. Photo by Juan Dela Cruz"
          hint="Shown with the press photos. They're there to be downloaded, so the credit has to travel with them."
        />
      </section>

      {/* Quotes */}
      <section className="rounded-2xl border border-black/10 bg-black/5 p-5 dark:border-white/10 dark:bg-white/5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-body text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300">
            Press quotes ({form.pressQuotes.length}/{MAX_PRESS_QUOTES})
          </h2>
          <button
            type="button"
            disabled={form.pressQuotes.length >= MAX_PRESS_QUOTES}
            onClick={() => set("pressQuotes", [...form.pressQuotes, { quote: "", source: "", sourceUrl: null }])}
            className="inline-flex items-center gap-1.5 rounded-xl border border-sepia/40 bg-sepia/10 px-3 py-1.5 font-body text-xs text-ink transition-colors hover:border-sepia disabled:cursor-not-allowed disabled:opacity-50 dark:text-cream"
          >
            <Plus size={13} /> Add quote
          </button>
        </div>
        {form.pressQuotes.length === 0 ? (
          <p className="font-body text-xs text-ink-400 dark:text-ink-300">
            Nothing yet — the section is hidden on the page until there is. A line from a review, a blog or a
            zine, with who said it.
          </p>
        ) : (
          <ul className="space-y-4">
            {form.pressQuotes.map((q, i) => (
              <li key={i} className="rounded-xl border border-black/10 p-4 dark:border-white/10">
                <div className="mb-3 flex items-start gap-3">
                  <textarea
                    rows={2}
                    maxLength={MAX_PRESS_QUOTE}
                    value={q.quote}
                    onChange={(e) => setQuote(i, { quote: e.target.value })}
                    placeholder="“…”"
                    className={cn(inputBase, "resize-none")}
                  />
                  <button
                    type="button"
                    onClick={() => set("pressQuotes", form.pressQuotes.filter((_, j) => j !== i))}
                    aria-label="Remove quote"
                    className="shrink-0 rounded-lg p-2 text-ink-400 transition-colors hover:bg-red-500/10 hover:text-red-500"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <input
                    type="text"
                    maxLength={MAX_PRESS_QUOTE_SOURCE}
                    value={q.source}
                    onChange={(e) => setQuote(i, { source: e.target.value })}
                    placeholder="Who said it — e.g. Bandwagon Asia"
                    className={inputBase}
                  />
                  <input
                    type="url"
                    value={q.sourceUrl ?? ""}
                    onChange={(e) => setQuote(i, { sourceUrl: e.target.value || null })}
                    placeholder="https://… (optional)"
                    className={inputBase}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Tech rider + stage plot */}
      <section className="rounded-2xl border border-black/10 bg-black/5 p-5 dark:border-white/10 dark:bg-white/5">
        <FieldLabel hint={`${form.pressTechRider.length}/${MAX_PRESS_TECH_RIDER}`}>Tech rider</FieldLabel>
        <textarea
          rows={10}
          maxLength={MAX_PRESS_TECH_RIDER}
          value={form.pressTechRider}
          onChange={(e) => set("pressTechRider", e.target.value)}
          placeholder={"What you need on stage, in your own words. e.g.\n\n3 vocal mics\n2 guitar amps (or DI)\nBass amp\nFull drum kit — we bring cymbals and snare\n4 monitor sends"}
          className={cn(inputBase, "font-mono text-xs")}
        />
        <p className="mt-1.5 font-body text-xs text-ink-400 dark:text-ink-300">
          Plain text, line by line — it prints as-is and there&apos;s a Copy button on the page. Hidden when empty.
        </p>
        <div className="mt-5">
          <ImageField
            label="Stage plot"
            value={form.pressStagePlot}
            onChange={(url) => set("pressStagePlot", url)}
            aspect="aspect-[4/3]"
            hint="A picture of the plot — a photo of a drawing is fine. Offered as a download on the page."
          />
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-sepia px-6 py-2.5 font-body text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? (
            <>
              <Loader2 size={14} className="animate-spin" /> Saving
            </>
          ) : (
            "Save press kit"
          )}
        </button>
        <Link
          href="/press"
          target="_blank"
          className="inline-flex items-center gap-1.5 font-body text-sm text-ink-400 transition-colors hover:text-ink dark:text-ink-300 dark:hover:text-cream"
        >
          Preview <ExternalLink size={13} />
        </Link>
      </div>
    </div>
  );
}
