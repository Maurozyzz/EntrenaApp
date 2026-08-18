import { useState } from 'react';
import './BeforeAfterSlider.css';

interface PhotoSide {
  url: string;
  date: string;
}

export function BeforeAfterSlider({ before, after }: { before: PhotoSide; after: PhotoSide }) {
  const [split, setSplit] = useState(50);

  return (
    <div className="oc-compare">
      <div className="oc-compare__frame">
        <img src={before.url} alt={`Antes (${before.date})`} className="oc-compare__img" />
        <div className="oc-compare__after" style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}>
          <img src={after.url} alt={`Después (${after.date})`} className="oc-compare__img" />
        </div>
        <div className="oc-compare__handle" style={{ left: `${split}%` }} />
        <span className="oc-compare__label oc-compare__label--left">Antes</span>
        <span className="oc-compare__label oc-compare__label--right">Después</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={split}
        onChange={(e) => setSplit(Number(e.target.value))}
        className="oc-compare__slider"
        aria-label="Comparar antes y después"
      />
      <div className="oc-compare__dates">
        <span>{new Date(before.date).toLocaleDateString('es-AR')}</span>
        <span>{new Date(after.date).toLocaleDateString('es-AR')}</span>
      </div>
    </div>
  );
}
