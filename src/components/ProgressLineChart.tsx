import { useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useLanguage } from '../lib/i18n';
import './ProgressLineChart.css';

export interface ChartPoint {
  date: string;
  value: number;
}

interface ProgressLineChartProps {
  points: ChartPoint[];
  label: string;
  unit: string;
}

const WIDTH = 600;
const HEIGHT = 220;
const PAD_X = 12;
const PAD_TOP = 24;
const PAD_BOTTOM = 28;

export function ProgressLineChart({ points, label, unit }: ProgressLineChartProps) {
  const { t, lang } = useLanguage();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const dateLocale = lang === 'en' ? 'en-US' : 'es-AR';

  if (points.length < 2) {
    return (
      <p style={{ color: 'var(--oc-text-muted)', fontSize: 13 }}>
        {t('progress.needTwo', { metric: label.toLowerCase() })}
      </p>
    );
  }

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const plotWidth = WIDTH - PAD_X * 2;
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;

  const coords = points.map((p, i) => {
    const x = PAD_X + (i / (points.length - 1)) * plotWidth;
    const y = PAD_TOP + plotHeight - ((p.value - min) / range) * plotHeight;
    return { x, y, point: p };
  });

  const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${PAD_TOP + plotHeight} L ${coords[0].x.toFixed(1)} ${PAD_TOP + plotHeight} Z`;

  const last = coords[coords.length - 1];
  const hovered = hoverIndex !== null ? coords[hoverIndex] : null;

  function handleMove(e: ReactPointerEvent<SVGRectElement>) {
    const svg = e.currentTarget.ownerSVGElement;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * WIDTH;
    let nearest = 0;
    let nearestDist = Infinity;
    coords.forEach((c, i) => {
      const dist = Math.abs(c.x - relX);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = i;
      }
    });
    setHoverIndex(nearest);
  }

  const gradientId = `oc-chart-fill-${label.replace(/\s+/g, '-')}`;

  return (
    <div className="oc-chart">
      <div className="oc-chart__header">
        <span className="oc-chart__title">{label}</span>
        <span className="oc-chart__endpoint">
          {last.point.value}
          {unit}
        </span>
      </div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="oc-chart__svg" role="img" aria-label={t('progress.evolutionOf', { label })}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--oc-energy)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--oc-energy)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0, 0.5, 1].map((t) => (
          <line
            key={t}
            x1={PAD_X}
            x2={WIDTH - PAD_X}
            y1={PAD_TOP + plotHeight * t}
            y2={PAD_TOP + plotHeight * t}
            className="oc-chart__gridline"
          />
        ))}

        <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />
        <path d={linePath} fill="none" stroke="var(--oc-energy)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

        <circle cx={last.x} cy={last.y} r={4} fill="var(--oc-energy)" stroke="var(--oc-ink)" strokeWidth={2} />

        {hovered && (
          <>
            <line x1={hovered.x} x2={hovered.x} y1={PAD_TOP} y2={PAD_TOP + plotHeight} className="oc-chart__crosshair" />
            <circle cx={hovered.x} cy={hovered.y} r={5} fill="var(--oc-energy)" stroke="var(--oc-ink)" strokeWidth={2} />
          </>
        )}

        <rect
          x={0}
          y={0}
          width={WIDTH}
          height={HEIGHT}
          fill="transparent"
          onPointerMove={handleMove}
          onPointerLeave={() => setHoverIndex(null)}
        />
      </svg>
      {hovered && (
        <div
          className="oc-chart__tooltip"
          style={{ left: `${(hovered.x / WIDTH) * 100}%` }}
        >
          <strong>
            {hovered.point.value}
            {unit}
          </strong>
          <span>{new Date(hovered.point.date).toLocaleDateString(dateLocale)}</span>
        </div>
      )}
    </div>
  );
}
