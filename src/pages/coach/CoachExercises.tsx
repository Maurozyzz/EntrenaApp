import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../lib/AuthContext';
import { AppShell } from '../../components/layout/AppShell';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/Input';
import type { Exercise } from '../../lib/types';

const NAV = [
  { to: '/coach', label: 'Alumnos' },
  { to: '/coach/ejercicios', label: 'Ejercicios' },
];

export function CoachExercises() {
  const { profile } = useAuth();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [muscleGroup, setMuscleGroup] = useState('');
  const [saving, setSaving] = useState(false);

  async function loadExercises() {
    const { data } = await supabase.from('exercises').select('*').order('name', { ascending: true });
    setExercises(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadExercises();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    await supabase.from('exercises').insert({
      name,
      muscle_group: muscleGroup || null,
      created_by: profile.id,
    });
    setName('');
    setMuscleGroup('');
    setSaving(false);
    loadExercises();
  }

  return (
    <AppShell links={NAV}>
      <h1 style={{ color: 'var(--oc-gold)' }}>Ejercicios</h1>

      <Card style={{ marginBottom: 'var(--oc-space-5)' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 'var(--oc-space-3)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 200px' }}>
            <Field label="Nombre">
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </Field>
          </div>
          <div style={{ flex: '1 1 160px' }}>
            <Field label="Grupo muscular">
              <Input value={muscleGroup} onChange={(e) => setMuscleGroup(e.target.value)} placeholder="Pecho, espalda…" />
            </Field>
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? 'Guardando…' : 'Agregar'}
          </Button>
        </form>
      </Card>

      {loading ? (
        <p style={{ color: 'var(--oc-text-muted)' }}>Cargando…</p>
      ) : exercises.length === 0 ? (
        <p style={{ color: 'var(--oc-text-muted)' }}>Todavía no cargaste ejercicios.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--oc-space-2)' }}>
          {exercises.map((exercise) => (
            <Card key={exercise.id} style={{ padding: 'var(--oc-space-3) var(--oc-space-4)' }}>
              <strong>{exercise.name}</strong>
              {exercise.muscle_group && (
                <span style={{ color: 'var(--oc-text-muted)', fontSize: 13 }}> · {exercise.muscle_group}</span>
              )}
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
