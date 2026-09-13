// components/public/AnnouncementPopup.tsx
"use client";

import { useEffect, useState } from "react";
import { X, ExternalLink } from "lucide-react";
import { SafeImg } from "@/components/ui/SafeImage";

interface Announcement {
  id: string;
  title: string;
  message: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
  linkLabel: string | null;
}

export function AnnouncementPopup() {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function fetchActive() {
      try {
        const res = await fetch("/api/announcements/active", { cache: "no-store" });
        if (!res.ok) return;
        const data: Announcement | null = await res.json();

        if (!data || !data.id) return;

        // Check if user dismissed this specific announcement in this browser session/tab
        const dismissKey = `announcement_dismissed_${data.id}`;
        const isDismissed = sessionStorage.getItem(dismissKey);

        if (!isDismissed && isMounted) {
          setAnnouncement(data);
          setVisible(true);
        }
      } catch {
        // Silently catch fetch errors to avoid breaking public layout
      }
    }

    fetchActive();
    return () => {
      isMounted = false;
    };
  }, []);

  // Lock background body scroll when popup is active/visible
  useEffect(() => {
    if (visible) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [visible]);

  function handleDismiss() {
    if (announcement?.id) {
      sessionStorage.setItem(`announcement_dismissed_${announcement.id}`, "true");
    }
    setVisible(false);
  }

  if (!visible || !announcement) {
    return null;
  }

  const defaultButtonLabel = "Click here to check more info";
  const buttonLabel = announcement.linkLabel?.trim() || defaultButtonLabel;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-md transition-opacity animate-in fade-in duration-300">
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-[#121212] border border-white/15 p-6 sm:p-8 shadow-2xl flex flex-col items-center text-center custom-scrollbar">
        {/* Close Button */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 text-cream/80 hover:text-cream hover:bg-white/20 transition-all duration-200"
          aria-label="Close announcement"
        >
          <X size={18} />
        </button>

        {/* Image (if available) */}
        {announcement.imageUrl && (
          <div className="w-full max-h-[55vh] rounded-xl overflow-hidden mb-6 border border-white/10 bg-black/40 flex items-center justify-center">
            <SafeImg
              src={announcement.imageUrl}
              alt={announcement.title}
              className="w-auto h-auto max-w-full max-h-[55vh] object-contain rounded-xl"
              placeholderClassName="w-full h-40 rounded-xl"
            />
          </div>
        )}

        {/* Title */}
        <h2 className="font-grotesk text-xl sm:text-2xl font-bold tracking-tight text-white mb-3">
          {announcement.title}
        </h2>

        {/* Message */}
        {announcement.message && (
          <p className="font-body text-sm sm:text-base text-white/80 leading-relaxed mb-6 whitespace-pre-wrap">
            {announcement.message}
          </p>
        )}

        {/* CTA Link Button (only if linkUrl is present) */}
        {announcement.linkUrl && (
          <a
            href={announcement.linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleDismiss}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-sepia text-white font-jakarta text-sm font-semibold hover:bg-sepia-dark transition-all duration-200 shadow-lg group hover:scale-[1.02]"
          >
            <span>{buttonLabel}</span>
            <ExternalLink size={16} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </a>
        )}
      </div>
    </div>
  );
}
