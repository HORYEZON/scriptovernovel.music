// app/(public)/press/page.tsx
//
// The press kit / EPK: everything a booker, a blog or a festival asks for, on
// one page they can read, copy from, download from and print.
//
// It exists because those three all ask for the same things and none of them
// are on a band site by default: a short bio *written as a short bio*, photos
// at full size with a credit attached, who to email about a show, and what the
// band needs on stage. Everything else here is a second view of data the site
// already holds, gathered by lib/press-server.ts.
//
// The "one-sheet" is this page printed: the @media print block in globals.css
// turns it into ink-on-paper and the browser's own dialog saves it as a PDF —
// the same route the order receipt takes rather than generating a PDF
// server-side.
import type { Metadata } from "next";
import Link from "next/link";
import { Download, ExternalLink, FileText, Mail, Quote } from "lucide-react";
import { getPressKit } from "@/lib/press-server";
import { RELEASE_TYPE_LABELS, formatReleaseDate, releaseEmbeds, releaseHref } from "@/lib/releases";
import { EMBED_PROVIDER_LABELS } from "@/lib/embeds";
import { VIDEO_KIND_LABELS, youtubeThumbnail } from "@/lib/videos";
import { showVenueLine } from "@/lib/shows";
import { imageVariantUrl } from "@/lib/images/variants";
import { SITE_URL } from "@/lib/site-url";
import { JsonLd } from "@/components/public/JsonLd";
import { PageHero } from "@/components/public/system/PageHero";
import { GlassPanel } from "@/components/public/system/GlassPanel";
import { SectionHeading } from "@/components/public/system/SectionHeading";
import { CtaButton } from "@/components/public/system/CtaButton";
import { CopyButton, PrintButton } from "./PressActions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Press kit",
  description: "ScriptOverNovel press kit — bio, photos, music, shows and booking contact.",
};

