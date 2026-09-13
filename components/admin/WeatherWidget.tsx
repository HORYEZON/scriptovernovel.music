'use client';

import { useEffect, useState } from 'react';
import { Sun, Cloud, CloudSun, CloudRain, CloudDrizzle, CloudLightning, CloudSnow, CloudFog, Loader2 } from 'lucide-react';

// Business is based in NCR, Philippines (see contact page default address),
// so the dashboard shows local weather for Metro Manila rather than trying
// browser geolocation — this is an admin's studio weather, not a visitor's.
const LATITUDE = 14.5995;
const LONGITUDE = 120.9842;
const LOCATION_LABEL = 'Manila';

// Refresh well under Open-Meteo's hourly update cadence; no point polling faster.
const REFRESH_MS = 15 * 60 * 1000;

type WeatherState = {
  tempC: number;
  code: number;
} | null;

// WMO weather code -> icon + short label.
// https://open-meteo.com/en/docs (weather_code field)
function describeCode(code: number): { Icon: typeof Sun; label: string } {
  if (code === 0) return { Icon: Sun, label: 'Clear' };
  if (code === 1 || code === 2) return { Icon: CloudSun, label: 'Partly cloudy' };
  if (code === 3) return { Icon: Cloud, label: 'Overcast' };
  if (code === 45 || code === 48) return { Icon: CloudFog, label: 'Foggy' };
  if (code >= 51 && code <= 57) return { Icon: CloudDrizzle, label: 'Drizzle' };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { Icon: CloudRain, label: 'Rain' };
  if (code >= 71 && code <= 77) return { Icon: CloudSnow, label: 'Snow' };
  if (code >= 95) return { Icon: CloudLightning, label: 'Thunderstorm' };
  return { Icon: Cloud, label: 'Cloudy' };
}

export default function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherState>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${LATITUDE}&longitude=${LONGITUDE}&current=temperature_2m,weather_code&timezone=Asia%2FManila`,
          { signal: AbortSignal.timeout(8000) }
        );
        if (!res.ok) throw new Error('weather fetch failed');
        const data = await res.json();
        if (cancelled) return;
        setWeather({
          tempC: Math.round(data.current.temperature_2m),
          code: data.current.weather_code,
        });
        setFailed(false);
      } catch {
        // Weather is a nice-to-have on the dashboard — fail quietly rather
        // than surfacing an error state for a non-critical widget.
        if (!cancelled) setFailed(true);
      }
    }

    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  if (failed) return null;

  if (!weather) {
    return (
      <div className="flex items-center gap-1.5 text-ink-300 dark:text-ink-600">
        <Loader2 size={13} className="animate-spin" />
      </div>
    );
  }

  const { Icon, label } = describeCode(weather.code);

  return (
    <div
      className="flex items-center gap-1.5 font-jakarta text-xs font-medium text-ink-400 dark:text-ink-300"
      title={`${label} in ${LOCATION_LABEL}`}
    >
      <Icon size={14} className="text-sepia shrink-0" strokeWidth={2} />
      <span className="font-mono tracking-wide text-ink dark:text-cream">{weather.tempC}°C</span>
      <span className="hidden sm:inline text-ink-300 dark:text-ink-600">·</span>
      <span className="hidden sm:inline">{LOCATION_LABEL}</span>
    </div>
  );
}
