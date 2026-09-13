'use client';

// components/admin/DashboardCalendar.tsx
//
// The panel behind the sidebar clock. The month grid it draws now lives in
// CalendarPanel.tsx, shared with AdminDatePicker — this file is what is left
// once that is lifted out: the popover shell, the dismiss behaviour, and a
// footer that reads back the day being looked at.
//
// The selection here is a scratch pad, not a value: nothing is submitted and
// nothing is stored. That is the whole reason the panel and the pickers keep
// their own state rather than sharing one.

import { useEffect, useRef, useState } from 'react';
import { CalendarPanel } from './CalendarPanel';

type DashboardCalendarProps = {
  onClose: () => void;
};

export default function DashboardCalendar({ onClose }: DashboardCalendarProps) {
  const today = new Date();
  const [selected, setSelected] = useState(today);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      ref={panelRef}
      className="admin-modal absolute left-0 top-full mt-2 z-50 w-72 rounded-2xl border shadow-xl p-4 animate-fade-in origin-top-left"
    >
      <CalendarPanel
        selected={selected}
        onSelect={setSelected}
        footer={
          <div className="flex items-center justify-between">
            <p className="font-body text-[11px] text-ink-400 dark:text-ink-300">
              {selected.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
            <button
              type="button"
              onClick={() => setSelected(new Date())}
              className="font-body text-[11px] font-semibold text-sepia hover:text-sepia-dark transition-colors"
            >
              Today
            </button>
          </div>
        }
      />
    </div>
  );
}