export default async function PressPage() {
  const kit = await getPressKit();
  const {
    profile,
    bandName,
    members,
    genres,
    socialLinks,
    releases,
    videos,
    selectedShows,
    playedCount,
    upcomingCount,
    awards,
    photos,
    quotes,
    logoUrl,
  } = kit;

  const shortBio = profile?.pressShortBio?.trim() || null;
  const longBio = profile?.bio?.trim() || null;
  const bookingEmail = profile?.pressBookingEmail?.trim() || profile?.email?.trim() || null;
  const bookingName = profile?.pressBookingName?.trim() || null;
  const rider = profile?.pressTechRider?.trim() || null;
  const stagePlot = profile?.pressStagePlot?.trim() || null;
  const photoCredit = profile?.pressPhotoCredit?.trim() || null;

  // What the "copy everything" button hands over: the facts a listing needs, in
  // the order they're usually asked for, as plain text.
  const factSheet = [
    bandName,
    profile?.basedIn ? `Based in: ${profile.basedIn}` : null,
    genres.length > 0 ? `Genres: ${genres.join(", ")}` : null,
    members.length > 0 ? `Members: ${members.map((m) => `${m.name} (${m.role})`).join(", ")}` : null,
    releases[0] ? `Latest release: ${releases[0].title} (${RELEASE_TYPE_LABELS[releases[0].type]}${releases[0].releaseDate ? `, ${formatReleaseDate(releases[0].releaseDate)}` : ""})` : null,
    bookingEmail ? `Booking: ${bookingEmail}` : null,
    `Site: ${SITE_URL}`,
    "",
    shortBio ?? longBio ?? "",
  ]
    .filter((line) => line !== null)
    .join("\n");

  return (
    <div className="press-kit pb-24">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "MusicGroup",
          name: bandName,
          url: `${SITE_URL}/press`,
          ...(genres.length > 0 && { genre: genres }),
          // The short bio when there is one, else the long one — a band with a
          // bio shouldn't be described as nothing just because the press field
          // is still empty.
          ...((shortBio ?? longBio) && { description: shortBio ?? longBio }),
          ...(photos[0] && { image: photos }),
          ...(logoUrl && { logo: logoUrl }),
          ...(profile?.basedIn && { foundingLocation: { "@type": "Place", name: profile.basedIn } }),
          ...(members.length > 0 && {
            member: members.map((m) => ({ "@type": "Person", name: m.name, roleName: m.role })),
          }),
          ...(socialLinks.length > 0 && { sameAs: socialLinks.map((l) => l.url) }),
          ...(bookingEmail && {
            contactPoint: { "@type": "ContactPoint", contactType: "booking", email: bookingEmail },
          }),
        }}
      />

      <PageHero
        image={photos[0] ?? null}
        blur="lg"
        eyebrow="Press kit"
        title={bandName}
        subtitle={shortBio ?? profile?.headline ?? undefined}
      >
        <PrintButton />
        {bookingEmail && (
          <CtaButton href={`mailto:${bookingEmail}`} variant="ghost" external>
            Email for booking
          </CtaButton>
        )}
      </PageHero>

      <div className="mt-12 space-y-16 md:mt-16 md:space-y-20">
        {/* At a glance — the facts, in the order a listing asks for them */}
        <section className="section-padding">
          <GlassPanel padding="page">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <SectionHeading eyebrow="At a glance" title="The facts" className="mb-0" />
              <CopyButton text={factSheet} label="Copy all" />
            </div>
            <dl className="mt-8 grid grid-cols-1 gap-x-10 gap-y-5 sm:grid-cols-2">
              {[
                ["Name", bandName],
                ["Based in", profile?.basedIn ?? null],
                ["Genres", genres.length > 0 ? genres.join(" · ") : null],
                ["Members", members.length > 0 ? String(members.length) : null],
                ["Releases", releases.length > 0 ? String(releases.length) : null],
                ["Shows played", playedCount > 0 ? String(playedCount) : null],
                ["Dates coming up", upcomingCount > 0 ? String(upcomingCount) : null],
              ]
                .filter(([, value]) => Boolean(value))
                .map(([label, value]) => (
                  <div key={label as string}>
                    <dt className="font-body text-[10px] uppercase tracking-[0.3em] text-sepia-light">{label}</dt>
                    <dd className="mt-1.5 font-body text-sm leading-relaxed text-cream/80">{value}</dd>
                  </div>
                ))}
            </dl>
          </GlassPanel>
        </section>

        {/* Bios — both lengths, each copyable */}
        {(shortBio || longBio) && (
          <section className="section-padding">
            <GlassPanel padding="page">
              <SectionHeading eyebrow="Bio" title="Who we are" />
              {shortBio && (
                <div className="mb-10">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-body text-[10px] uppercase tracking-[0.3em] text-sepia-light">
                      Short — {shortBio.split(/\s+/).length} words
                    </p>
                    <CopyButton text={shortBio} label="Copy short bio" />
                  </div>
                  <p className="mt-3 max-w-3xl whitespace-pre-line font-body text-base leading-relaxed text-cream/80">
                    {shortBio}
                  </p>
                </div>
              )}
              {longBio && (
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-body text-[10px] uppercase tracking-[0.3em] text-cream/50">
                      Long — {longBio.split(/\s+/).length} words
                    </p>
                    <CopyButton text={longBio} label="Copy long bio" />
                  </div>
                  <p className="mt-3 max-w-3xl whitespace-pre-line font-body text-sm leading-relaxed text-cream/70">
                    {longBio}
                  </p>
                </div>
              )}
            </GlassPanel>
          </section>
        )}

        {/* Quotes */}
        {quotes.length > 0 && (
          <section className="section-padding">
            <GlassPanel padding="page">
              <SectionHeading eyebrow="Press" title="What's been said" />
              <ul className="grid grid-cols-1 gap-8 md:grid-cols-2">
                {quotes.map((q, i) => (
                  <li key={i}>
                    <Quote size={16} className="text-sepia-light" aria-hidden="true" />
                    <blockquote className="mt-2 font-fraunces text-xl font-light leading-snug text-cream">
                      {q.quote}
                    </blockquote>
                    <p className="mt-3 font-body text-xs uppercase tracking-[0.2em] text-cream/50">
                      {q.sourceUrl ? (
                        <a
                          href={q.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="transition-colors hover:text-cream"
                        >
                          {q.source} <ExternalLink size={10} className="inline" />
                        </a>
                      ) : (
                        q.source
                      )}
                    </p>
                  </li>
                ))}
              </ul>
            </GlassPanel>
          </section>
        )}

        {/* Members */}
        {members.length > 0 && (
          <section className="section-padding">
            <GlassPanel padding="page">
              <SectionHeading eyebrow="Line-up" title="Who plays what" />
              <ul className="grid grid-cols-1 gap-x-10 gap-y-4 sm:grid-cols-2">
                {members.map((m) => (
                  <li key={m.id} className="flex items-baseline justify-between gap-4 border-b border-white/10 pb-3">
                    <span className="font-body text-sm text-cream">{m.name}</span>
                    <span className="shrink-0 font-body text-xs text-cream/50">{m.role}</span>
                  </li>
                ))}
              </ul>
            </GlassPanel>
          </section>
        )}

        {/* Photos — the point of the page for most visitors: full size, with
            the credit attached. `download` on the anchor so a click saves the
            file rather than opening it in a tab. */}
        {photos.length > 0 && (
          <section className="section-padding">
            <GlassPanel padding="page">
              <SectionHeading
                eyebrow="Photos"
                title="Press photos"
                description={
                  photoCredit
                    ? `Free to use in coverage of the band. Please credit: ${photoCredit}.`
                    : "Free to use in coverage of the band."
                }
              />
              <ul className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
                {photos.map((photo, i) => (
                  <li key={photo}>
                    <a
                      href={imageVariantUrl(photo, "full")}
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group block"
                    >
                      <div className="aspect-[4/5] overflow-hidden rounded-xl border border-white/10">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={imageVariantUrl(photo, "medium")}
                          alt={`${bandName} press photo ${i + 1}`}
                          draggable={false}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      </div>
                      <span className="mt-2 inline-flex items-center gap-1.5 font-body text-[10px] uppercase tracking-[0.2em] text-cream/50 transition-colors group-hover:text-cream">
                        <Download size={10} /> Full size
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
              {logoUrl && (
                <div className="mt-10 border-t border-white/10 pt-6">
                  <p className="font-body text-[10px] uppercase tracking-[0.3em] text-sepia-light">Logo</p>
                  <a
                    href={logoUrl}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 transition-colors hover:border-cream/40"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logoUrl} alt={`${bandName} logo`} className="h-10 w-auto" />
                    <span className="inline-flex items-center gap-1.5 font-body text-[10px] uppercase tracking-[0.2em] text-cream/60">
                      <Download size={10} /> Download
                    </span>
                  </a>
                </div>
              )}
            </GlassPanel>
          </section>
        )}

        {/* Music */}
        {releases.length > 0 && (
          <section className="section-padding">
            <GlassPanel padding="page">
              <SectionHeading eyebrow="Music" title="Discography" action={{ label: "All releases", href: "/music" }} />
              <ul className="space-y-5">
                {releases.map((r) => {
                  const links = releaseEmbeds(r);
                  return (
                    <li key={r.id} className="flex flex-wrap items-start gap-4 border-b border-white/10 pb-5 last:border-0">
                      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-white/10">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={imageVariantUrl(r.coverImageUrl, "thumb")}
                          alt={`${r.title} cover`}
                          draggable={false}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <Link href={releaseHref(r)} className="font-fraunces text-lg font-light text-cream hover:text-sepia-light">
                          {r.title}
                        </Link>
                        <p className="mt-0.5 font-body text-[11px] uppercase tracking-[0.2em] text-cream/45">
                          {RELEASE_TYPE_LABELS[r.type]}
                          {r.releaseDate && <> · {formatReleaseDate(r.releaseDate, "year")}</>}
                          {r._count.tracks > 0 && <> · {r._count.tracks} tracks</>}
                        </p>
                        {links.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {links.map((e) => (
                              <a
                                key={e.provider}
                                href={e.canonicalUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-body text-[10px] uppercase tracking-[0.18em] text-cream/55 underline decoration-cream/20 transition-colors hover:text-cream"
                              >
                                {EMBED_PROVIDER_LABELS[e.provider]}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </GlassPanel>
          </section>
        )}

        {/* Videos — thumbnail + link rather than an embed: an embed on a press
            page is a YouTube script running on a document someone is trying to
            print. */}
        {videos.length > 0 && (
          <section className="section-padding">
            <GlassPanel padding="page">
              <SectionHeading eyebrow="Watch" title="Video" action={{ label: "All videos", href: "/videos" }} />
              <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                {videos.map((v) => (
                  <li key={v.id}>
                    <a href={v.youtubeUrl} target="_blank" rel="noopener noreferrer" className="group block">
                      <div className="aspect-video overflow-hidden rounded-xl border border-white/10">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={youtubeThumbnail(v.youtubeId)}
                          alt=""
                          draggable={false}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      </div>
                      <p className="mt-2.5 font-body text-sm text-cream transition-colors group-hover:text-sepia-light">
                        {v.title}
                      </p>
                      <p className="font-body text-[10px] uppercase tracking-[0.2em] text-cream/45">
                        {VIDEO_KIND_LABELS[v.kind]}
                      </p>
                    </a>
                  </li>
                ))}
              </ul>
            </GlassPanel>
          </section>
        )}

        {/* Selected shows */}
        {selectedShows.length > 0 && (
          <section className="section-padding">
            <GlassPanel padding="page">
              <SectionHeading eyebrow="Live" title="Selected shows" action={{ label: "All shows", href: "/shows" }} />
              <ul className="space-y-3">
                {selectedShows.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-baseline justify-between gap-3 border-b border-white/10 pb-3">
                    <span className="font-body text-sm text-cream">{s.title}</span>
                    <span className="font-body text-xs text-cream/50">
                      {showVenueLine(s.venueName, s.city)}
                      {s.eventDate && (
                        <>
                          {showVenueLine(s.venueName, s.city) && " · "}
                          {new Date(s.eventDate).toLocaleDateString("en-PH", {
                            month: "short",
                            year: "numeric",
                            timeZone: "Asia/Manila",
                          })}
                        </>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </GlassPanel>
          </section>
        )}

        {/* Awards */}
        {awards.length > 0 && (
          <section className="section-padding">
            <GlassPanel padding="page">
              <SectionHeading eyebrow="Recognition" title="Awards" />
              <ul className="space-y-3">
                {awards.map((a) => (
                  <li key={a.id} className="border-b border-white/10 pb-3 font-body text-sm text-cream/80">
                    {a.title}
                  </li>
                ))}
              </ul>
            </GlassPanel>
          </section>
        )}

        {/* Tech rider + stage plot */}
        {(rider || stagePlot) && (
          <section className="section-padding">
            <GlassPanel padding="page">
              <SectionHeading
                eyebrow="Stage"
                title="Tech rider"
                description="What we need to play. Ask us if something here is a problem — most of it is negotiable."
              />
              {rider && (
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <pre className="min-w-0 flex-1 whitespace-pre-wrap font-body text-sm leading-relaxed text-cream/75">
                    {rider}
                  </pre>
                  <CopyButton text={rider} label="Copy rider" />
                </div>
              )}
              {stagePlot && (
                <div className="mt-8">
                  <p className="font-body text-[10px] uppercase tracking-[0.3em] text-sepia-light">Stage plot</p>
                  <a
                    href={imageVariantUrl(stagePlot, "full")}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group mt-3 block max-w-lg"
                  >
                    <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imageVariantUrl(stagePlot, "medium")}
                        alt={`${bandName} stage plot`}
                        draggable={false}
                        loading="lazy"
                        className="h-auto w-full"
                      />
                    </div>
                    <span className="mt-2 inline-flex items-center gap-1.5 font-body text-[10px] uppercase tracking-[0.2em] text-cream/50 transition-colors group-hover:text-cream">
                      <FileText size={11} /> Download full size
                    </span>
                  </a>
                </div>
              )}
            </GlassPanel>
          </section>
        )}

        {/* Contact */}
        <section className="section-padding">
          <GlassPanel padding="page">
            <SectionHeading eyebrow="Contact" title="Get in touch" />
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
              <div>
                <p className="font-body text-[10px] uppercase tracking-[0.3em] text-sepia-light">Booking &amp; press</p>
                {bookingName && <p className="mt-2 font-body text-sm text-cream">{bookingName}</p>}
                {bookingEmail ? (
                  <a
                    href={`mailto:${bookingEmail}`}
                    className="mt-1 inline-flex items-center gap-1.5 font-body text-sm text-sepia-light underline decoration-sepia/40 hover:text-cream"
                  >
                    <Mail size={13} /> {bookingEmail}
                  </a>
                ) : (
                  <Link href="/contact" className="mt-2 inline-block font-body text-sm text-sepia-light underline hover:text-cream">
                    Use the contact form
                  </Link>
                )}
                {profile?.phone && <p className="mt-1 font-body text-sm text-cream/60">{profile.phone}</p>}
                {profile?.basedIn && <p className="mt-1 font-body text-sm text-cream/60">{profile.basedIn}</p>}
              </div>
              {socialLinks.length > 0 && (
                <div>
                  <p className="font-body text-[10px] uppercase tracking-[0.3em] text-sepia-light">Online</p>
                  <ul className="mt-2 space-y-1.5">
                    {socialLinks.map((l) => (
                      <li key={l.url}>
                        <a
                          href={l.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-body text-sm text-cream/70 underline decoration-cream/20 transition-colors hover:text-cream"
                        >
                          {l.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="mt-8 flex flex-wrap gap-3" data-print="hide">
              <PrintButton />
              <CtaButton href="/contact" variant="ghost">
                Contact form
              </CtaButton>
            </div>
          </GlassPanel>
        </section>
      </div>
    </div>
  );
}
