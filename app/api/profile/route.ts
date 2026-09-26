// app/api/profile/route.ts
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { sanitizeCarouselMode, clampCarouselSpeed } from "@/lib/gallery-carousel";
import { sanitizeHoverShimmer } from "@/lib/hover-shimmer";
import { sanitizeMaintenanceMessage } from "@/lib/maintenance";
import { clampMusicVolume } from "@/lib/background-music";
import { clampReleaseNoteLimit } from "@/lib/release-notes";
import {
  MAX_PRESS_BOOKING_NAME,
  MAX_PRESS_PHOTO_CREDIT,
  MAX_PRESS_SHORT_BIO,
  MAX_PRESS_TECH_RIDER,
  pressText,
  sanitizePressQuotes,
} from "@/lib/press";
import { isValidSubscriberEmail, normalizeEmail } from "@/lib/subscribers";
import {
  sanitizeIntroEffect,
  clampIntroSpeed,
  sanitizeIntroText,
  sanitizeIntroBgColor,
  sanitizeIntroTaglineFontSize,
  sanitizeIntroTaglineFontFamily,
  sanitizeIntroTextAbove,
  sanitizeIntroTaglineColor,
  sanitizeIntroTaglineAboveFontSize,
  sanitizeIntroTaglineFontSizeMobile,
  sanitizeIntroTaglineAboveFontFamily,
  sanitizeIntroTaglineAboveColor,
  clampIntroGlowIntensity,
  clampIntroGlowOffset,
  sanitizeIntroLetterColors,
  sanitizeIntroGlowColor,
  sanitizeIntroSquidColor,
} from "@/lib/intro-splash";

