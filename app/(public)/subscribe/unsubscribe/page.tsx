// app/(public)/subscribe/unsubscribe/page.tsx
//
// Where the unsubscribe link in an email lands: the address it will remove, and
// a button.
//
// The button exists rather than the link unsubscribing on arrival because mail
// scanners, link checkers and corporate security proxies follow every URL in an
// email — an unsubscribe that happened on GET would quietly remove people who
// never clicked anything. So the write is a POST from the button (see
// /api/subscribers/unsubscribe).
import type { Metadata } from "next";
import { PageHero } from "@/components/public/system/PageHero";
import { GlassPanel } from "@/components/public/system/GlassPanel";
import { CtaButton } from "@/components/public/system/CtaButton";
import { subscriberByUnsubscribeToken } from "@/lib/subscribers-server";
import { UnsubscribeClient } from "./UnsubscribeClient";

export const dynamic = "force-dynamic";

// Never indexed — it exists only as the target of a link in someone's inbox.
// robots.ts disallows the path as well; this covers a crawler that reached the
// page some other way.
export const metadata: Metadata = {
  title: "Unsubscribe",
  robots: { index: false, follow: false },
};

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const row = token ? await subscriberByUnsubscribeToken(token).catch(() => null) : null;

  return (
    <div className="pb-24">
      <PageHero eyebrow="Mailing list" title="Unsubscribe" />
      <section className="section-padding mt-12 md:mt-16">
        <GlassPanel padding="page" className="mx-auto max-w-xl">
          {!row ? (
            <>
              <p className="font-fraunces text-xl font-light text-cream">That link isn&apos;t valid</p>
              <p className="mt-2 font-body text-sm leading-relaxed text-cream/70">
                It may have been cut short by your email client — try copying the whole address from the
                email. If you can&apos;t get it to work, send us a note and we&apos;ll take care of it.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <CtaButton href="/contact" variant="ghost">
                  Contact us
                </CtaButton>
              </div>
            </>
          ) : row.unsubscribedAt ? (
            <>
              <p className="font-fraunces text-xl font-light text-cream">You&apos;re already off the list</p>
              <p className="mt-2 font-body text-sm leading-relaxed text-cream/70">
                <span className="text-cream">{row.email}</span> isn&apos;t subscribed — we won&apos;t write
                again.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <CtaButton href="/music" variant="ghost">
                  Back to the music
                </CtaButton>
              </div>
            </>
          ) : (
            <UnsubscribeClient token={token!} email={row.email} />
          )}
        </GlassPanel>
      </section>
    </div>
  );
}
