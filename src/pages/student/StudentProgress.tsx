import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../lib/AuthContext';
import { AppShell } from '../../components/layout/AppShell';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Field, Input, Select } from '../../components/ui/Input';
import { PhotoLogUploader } from '../../components/PhotoLogUploader';
import { ProgressLineChart } from '../../components/ProgressLineChart';
import { BeforeAfterSlider } from '../../components/BeforeAfterSlider';
import { STUDENT_NAV } from './nav';
import type { BodyMeasurement } from '../../lib/types';

const PHOTOS_BUCKET = 'progress-photos';

type Metric = 'weight_kg' | 'waist_cm';

const METRIC_LABELS: Record<Metric, { label: string; unit: string }> = {
  weight_kg: { label: 'Peso', unit: 'kg' },
  waist_cm: { label: 'Cintura', unit: 'cm' },
};

export function StudentProgress() {
  const { profile } = useAuth();
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState<Metric>('weight_kg');
  const [weightKg, setWeightKg] = useState('');
  const [waistCm, setWaistCm] = useState('');
  const [saving, setSaving] = useState(false);

  const [comparePhotos, setComparePhotos] = useState<{ before: { url: string; date: string }; after: { url: string; date: string } } | null>(null);

  async function load() {
    if (!profile) return;
    setLoading(true);
    const { data } = await supabase
      .from('body_measurements')
      .select('*')
      .eq('student_id', profile.id)
      .order('measured_at', { ascending: false });
    setMeasurements(data ?? []);
    setLoading(false);
  }

  async function loadComparePhotos() {
    if (!profile) return;
    const { data } = await supabase
      .from('progress_photos')
      .select('*')
      .eq('student_id', profile.id)
      .order('taken_at', { ascending: true });
    const rows = data ?? [];
    if (rows.length < 2) {
      setComparePhotos(null);
      return;
    }
    const oldest = rows[0];
    const newest = rows[rows.length - 1];
    const [{ data: beforeSigned }, { data: afterSigned }] = await Promise.all([
      supabase.storage.from(PHOTOS_BUCKET).createSignedUrl(oldest.storage_path, 60 * 60),
      supabase.storage.from(PHOTOS_BUCKET).createSignedUrl(newest.storage_path, 60 * 60),
    ]);
    if (beforeSigned?.signedUrl && afterSigned?.signedUrl) {
      setComparePhotos({
        before: { url: beforeSigned.signedUrl, date: oldest.taken_at },
        after: { url: afterSigned.signedUrl, date: newest.taken_at },
      });
    }
  }

  useEffect(() => {
    load();
    loadComparePhotos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    await supabase.from('body_measurements').insert({
      student_id: profile.id,
      weight_kg: weightKg ? Number(weightKg) : null,
      waist_cm: waistCm ? Number(waistCm) : null,
    });
    setWeightKg('');
    setWaistCm('');
    setSaving(false);
    load();
  }

  const chartPoints = measurements
    .filter((m) => m[metric] != null)
    .map((m) => ({ date: m.measured_at, value: m[metric] as number }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <AppShell links={STUDENT_NAV}>
      <h1 style={{ color: 'var(--oc-gold)' }}>Mi progreso</h1>

      <Card style={{ marginTop: 'var(--oc-space-4)', marginBottom: 'var(--oc-space-4)' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 'var(--oc-space-3)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ width: 100 }}>
            <Field label="Peso (kg)">
              <Input value={weightKg} onChange={(e) => setWeightKg(e.target.value)} inputMode="decimal" />
            </Field>
          </div>
          <div style={{ width: 100 }}>
            <Field label="Cintura (cm)">
              <Input value={waistCm} onChange={(e) => setWaistCm(e.target.value)} inputMode="decimal" />
            </Field>
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? 'Guardando…' : 'Cargar medición'}
          </Button>
        </form>
      </Card>

      {!loading && measurements.length > 0 && (
        <Card style={{ marginBottom: 'var(--oc-space-4)' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--oc-space-2)' }}>
            <div style={{ width: 140 }}>
              <Select value={metric} onChange={(e) => setMetric(e.target.value as Metric)}>
                <option value="weight_kg">Peso</option>
                <option value="waist_cm">Cintura</option>
              </Select>
            </div>
          </div>
          <ProgressLineChart points={chartPoints} label={METRIC_LABELS[metric].label} unit={METRIC_LABELS[metric].unit} />
        </Card>
      )}

      {loading ? (
        <p style={{ color: 'var(--oc-text-muted)' }}>Cargando…</p>
      ) : measurements.length === 0 ? (
        <p style={{ color: 'var(--oc-text-muted)' }}>Todavía no cargaste mediciones.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--oc-space-2)' }}>
          {measurements.map((m) => (
            <Card key={m.id} style={{ padding: 'var(--oc-space-3) var(--oc-space-4)' }}>
              <strong>{m.measured_at}</strong>
              <span style={{ color: 'var(--oc-text-muted)', fontSize: 13 }}>
                {' '}
                {m.weight_kg ? `· ${m.weight_kg}kg` : ''} {m.waist_cm ? `· cintura ${m.waist_cm}cm` : ''}
              </span>
            </Card>
          ))}
        </div>
      )}

      {profile && (
        <>
          <h2 style={{ color: 'var(--oc-gold)', marginTop: 'var(--oc-space-6)' }}>Fotos de progreso</h2>

          {comparePhotos && (
            <Card style={{ marginBottom: 'var(--oc-space-4)' }}>
              <p style={{ color: 'var(--oc-text-muted)', fontSize: 13, marginTop: 0 }}>Arrastrá para comparar</p>
              <BeforeAfterSlider before={comparePhotos.before} after={comparePhotos.after} />
            </Card>
          )}

          <PhotoLogUploader
            bucket="progress-photos"
            table="progress_photos"
            studentId={profile.id}
            uploadLabel="+ Subir una foto"
            emptyLabel="Todavía no subiste fotos."
            onUploaded={loadComparePhotos}
          />
        </>
      )}
    </AppShell>
  );
}
