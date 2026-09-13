// app/(public)/gallery/museum/loading.tsx
//
// The museum's route-level Suspense boundary, and the reason tapping "Go To
// Museum" feels instant rather than broken.
//
// page.tsx is `force-dynamic` and does a lot before it can return anything —
// one wide Prisma read plus the ensure*/sync* provisioning for the About,
// Freedom Wall, Stairs, Services, Stories, Arcade and Cosplay rooms. On a
// phone that is seconds of server time, and without a loading boundary Next
// has nothing it can show for them: a <Link> click to a dynamic route holds
// the *previous* page on screen until the server responds, with no spinner and
// no navigation. The tap looks ignored, so visitors tap again or long-press to
// open in a new tab — which is what they were doing.
//
// A loading.tsx changes what <Link> can prefetch. For a dynamic route Next
// prefetches exactly up to the first loading boundary, so this file is already
// in the browser when the tap lands: navigation commits immediately, this
// renders, and the server work streams in behind it.
//
// Deliberately the same LoadingScreen that MuseumClient.tsx hands to
// next/dynamic while three.js downloads. The two waits are back to back —
// server render, then the 3D bundle — and showing one continuous screen across
// both reads as a single load instead of two flashes with a gap between them.
import { LoadingScreen } from "./components/LoadingScreen";

export default function Loading() {
  // LoadingScreen positions itself `absolute inset-0`, which needs a
  // positioned box to fill. Fixed rather than relative so it covers the
  // (public) layout's navbar and footer too — the museum is a full-bleed
  // experience, and framing its loading state in site chrome it is about to
  // replace just makes the swap more jarring.
  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* `slowNotice`: a server render that *errors* reaches app/error.tsx, so
          that case already shows something. This covers the other one — a
          navigation that is simply slow, where nothing rejects and this state
          just holds. After 12s it says so, and asks the visitor not to reload,
          which is the advice that actually shortens the wait. */}
      <LoadingScreen slowNotice />
    </div>
  );
}
