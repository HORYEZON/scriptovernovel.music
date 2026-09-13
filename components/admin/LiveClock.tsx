'use client';

import { useState, useEffect } from 'react';
import { Calendar } from 'lucide-react';
import DashboardCalendar from './DashboardCalendar';
import WeatherWidget from './WeatherWidget';

export default function LiveClock() {
    const [time, setTime] = useState<Date | null>(null);
    const [calendarOpen, setCalendarOpen] = useState(false);

    useEffect(() => {
        setTime(new Date());
        const timer = setInterval(() => {
        setTime(new Date());
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    // Return empty/skeleton first while executing on the client to avoid a hydration error
    if (!time) return null;

    const formattedDate = time.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });

    const formattedTime = time.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });

    return (
        <div className="flex items-center justify-between gap-3 mt-1">
        <div className="relative">
            <button
            type="button"
            onClick={() => setCalendarOpen((v) => !v)}
            aria-expanded={calendarOpen}
            className="font-jakarta text-xs font-medium text-ink-400 dark:text-ink-300 flex items-center gap-2 rounded-md -ml-1.5 pl-1.5 pr-2 py-0.5 hover:bg-sepia/10 hover:text-sepia transition-colors"
            >
            <Calendar size={12} strokeWidth={2} className="shrink-0" />
            <span>{formattedDate}</span>
            <span>•</span>
            <span className="font-mono tracking-wider text-sepia">{formattedTime}</span>
            </button>
            {calendarOpen && <DashboardCalendar onClose={() => setCalendarOpen(false)} />}
        </div>
        <WeatherWidget />
        </div>
    );
}
