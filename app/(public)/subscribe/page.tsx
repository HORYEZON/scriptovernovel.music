// app/(public)/subscribe/page.tsx
//
// The mailing list's own page: the signup form, and the place the confirm link
// lands. `?state=` is set by the redirect out of
// /api/subscribers/confirm — the write happens there, so this page is safe to
// reload, bookmark or share without re-spending a token.
//
// States: `confirmed` (the link worked), `invalid` (it didn't match — which is
// also what an already-spent link looks like, since the token is cleared on
// use, so the wording has to read right either way), `unsubscribed`, `error`.
import type { Metadata } from "next";
import { Check, Info } from "lucide-react";
import { PageHero } from "@/components/public/system/PageHero";
import { GlassPanel } from "@/components/public/system/GlassPanel";
import { CtaButton } from "@/components/public/system/CtaButton";
import { SubscribeForm } from "@/components/public/SubscribeForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mailing list",
  description: "Hear from ScriptOverNovel when there's a new release or a new show.",
};

const NOTICES: Record<string, { tone: "good" | "info"; title: string; body: string }> = {
  confirmed: {
    tone: "good",
    title: "You're on the list",
    body: "That's it — we'll write when there's a new release or a new show, and there's an unsubscribe link in every email.",
  },
  invalid: {
    tone: "info",
    title: "That link has already been used",
    body: "Confirmation links work once. If you've confirmed before, you're on the list and there's nothing left to do. If you're not sure, sign up again below — it won't create a second entry.",
  },
  unsubscribed: {
    tone: "info",
    title: "You're off the list",
    body: "We won't write again. If it was a mistake, you can sign up below.",
  },
  error: {
    tone: "info",
    title: "Something went wrong",
    body: "We couldn't finish that just now. Try the link again, or sign up below.",
  },
};

export default async function SubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const { state } = await searchParams;
  const notice = state ? NOTICES[state] : undefined;

  return (
    <div className="pb-24">
      <PageHero
        eyebrow="Mailing list"
        title="Hear it first"
        subtitle="New releases and new shows, straight to you — not through anyone's algorithm."
      />

      <section className="section-padding mt-12 md:mt-16">
        <GlassPanel padding="page" className="mx-auto max-w-2xl">
          {notice && (
            <div className="mb-8 flex items-start gap-3 rounded-xl border border-sepia/25 bg-sepia/5 p-4">
              {notice.tone === "good" ? (
                <Check size={16} className="mt-0.5 shrink-0 text-sepia-light" />
              ) : (
                <Info size={16} className="mt-0.5 shrink-0 text-cream/50" />
              )}
              <div className="min-w-0">
                <p className="font-fraunces text-xl font-light text-cream">{notice.title}</p>
                <p className="mt-1.5 font-body text-sm leading-relaxed text-cream/70">{notice.body}</p>
              </div>
            </div>
          )}

          <p className="font-body text-sm leading-relaxed text-cream/70">
            Put your address in and we&apos;ll send one email to confirm it&apos;s you. After that you&apos;ll
            hear from us when a record comes out or a date goes up — nothing else.
          </p>

          <div className="mt-6">
            <SubscribeForm source="subscribe" />
          </div>

          <div className="mt-10 border-t border-white/10 pt-6">
            <p className="font-body text-xs leading-relaxed text-cream/50">
              We keep your address to send you those emails and nothing else — we don&apos;t sell it, and
              we don&apos;t pass it on. Every email has an unsubscribe link, and it keeps working.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <CtaButton href="/music" variant="ghost">
                Listen first
              </CtaButton>
              <CtaButton href="/shows" variant="ghost">
                See the shows
              </CtaButton>
            </div>
          </div>
        </GlassPanel>
      </section>
    </div>
  );
}