export async function GET() {
  try {
    const profile = await prisma.profile.findFirst();
    return NextResponse.json(profile);
  } catch {
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = await request.json();
    const { bio, profileImage, profileImages, backgroundImage, logoImage, sidebarIcon, chatIcon, sidebarIconColors, maintenanceIcon, errorIcon, footerIcon, sidebarMobileIcon, splashIcon, faviconIcon, maintenanceIconColors, footerIconColors, sidebarMobileIconColors, splashIconColors, faviconIconColors, headline, displayName, basedIn, experience, languages, instagram, facebook, twitter, email, phone, address, contactHeading, contactIntro, commissionHeading, commissionIntro, carouselMode, carouselSpeed, storiesCarouselMode, storiesCarouselSpeed, hoverShimmer, maintenanceMode, maintenanceMessage, musicUrl, musicEnabled, musicVolume, introEnabled, introEffect, introSpeedMs, introText, introTextAbove, introBgColor, introTaglineFontSize, introTaglineFontFamily, introTaglineColor, introTaglineAboveFontSize, introTaglineAboveFontFamily, introTaglineAboveColor, introTaglineFontSizeMobile, introTaglineAboveFontSizeMobile, introGlowIntensity, introGlowColor, introGlowShimmer, introGlowOffsetX, introGlowOffsetY, introLetterColors, introSquidColor, callingCardFront, callingCardBack, releaseNotesEnabled, releaseNotesLimit, pressShortBio, pressBookingName, pressBookingEmail, pressTechRider, pressStagePlot, pressPhotoCredit, pressQuotes } = body;

    // Validated (not just passed through) since these drive an animation
    // duration/mode branch client-side — a garbage value there breaks the
    // carousel rather than just displaying oddly, unlike the free-text
    // fields above.
    const safeCarouselMode =
      carouselMode !== undefined ? sanitizeCarouselMode(carouselMode) : undefined;
    const safeCarouselSpeed =
      carouselSpeed !== undefined ? clampCarouselSpeed(carouselSpeed) : undefined;
    // Same two settings for the Stories shelf, through the same sanitizers.
    const safeStoriesCarouselMode =
      storiesCarouselMode !== undefined ? sanitizeCarouselMode(storiesCarouselMode) : undefined;
    const safeStoriesCarouselSpeed =
      storiesCarouselSpeed !== undefined ? clampCarouselSpeed(storiesCarouselSpeed) : undefined;
    // Whole-object sanitize: the Json column is written as one value, so a
    // bad surface inside it falls back to that surface's defaults rather
    // than rejecting the save. Cast for the same reason minigames/config
    // does: Prisma types a Json column as InputJsonValue, which an interface
    // doesn't structurally satisfy — the value has just been sanitized, so
    // it is plain JSON.
    const safeHoverShimmer =
      hoverShimmer !== undefined
        ? (sanitizeHoverShimmer(hoverShimmer) as unknown as Prisma.InputJsonValue)
        : undefined;
    const safeMaintenanceMode =
      maintenanceMode !== undefined ? Boolean(maintenanceMode) : undefined;
    const safeMaintenanceMessage =
      maintenanceMessage !== undefined ? sanitizeMaintenanceMessage(maintenanceMessage) : undefined;
    const safeMusicEnabled =
      musicEnabled !== undefined ? Boolean(musicEnabled) : undefined;
    const safeReleaseNotesEnabled =
      releaseNotesEnabled !== undefined ? Boolean(releaseNotesEnabled) : undefined;
    const safeReleaseNotesLimit =
      releaseNotesLimit !== undefined ? clampReleaseNoteLimit(releaseNotesLimit) : undefined;
    const safeMusicVolume =
      musicVolume !== undefined ? clampMusicVolume(musicVolume) : undefined;
    const safeIntroEnabled =
      introEnabled !== undefined ? Boolean(introEnabled) : undefined;
    const safeIntroEffect =
      introEffect !== undefined ? sanitizeIntroEffect(introEffect) : undefined;
    const safeIntroSpeedMs =
      introSpeedMs !== undefined ? clampIntroSpeed(introSpeedMs) : undefined;
    const safeIntroText =
      introText !== undefined ? sanitizeIntroText(introText) : undefined;
    const safeIntroBgColor =
      introBgColor !== undefined ? sanitizeIntroBgColor(introBgColor) : undefined;
    const safeIntroTaglineFontSize =
      introTaglineFontSize !== undefined
        ? sanitizeIntroTaglineFontSize(introTaglineFontSize)
        : undefined;
    const safeIntroTaglineFontFamily =
      introTaglineFontFamily !== undefined
        ? sanitizeIntroTaglineFontFamily(introTaglineFontFamily)
        : undefined;
    // Phone-only size overrides. Null is a real, storable value here — it is
    // how the override is switched back off — so `undefined` (field absent
    // from the PATCH) is the only thing that means "leave it alone".
    const safeIntroTaglineFontSizeMobile =
      introTaglineFontSizeMobile !== undefined
        ? sanitizeIntroTaglineFontSizeMobile(introTaglineFontSizeMobile)
        : undefined;
    const safeIntroTaglineAboveFontSizeMobile =
      introTaglineAboveFontSizeMobile !== undefined
        ? sanitizeIntroTaglineFontSizeMobile(introTaglineAboveFontSizeMobile)
        : undefined;
    // The second tagline (above the logo) and the per-line color/size knobs —
    // see lib/intro-splash.ts. introTextAbove is the one text field here whose
    // sanitizer keeps an empty string, since blank is how it's switched off.
    const safeIntroTextAbove =
      introTextAbove !== undefined ? sanitizeIntroTextAbove(introTextAbove) : undefined;
    const safeIntroTaglineColor =
      introTaglineColor !== undefined ? sanitizeIntroTaglineColor(introTaglineColor) : undefined;
    const safeIntroTaglineAboveFontSize =
      introTaglineAboveFontSize !== undefined
        ? sanitizeIntroTaglineAboveFontSize(introTaglineAboveFontSize)
        : undefined;
    const safeIntroTaglineAboveFontFamily =
      introTaglineAboveFontFamily !== undefined
        ? sanitizeIntroTaglineAboveFontFamily(introTaglineAboveFontFamily)
        : undefined;
    const safeIntroTaglineAboveColor =
      introTaglineAboveColor !== undefined
        ? sanitizeIntroTaglineAboveColor(introTaglineAboveColor)
        : undefined;
    const safeIntroGlowIntensity =
      introGlowIntensity !== undefined ? clampIntroGlowIntensity(introGlowIntensity) : undefined;
    const safeIntroGlowColor =
      introGlowColor !== undefined ? sanitizeIntroGlowColor(introGlowColor) : undefined;
    const safeIntroSquidColor =
      introSquidColor !== undefined ? sanitizeIntroSquidColor(introSquidColor) : undefined;
    const safeIntroGlowShimmer =
      introGlowShimmer !== undefined ? Boolean(introGlowShimmer) : undefined;
    const safeIntroGlowOffsetX =
      introGlowOffsetX !== undefined ? clampIntroGlowOffset(introGlowOffsetX) : undefined;
    const safeIntroGlowOffsetY =
      introGlowOffsetY !== undefined ? clampIntroGlowOffset(introGlowOffsetY) : undefined;
    // "hover" | "always" — anything else falls back to "hover", the wordmark's
    // original behaviour, rather than being rejected: this is a presentation
    // choice, and a bad value should leave the splash as it was.
    const safeIntroLetterColors =
      introLetterColors !== undefined ? sanitizeIntroLetterColors(introLetterColors) : undefined;

    // Press kit (/press). Every text field goes through pressText, which trims
    // and turns a cleared field into null rather than "" — an empty string here
    // would render as an empty section on the public page. The quotes column is
    // whole-value sanitized for the same reason hoverShimmer is: it's written
    // as one value, so a bad entry inside it is dropped rather than failing the
    // save. Cast because Prisma types a Json column as InputJsonValue, which an
    // interface doesn't structurally satisfy — the value has just been
    // sanitized, so it is plain JSON.
    const safePressShortBio =
      pressShortBio !== undefined ? pressText(pressShortBio, MAX_PRESS_SHORT_BIO) : undefined;
    const safePressBookingName =
      pressBookingName !== undefined ? pressText(pressBookingName, MAX_PRESS_BOOKING_NAME) : undefined;
    const safePressBookingEmail =
      pressBookingEmail !== undefined
        ? (() => {
            const clean = normalizeEmail(pressBookingEmail);
            return clean && isValidSubscriberEmail(clean) ? clean : null;
          })()
        : undefined;
    const safePressTechRider =
      pressTechRider !== undefined ? pressText(pressTechRider, MAX_PRESS_TECH_RIDER) : undefined;
    const safePressPhotoCredit =
      pressPhotoCredit !== undefined ? pressText(pressPhotoCredit, MAX_PRESS_PHOTO_CREDIT) : undefined;
    const safePressQuotes =
      pressQuotes !== undefined
        ? (sanitizePressQuotes(pressQuotes) as unknown as Prisma.InputJsonValue)
        : undefined;

    const profile = await prisma.profile.upsert({
      where: { id: "default-profile" },
      update: {
        ...(bio !== undefined && { bio }),
        ...(profileImage !== undefined && { profileImage }),
        ...(profileImages !== undefined && { profileImages }),
        ...(backgroundImage !== undefined && { backgroundImage }),
        ...(logoImage !== undefined && { logoImage }),
        ...(sidebarIcon !== undefined && { sidebarIcon }),
        ...(chatIcon !== undefined && { chatIcon }),
        ...(sidebarIconColors !== undefined && { sidebarIconColors }),
        ...(maintenanceIcon !== undefined && { maintenanceIcon }),
        ...(errorIcon !== undefined && { errorIcon }),
        ...(footerIcon !== undefined && { footerIcon }),
        ...(sidebarMobileIcon !== undefined && { sidebarMobileIcon }),
        ...(splashIcon !== undefined && { splashIcon }),
        ...(faviconIcon !== undefined && { faviconIcon }),
        ...(maintenanceIconColors !== undefined && { maintenanceIconColors }),
        ...(footerIconColors !== undefined && { footerIconColors }),
        ...(sidebarMobileIconColors !== undefined && { sidebarMobileIconColors }),
        ...(splashIconColors !== undefined && { splashIconColors }),
        ...(faviconIconColors !== undefined && { faviconIconColors }),
        ...(headline !== undefined && { headline }),
        ...(displayName !== undefined && { displayName }),
        ...(basedIn !== undefined && { basedIn }),
        ...(experience !== undefined && { experience }),
        ...(languages !== undefined && { languages }),
        ...(instagram !== undefined && { instagram }),
        ...(facebook !== undefined && { facebook }),
        ...(twitter !== undefined && { twitter }),
        ...(email !== undefined && { email }),
        ...(phone !== undefined && { phone }),
        ...(address !== undefined && { address }),
        ...(contactHeading !== undefined && { contactHeading }),
        ...(contactIntro !== undefined && { contactIntro }),
        ...(commissionHeading !== undefined && { commissionHeading }),
        ...(commissionIntro !== undefined && { commissionIntro }),
        ...(safeCarouselMode !== undefined && { carouselMode: safeCarouselMode }),
        ...(safeStoriesCarouselMode !== undefined && { storiesCarouselMode: safeStoriesCarouselMode }),
        ...(safeStoriesCarouselSpeed !== undefined && { storiesCarouselSpeed: safeStoriesCarouselSpeed }),
        ...(safeCarouselSpeed !== undefined && { carouselSpeed: safeCarouselSpeed }),
        ...(safeHoverShimmer !== undefined && { hoverShimmer: safeHoverShimmer }),
        ...(safeMaintenanceMode !== undefined && { maintenanceMode: safeMaintenanceMode }),
        ...(safeMaintenanceMessage !== undefined && {
          maintenanceMessage: safeMaintenanceMessage,
        }),
        ...(musicUrl !== undefined && { musicUrl }),
        ...(safeMusicEnabled !== undefined && { musicEnabled: safeMusicEnabled }),
        ...(safeMusicVolume !== undefined && { musicVolume: safeMusicVolume }),
        ...(safeIntroEnabled !== undefined && { introEnabled: safeIntroEnabled }),
        ...(safeIntroEffect !== undefined && { introEffect: safeIntroEffect }),
        ...(safeIntroSpeedMs !== undefined && { introSpeedMs: safeIntroSpeedMs }),
        ...(safeIntroText !== undefined && { introText: safeIntroText }),
        ...(safeIntroBgColor !== undefined && { introBgColor: safeIntroBgColor }),
        ...(safeIntroTaglineFontSize !== undefined && {
          introTaglineFontSize: safeIntroTaglineFontSize,
          introTaglineFontSizeMobile: safeIntroTaglineFontSizeMobile,
          introTaglineAboveFontSizeMobile: safeIntroTaglineAboveFontSizeMobile,
        }),
        ...(safeIntroTaglineFontFamily !== undefined && {
          introTaglineFontFamily: safeIntroTaglineFontFamily,
        }),
        ...(safeIntroTextAbove !== undefined && { introTextAbove: safeIntroTextAbove }),
        ...(safeIntroTaglineColor !== undefined && { introTaglineColor: safeIntroTaglineColor }),
        ...(safeIntroTaglineAboveFontSize !== undefined && {
          introTaglineAboveFontSize: safeIntroTaglineAboveFontSize,
        }),
        ...(safeIntroTaglineAboveFontFamily !== undefined && {
          introTaglineAboveFontFamily: safeIntroTaglineAboveFontFamily,
        }),
        ...(safeIntroTaglineAboveColor !== undefined && {
          introTaglineAboveColor: safeIntroTaglineAboveColor,
        }),
        ...(safeIntroGlowIntensity !== undefined && { introGlowIntensity: safeIntroGlowIntensity }),
        ...(safeIntroGlowColor !== undefined && { introGlowColor: safeIntroGlowColor }),
        ...(safeIntroSquidColor !== undefined && { introSquidColor: safeIntroSquidColor }),
        ...(safeIntroGlowShimmer !== undefined && { introGlowShimmer: safeIntroGlowShimmer }),
        ...(safeIntroGlowOffsetX !== undefined && { introGlowOffsetX: safeIntroGlowOffsetX }),
        ...(safeIntroGlowOffsetY !== undefined && { introGlowOffsetY: safeIntroGlowOffsetY }),
        ...(safeIntroLetterColors !== undefined && { introLetterColors: safeIntroLetterColors }),
        ...(callingCardFront !== undefined && { callingCardFront }),
        ...(callingCardBack !== undefined && { callingCardBack }),
        ...(safeReleaseNotesEnabled !== undefined && {
          releaseNotesEnabled: safeReleaseNotesEnabled,
        }),
        ...(safeReleaseNotesLimit !== undefined && { releaseNotesLimit: safeReleaseNotesLimit }),
        ...(safePressShortBio !== undefined && { pressShortBio: safePressShortBio }),
        ...(safePressBookingName !== undefined && { pressBookingName: safePressBookingName }),
        ...(safePressBookingEmail !== undefined && { pressBookingEmail: safePressBookingEmail }),
        ...(safePressTechRider !== undefined && { pressTechRider: safePressTechRider }),
        ...(pressStagePlot !== undefined && { pressStagePlot }),
        ...(safePressPhotoCredit !== undefined && { pressPhotoCredit: safePressPhotoCredit }),
        ...(safePressQuotes !== undefined && { pressQuotes: safePressQuotes }),
      },
      create: {
        id: "default-profile",
        bio: bio || "",
        profileImage,
        profileImages: profileImages || [],
        backgroundImage,
        logoImage,
        sidebarIcon,
        chatIcon,
        sidebarIconColors: sidebarIconColors || [],
        maintenanceIcon,
        errorIcon,
        footerIcon,
        sidebarMobileIcon,
        splashIcon,
        faviconIcon,
        maintenanceIconColors: maintenanceIconColors || [],
        footerIconColors: footerIconColors || [],
        sidebarMobileIconColors: sidebarMobileIconColors || [],
        splashIconColors: splashIconColors || [],
        faviconIconColors: faviconIconColors || [],
        headline,
        displayName,
        basedIn,
        experience,
        languages,
        instagram,
        facebook,
        twitter,
        email,
        phone,
        address,
        contactHeading,
        contactIntro,
        commissionHeading,
        commissionIntro,
        ...(safeCarouselMode !== undefined && { carouselMode: safeCarouselMode }),
        ...(safeStoriesCarouselMode !== undefined && { storiesCarouselMode: safeStoriesCarouselMode }),
        ...(safeStoriesCarouselSpeed !== undefined && { storiesCarouselSpeed: safeStoriesCarouselSpeed }),
        ...(safeCarouselSpeed !== undefined && { carouselSpeed: safeCarouselSpeed }),
        ...(safeHoverShimmer !== undefined && { hoverShimmer: safeHoverShimmer }),
        ...(safeMaintenanceMode !== undefined && { maintenanceMode: safeMaintenanceMode }),
        ...(safeMaintenanceMessage !== undefined && {
          maintenanceMessage: safeMaintenanceMessage,
        }),
        ...(musicUrl !== undefined && { musicUrl }),
        ...(safeMusicEnabled !== undefined && { musicEnabled: safeMusicEnabled }),
        ...(safeMusicVolume !== undefined && { musicVolume: safeMusicVolume }),
        ...(safeIntroEnabled !== undefined && { introEnabled: safeIntroEnabled }),
        ...(safeIntroEffect !== undefined && { introEffect: safeIntroEffect }),
        ...(safeIntroSpeedMs !== undefined && { introSpeedMs: safeIntroSpeedMs }),
        ...(safeIntroText !== undefined && { introText: safeIntroText }),
        ...(safeIntroBgColor !== undefined && { introBgColor: safeIntroBgColor }),
        ...(safeIntroTaglineFontSize !== undefined && {
          introTaglineFontSize: safeIntroTaglineFontSize,
          introTaglineFontSizeMobile: safeIntroTaglineFontSizeMobile,
          introTaglineAboveFontSizeMobile: safeIntroTaglineAboveFontSizeMobile,
        }),
        ...(safeIntroTaglineFontFamily !== undefined && {
          introTaglineFontFamily: safeIntroTaglineFontFamily,
        }),
        ...(safeIntroTextAbove !== undefined && { introTextAbove: safeIntroTextAbove }),
        ...(safeIntroTaglineColor !== undefined && { introTaglineColor: safeIntroTaglineColor }),
        ...(safeIntroTaglineAboveFontSize !== undefined && {
          introTaglineAboveFontSize: safeIntroTaglineAboveFontSize,
        }),
        ...(safeIntroTaglineAboveFontFamily !== undefined && {
          introTaglineAboveFontFamily: safeIntroTaglineAboveFontFamily,
        }),
        ...(safeIntroTaglineAboveColor !== undefined && {
          introTaglineAboveColor: safeIntroTaglineAboveColor,
        }),
        ...(safeIntroGlowIntensity !== undefined && { introGlowIntensity: safeIntroGlowIntensity }),
        ...(safeIntroGlowColor !== undefined && { introGlowColor: safeIntroGlowColor }),
        ...(safeIntroSquidColor !== undefined && { introSquidColor: safeIntroSquidColor }),
        ...(safeIntroGlowShimmer !== undefined && { introGlowShimmer: safeIntroGlowShimmer }),
        ...(safeIntroGlowOffsetX !== undefined && { introGlowOffsetX: safeIntroGlowOffsetX }),
        ...(safeIntroGlowOffsetY !== undefined && { introGlowOffsetY: safeIntroGlowOffsetY }),
        ...(safeIntroLetterColors !== undefined && { introLetterColors: safeIntroLetterColors }),
        ...(callingCardFront !== undefined && { callingCardFront }),
        ...(callingCardBack !== undefined && { callingCardBack }),
        ...(safeReleaseNotesEnabled !== undefined && {
          releaseNotesEnabled: safeReleaseNotesEnabled,
        }),
        ...(safeReleaseNotesLimit !== undefined && { releaseNotesLimit: safeReleaseNotesLimit }),
        // Same press fields on create — a site whose Profile row doesn't exist
        // yet must not silently drop the first press-kit save.
        ...(safePressShortBio !== undefined && { pressShortBio: safePressShortBio }),
        ...(safePressBookingName !== undefined && { pressBookingName: safePressBookingName }),
        ...(safePressBookingEmail !== undefined && { pressBookingEmail: safePressBookingEmail }),
        ...(safePressTechRider !== undefined && { pressTechRider: safePressTechRider }),
        ...(pressStagePlot !== undefined && { pressStagePlot }),
        ...(safePressPhotoCredit !== undefined && { pressPhotoCredit: safePressPhotoCredit }),
        ...(safePressQuotes !== undefined && { pressQuotes: safePressQuotes }),
      },
    });

    revalidatePath("/", "layout");
    return NextResponse.json(profile);
  } catch (err) {
    console.error("[PUT /api/profile]", err);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}
