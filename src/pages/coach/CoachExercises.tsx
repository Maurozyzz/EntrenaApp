import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../lib/AuthContext';
import { AppShell } from '../../components/layout/AppShell';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/Input';
import { youtubeSearchUrl } from '../../lib/youtube';
import type { Exercise } from '../../lib/types';
import '../student/StudentRoutine.css';

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
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

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
    setError(null);
    setSaving(true);
    const { error: insertErr } = await supabase.from('exercises').insert({
      name,
      muscle_group: muscleGroup || null,
      created_by: profile.id,
    });
    if (insertErr) {
      setError(insertErr.code === '23505' ? 'Ya existe un ejercicio con ese nombre.' : insertErr.message);
    } else {
      setName('');
      setMuscleGroup('');
    }
    setSaving(false);
    loadExercises();
  }

  const filteredExercises = exercises.filter((exercise) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return (
      exercise.name.toLowerCase().includes(query) || (exercise.muscle_group ?? '').toLowerCase().includes(query)
    );
  });

  return (
    <AppShell links={NAV}>
      <h1 style={{ color: 'var(--oc-gold)' }}>Ejercicios</h1>
      <p style={{ color: 'var(--oc-text-muted)', fontSize: 13 }}>
        Ya viene precargado con un catálogo amplio de ejercicios comunes — sumá acá los que te falten.
      </p>

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
        {error && <p style={{ color: 'var(--oc-danger)', fontSize: 13, marginTop: 'var(--oc-space-2)' }}>{error}</p>}
      </Card>

      {!loading && exercises.length > 0 && (
        <div style={{ marginBottom: 'var(--oc-space-4)' }}>
          <Field label="Buscar">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nombre o grupo muscular…"
            />
          </Field>
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--oc-text-muted)' }}>Cargando…</p>
      ) : exercises.length === 0 ? (
        <p style={{ color: 'var(--oc-text-muted)' }}>Todavía no cargaste ejercicios.</p>
      ) : filteredExercises.length === 0 ? (
        <p style={{ color: 'var(--oc-text-muted)' }}>Ningún ejercicio coincide con "{search}".</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--oc-space-2)' }}>
          {filteredExercises.map((exercise) => (
            <Card key={exercise.id} style={{ padding: 'var(--oc-space-3) var(--oc-space-4)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--oc-space-2)' }}>
                <span>
                  <strong>{exercise.name}</strong>
                  {exercise.muscle_group && (
                    <span style={{ color: 'var(--oc-text-muted)', fontSize: 13 }}> · {exercise.muscle_group}</span>
                  )}
                </span>
                <a
                  href={youtubeSearchUrl(exercise.name)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--oc-gold)', fontSize: 13 }}
                >
                  ▶ Ver video
                </a>
              </div>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
