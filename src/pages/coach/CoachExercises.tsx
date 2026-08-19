import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../lib/AuthContext';
import { useLanguage } from '../../lib/i18n';
import { AppShell } from '../../components/layout/AppShell';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/Input';
import { youtubeSearchUrl } from '../../lib/youtube';
import { translateExerciseName, translateMuscleGroup } from '../../lib/catalogTranslations';
import { COACH_NAV } from './nav';
import type { Exercise } from '../../lib/types';
import '../student/StudentRoutine.css';

export function CoachExercises() {
  const { profile } = useAuth();
  const { t, lang } = useLanguage();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [muscleGroup, setMuscleGroup] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);

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
      setError(insertErr.code === '23505' ? t('coachExercises.duplicateName') : insertErr.message);
    } else {
      setName('');
      setMuscleGroup('');
    }
    setSaving(false);
    loadExercises();
  }

  const filteredExercises = exercises
    .filter((exercise) => {
      const query = search.trim().toLowerCase();
      if (!query) return true;
      const name = translateExerciseName(exercise.name, lang).toLowerCase();
      const muscleGroup = translateMuscleGroup(exercise.muscle_group ?? '', lang).toLowerCase();
      return name.includes(query) || muscleGroup.includes(query);
    })
    .sort((a, b) => translateExerciseName(a.name, lang).localeCompare(translateExerciseName(b.name, lang)));

  return (
    <AppShell links={COACH_NAV}>
      <h1 style={{ color: 'var(--oc-gold)' }}>{t('coachExercises.title')}</h1>
      <p style={{ color: 'var(--oc-text-muted)', fontSize: 13 }}>{t('coachExercises.intro')}</p>

      <Card style={{ marginBottom: 'var(--oc-space-5)' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 'var(--oc-space-3)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 200px' }}>
            <Field label={t('coachExercises.name')}>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </Field>
          </div>
          <div style={{ flex: '1 1 160px' }}>
            <Field label={t('coachExercises.muscleGroup')}>
              <Input
                value={muscleGroup}
                onChange={(e) => setMuscleGroup(e.target.value)}
                placeholder={t('coachExercises.muscleGroupPlaceholder')}
              />
            </Field>
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? t('common.saving') : t('common.add')}
          </Button>
        </form>
        {error && <p style={{ color: 'var(--oc-danger)', fontSize: 13, marginTop: 'var(--oc-space-2)' }}>{error}</p>}
      </Card>

      {!loading && exercises.length > 0 && (
        <div style={{ marginBottom: 'var(--oc-space-4)' }}>
          <Field label={t('coachExercises.search')}>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('coachExercises.searchPlaceholder')}
            />
          </Field>
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--oc-text-muted)' }}>{t('common.loading')}</p>
      ) : exercises.length === 0 ? (
        <p style={{ color: 'var(--oc-text-muted)' }}>{t('coachExercises.noExercises')}</p>
      ) : filteredExercises.length === 0 ? (
        <p style={{ color: 'var(--oc-text-muted)' }}>{t('coachExercises.noMatch', { search })}</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--oc-space-2)' }}>
          {filteredExercises.map((exercise) => (
            <Card key={exercise.id} style={{ padding: 'var(--oc-space-3) var(--oc-space-4)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--oc-space-2)' }}>
                <span
                  onClick={() => setSelectedId(selectedId === exercise.id ? null : exercise.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <strong>{translateExerciseName(exercise.name, lang)}</strong>
                  {exercise.muscle_group && (
                    <span style={{ color: 'var(--oc-text-muted)', fontSize: 13 }}>
                      {' '}
                      · {translateMuscleGroup(exercise.muscle_group, lang)}
                    </span>
                  )}
                </span>
                {selectedId === exercise.id && (
                  <a
                    href={youtubeSearchUrl(translateExerciseName(exercise.name, lang), lang)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--oc-gold)', fontSize: 13 }}
                  >
                    {t('coachExercises.viewVideo')}
                  </a>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
