"use client";

import { useEffect } from "react";

/**
 * Kills native image dragging across the whole site.
 *
 * The `img { user-drag: none }` rule in globals.css handles Chrome/Safari, but
 * Firefox ignores `user-drag` and instead honours the `draggable` attribute /
 * a cancelled `dragstart`. This mounts once in the public layout and:
 *
 *  1. sets `draggable="false"` on every <img> already in the DOM,
 *  2. keeps doing so for images added later (next/image swaps, modals,
 *     carousels, admin uploads) via a MutationObserver,
 *  3. cancels any `dragstart` whose target is an <img>, as a final backstop
 *     for custom pointer/drag handlers anywhere on the page.
 *
 * Renders nothing.
 */
export function NoImageDrag() {
  useEffect(() => {
    const disable = (root: ParentNode) => {
      const imgs =
        root instanceof HTMLImageElement
          ? [root]
          : root.querySelectorAll?.("img") ?? [];
      imgs.forEach((img) => img.setAttribute("draggable", "false"));
    };

    disable(document);

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) disable(node);
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Only cancel when the drag actually originates from an <img>. Containers
    // that opt in with draggable="true" (e.g. drag-to-reorder lists) keep
    // working — their dragstart target is the container, not the image.
    const onDragStart = (e: DragEvent) => {
      if ((e.target as HTMLElement | null)?.tagName === "IMG") {
        e.preventDefault();
      }
    };
    document.addEventListener("dragstart", onDragStart, true);

    return () => {
      observer.disconnect();
      document.removeEventListener("dragstart", onDragStart, true);
    };
  }, []);

  return null;
}
