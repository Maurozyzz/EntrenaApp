import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../lib/AuthContext';
import { useLanguage } from '../../lib/i18n';
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

export function StudentProgress() {
  const { profile } = useAuth();
  const { t } = useLanguage();
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState<Metric>('weight_kg');
  const [weightKg, setWeightKg] = useState('');
  const [waistCm, setWaistCm] = useState('');
  const [saving, setSaving] = useState(false);

  const metricLabels: Record<Metric, { label: string; unit: string }> = {
    weight_kg: { label: t('progress.weight'), unit: 'kg' },
    waist_cm: { label: t('progress.waist'), unit: 'cm' },
  };

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
      <h1 style={{ color: 'var(--oc-gold)' }}>{t('progress.title')}</h1>

      <Card style={{ marginTop: 'var(--oc-space-4)', marginBottom: 'var(--oc-space-4)' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 'var(--oc-space-3)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ width: 100 }}>
            <Field label={t('progress.weightKg')}>
              <Input value={weightKg} onChange={(e) => setWeightKg(e.target.value)} inputMode="decimal" />
            </Field>
          </div>
          <div style={{ width: 100 }}>
            <Field label={t('progress.waistCm')}>
              <Input value={waistCm} onChange={(e) => setWaistCm(e.target.value)} inputMode="decimal" />
            </Field>
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? t('common.saving') : t('progress.logMeasurement')}
          </Button>
        </form>
      </Card>

      {!loading && measurements.length > 0 && (
        <Card style={{ marginBottom: 'var(--oc-space-4)' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--oc-space-2)' }}>
            <div style={{ width: 140 }}>
              <Select value={metric} onChange={(e) => setMetric(e.target.value as Metric)}>
                <option value="weight_kg">{t('progress.weight')}</option>
                <option value="waist_cm">{t('progress.waist')}</option>
              </Select>
            </div>
          </div>
          <ProgressLineChart points={chartPoints} label={metricLabels[metric].label} unit={metricLabels[metric].unit} />
        </Card>
      )}

      {loading ? (
        <p style={{ color: 'var(--oc-text-muted)' }}>{t('common.loading')}</p>
      ) : measurements.length === 0 ? (
        <p style={{ color: 'var(--oc-text-muted)' }}>{t('progress.noMeasurements')}</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--oc-space-2)' }}>
          {measurements.map((m) => (
            <Card key={m.id} style={{ padding: 'var(--oc-space-3) var(--oc-space-4)' }}>
              <strong>{m.measured_at}</strong>
              <span style={{ color: 'var(--oc-text-muted)', fontSize: 13 }}>
                {' '}
                {m.weight_kg ? `· ${m.weight_kg}kg` : ''} {m.waist_cm ? t('progress.waistSuffix', { cm: m.waist_cm }) : ''}
              </span>
            </Card>
          ))}
        </div>
      )}

      {profile && (
        <>
          <h2 style={{ color: 'var(--oc-gold)', marginTop: 'var(--oc-space-6)' }}>{t('progress.photosTitle')}</h2>

          {comparePhotos && (
            <Card style={{ marginBottom: 'var(--oc-space-4)' }}>
              <p style={{ color: 'var(--oc-text-muted)', fontSize: 13, marginTop: 0 }}>{t('progress.dragToCompare')}</p>
              <BeforeAfterSlider before={comparePhotos.before} after={comparePhotos.after} />
            </Card>
          )}

          <PhotoLogUploader
            bucket="progress-photos"
            table="progress_photos"
            studentId={profile.id}
            uploadLabel={t('progress.uploadPhoto')}
            emptyLabel={t('progress.noPhotos')}
            onUploaded={loadComparePhotos}
          />
        </>
      )}
    </AppShell>
  );
}
