import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import type { IScannerControls } from '@zxing/browser';
import { Button } from './ui/Button';
import './BarcodeScanner.css';

interface BarcodeScannerProps {
  onDetected: (code: string) => void;
  onClose: () => void;
}

export function BarcodeScanner({ onDetected, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    let stopped = false;
    let controlsRef: IScannerControls | null = null;

    reader
      .decodeFromVideoDevice(undefined, videoRef.current ?? undefined, (result, _err, controls) => {
        controlsRef = controls;
        if (result && !stopped) {
          stopped = true;
          controls.stop();
          onDetected(result.getText());
        }
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'No se pudo acceder a la cámara.');
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
              Apuntá al código de barras del producto
            </p>
          </>
        )}
        <Button variant="ghost" onClick={onClose} style={{ marginTop: 'var(--oc-space-3)' }}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
