"use client";

// Drop-in replacement for next/image's <Image>. Renders a lightweight
// placeholder instead of a broken image whenever the source fails to load,
// so a dead host can't hang the page or surface a 500 from the image
// optimizer.
//
// Some artworks still have imageUrl values pointing at a Supabase project
// that was retired during the Aug 2026 DB migration (its storage bucket was
// never copied over to the new project, so the files are gone for good —
// see conversation on 2026-08-17). Those hosts are skipped up front instead
// of round-tripping through the optimizer, which was hanging for ~40s per
// image while Node exhausted DNS lookups for a host that no longer exists.

import { useEffect, useRef, useState, type ImgHTMLAttributes, type ReactNode } from "react";
import NextImage, { type ImageProps } from "next/image";
import { ImageOff } from "lucide-react";

// Hosts known to be permanently unreachable — add here if another storage
// project is retired without its bucket being migrated.
const DEAD_IMAGE_HOSTS = new Set(["aysybkmmlizgerjxlcfw.supabase.co"]);

function isDeadHost(src: unknown): boolean {
  if (typeof src !== "string") return false;
  try {
    return DEAD_IMAGE_HOSTS.has(new URL(src).hostname);
  } catch {
    return false;
  }
}

function ImagePlaceholder({
  className,
  fill,
  width,
  height,
}: Pick<ImageProps, "className" | "fill" | "width" | "height">) {
  return (
    <div
      className={className}
      aria-hidden
      style={{
        ...(fill
          ? { position: "absolute", inset: 0 }
          : { width, height }),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "color-mix(in srgb, currentColor 6%, transparent)",
        color: "currentColor",
        opacity: 0.45,
      }}
    >
      <ImageOff size={24} strokeWidth={1.5} />
    </div>
  );
}

export default function SafeImage(props: ImageProps) {
  const [failed, setFailed] = useState(() => isDeadHost(props.src));

  if (failed || !props.src) {
    return (
      <ImagePlaceholder
        className={props.className}
        fill={props.fill}
        width={props.width}
        height={props.height}
      />
    );
  }

  return (
    <NextImage
      {...props}
      onError={(event) => {
        setFailed(true);
        props.onError?.(event);
      }}
    />
  );
}

/**
 * The same fallback for a plain `<img>`.
 *
 * A handful of uploaded images can't go through next/image: the logo in the
 * navbar and admin sidebar (sized by height with `w-auto`, which next/image
 * can't express without knowing the aspect ratio up front), the announcement
 * popup's free-aspect image, the calling card's 3D flip faces, search-result
 * thumbnails. Before this each of those was a bare `<img>` — a dead host
 * showed the browser's broken-image glyph (or nothing at all) while every
 * SafeImage elsewhere showed the placeholder above, which is the
 * inconsistency this closes. Same dead-host short-circuit, same placeholder,
 * so a missing upload looks the same wherever it was meant to appear.
 *
 * The placeholder takes the `<img>`'s own className so it occupies the same
 * box; pass `placeholderClassName` when the image's classes don't make sense
 * on a div (e.g. `object-contain`) and you want a fixed-size stand-in instead.
 */
export function SafeImg({
  src,
  className,
  placeholderClassName,
  fallback,
  onError,
  alt = "",
  ...rest
}: ImgHTMLAttributes<HTMLImageElement> & {
  placeholderClassName?: string;
  /** Rendered instead of the generic placeholder when the image is missing
   *  or dead — e.g. the SCRIPT/N(squid)VEL wordmark standing in for the logo. */
  fallback?: ReactNode;
}) {
  const [failed, setFailed] = useState(() => isDeadHost(src));
  const ref = useRef<HTMLImageElement>(null);

  // A server-rendered <img> that 404s *before* React hydrates never fires
  // onError — the event came and went with nobody listening — which is how a
  // dead logo showed the browser's alt text instead of a fallback. On mount,
  // ask the element directly: a finished load with no pixels is a failure.
  useEffect(() => {
    const el = ref.current;
    if (el && el.complete && el.naturalWidth === 0) setFailed(true);
  }, [src]);

  if (failed || !src) {
    if (fallback !== undefined) return <>{fallback}</>;
    return (
      <div
        className={placeholderClassName ?? className}
        aria-hidden
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "color-mix(in srgb, currentColor 6%, transparent)",
          color: "currentColor",
          opacity: 0.45,
          minWidth: "2rem",
          minHeight: "2rem",
        }}
      >
        <ImageOff size={24} strokeWidth={1.5} />
      </div>
    );
  }

  // Deliberately a plain <img>; see the comment above for why these can't
  // be next/image.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      {...rest}
      ref={ref}
      src={src}
      alt={alt}
      className={className}
      onError={(event) => {
        setFailed(true);
        onError?.(event);
      }}
    />
  );
}
