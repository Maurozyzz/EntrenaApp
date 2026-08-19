import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import type { IScannerControls } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import { useLanguage } from '../lib/i18n';
import { Button } from './ui/Button';
import './BarcodeScanner.css';

interface BarcodeScannerProps {
  onDetected: (code: string) => void;
  onClose: () => void;
}

// Los productos de gimnasio/comida son casi siempre 1D (EAN/UPC), nunca QR:
// restringir el formato + TRY_HARDER mejora mucho la detección en video real
// (con la lista de formatos completa por defecto, la cámara del celular casi
// nunca llegaba a decodificar un código de barras real).
const hints = new Map();
hints.set(DecodeHintType.POSSIBLE_FORMATS, [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.CODE_128,
]);
hints.set(DecodeHintType.TRY_HARDER, true);

export function BarcodeScanner({ onDetected, onClose }: BarcodeScannerProps) {
  const { t } = useLanguage();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const reader = new BrowserMultiFormatReader(hints);
    let stopped = false;
    let controlsRef: IScannerControls | null = null;

    reader
      .decodeFromConstraints(
        // Resolución más alta que el default del navegador: con la resolución
        // baja que eligen muchos celulares por default, las barras finas del
        // código no se distinguen y nunca llega a decodificar.
        { video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } },
        videoRef.current ?? undefined,
        (result, _err, controls) => {
          controlsRef = controls;
          if (result && !stopped) {
            stopped = true;
            controls.stop();
            onDetected(result.getText());
          }
        },
      )
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : t('scanner.genericError'));
      });

    return () => {
      stopped = true;
      controlsRef?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="oc-scanner-overlay">
      <div className="oc-scanner-box">
        {error ? (
          <p style={{ color: 'var(--oc-danger)' }}>{error}</p>
        ) : (
          <>
            <video ref={videoRef} className="oc-scanner-video" muted playsInline />
            <p style={{ color: 'var(--oc-text-muted)', fontSize: 13, marginTop: 'var(--oc-space-3)' }}>
              {t('scanner.aim')}
            </p>
          </>
        )}
        <Button variant="ghost" onClick={onClose} style={{ marginTop: 'var(--oc-space-3)' }}>
          {t('common.cancel')}
        </Button>
      </div>
    </div>
  );
}
