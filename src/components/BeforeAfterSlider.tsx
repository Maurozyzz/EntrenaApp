import { useState } from 'react';
import { useLanguage } from '../lib/i18n';
import './BeforeAfterSlider.css';

interface PhotoSide {
  url: string;
  date: string;
}

export function BeforeAfterSlider({ before, after }: { before: PhotoSide; after: PhotoSide }) {
  const { t, lang } = useLanguage();
  const [split, setSplit] = useState(50);
  const dateLocale = lang === 'en' ? 'en-US' : 'es-AR';
  const beforeLabel = t('progress.before');
  const afterLabel = t('progress.after');

  return (
    <div className="oc-compare">
      <div className="oc-compare__frame">
        <img src={before.url} alt={`${beforeLabel} (${before.date})`} className="oc-compare__img" />
        <div className="oc-compare__after" style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}>
          <img src={after.url} alt={`${afterLabel} (${after.date})`} className="oc-compare__img" />
        </div>
        <div className="oc-compare__handle" style={{ left: `${split}%` }} />
        <span className="oc-compare__label oc-compare__label--left">{beforeLabel}</span>
        <span className="oc-compare__label oc-compare__label--right">{afterLabel}</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={split}
        onChange={(e) => setSplit(Number(e.target.value))}
        className="oc-compare__slider"
        aria-label={t('progress.compareAria')}
      />
      <div className="oc-compare__dates">
        <span>{new Date(before.date).toLocaleDateString(dateLocale)}</span>
        <span>{new Date(after.date).toLocaleDateString(dateLocale)}</span>
      </div>
    </div>
  );
}
