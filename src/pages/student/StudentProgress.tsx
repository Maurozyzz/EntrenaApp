import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../lib/AuthContext';
import { AppShell } from '../../components/layout/AppShell';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/Input';
import { STUDENT_NAV } from './nav';
import type { BodyMeasurement } from '../../lib/types';

export function StudentProgress() {
  const { profile } = useAuth();
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [weightKg, setWeightKg] = useState('');
  const [waistCm, setWaistCm] = useState('');
  const [saving, setSaving] = useState(false);

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

  useEffect(() => {
    load();
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
    </AppShell>
  );
}
