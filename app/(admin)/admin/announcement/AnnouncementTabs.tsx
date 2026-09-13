// app/(admin)/admin/announcement/AnnouncementTabs.tsx
"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Megaphone, ScrollText, MessageCircleQuestion } from "lucide-react";
import { AnnouncementClient, type Announcement } from "./AnnouncementClient";
import { MarqueeClient } from "./MarqueeClient";
import { FaqsClient, type Faq } from "./FaqsClient";
import type { Marquee } from "@/lib/marquee";

/**
 * Three distinct surfaces live under "Announcements": the modal popup, the
 * scrolling ticker, and the public FAQ chatbox's questions & answers. They
 * share nothing but the page, so each gets a tab rather than one form
 * trying to configure all three.
 */
export function AnnouncementTabs({
  initialAnnouncements,
  initialMarquees,
  initialFaqs,
}: {
  initialAnnouncements: Announcement[];
  initialMarquees: Marquee[];
  initialFaqs: Faq[];
}) {
  const [tab, setTab] = useState<"popups" | "marquees" | "faqs">("popups");
  const searchParams = useSearchParams();

  // Deep-link support (e.g. /admin/announcement?tab=faqs) — same pattern as
  // ArtworksClient.tsx's ?tab=museum, used by the Settings hub's FAQ card.
  useEffect(() => {
    const requested = searchParams.get("tab");
    if (requested === "popups" || requested === "marquees" || requested === "faqs") {
      setTab(requested);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const TABS = [
    {
      key: "popups" as const,
      label: "Popups",
      icon: Megaphone,
      count: initialAnnouncements.length,
    },
    {
      key: "marquees" as const,
      label: "Marquee Banners",
      icon: ScrollText,
      count: initialMarquees.length,
    },
    {
      key: "faqs" as const,
      label: "FAQ Chatbox",
      icon: MessageCircleQuestion,
      count: initialFaqs.length,
    },
  ];

  return (
    <div className="space-y-6">
      <div
        role="tablist"
        aria-label="Announcement type"
        className="flex gap-1 p-1 rounded-2xl admin-input border overflow-x-auto"
      >
        {TABS.map(({ key, label, icon: Icon, count }) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-jakarta text-sm font-medium transition-all whitespace-nowrap ${
              tab === key
                ? "bg-white dark:bg-[#1A1A1A] text-ink dark:text-cream shadow-sm"
                : "text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream"
            }`}
          >
            <Icon size={16} strokeWidth={1.5} />
            {label}
            <span className="text-[10px] font-mono opacity-60 tabular-nums">{count}</span>
          </button>
        ))}
      </div>

      {tab === "popups" && <AnnouncementClient initialAnnouncements={initialAnnouncements} />}
      {tab === "marquees" && <MarqueeClient initialMarquees={initialMarquees} />}
      {tab === "faqs" && <FaqsClient initialFaqs={initialFaqs} />}
    </div>
  );
}
