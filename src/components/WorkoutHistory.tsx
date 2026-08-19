import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useLanguage } from '../lib/i18n';
import { Card } from './ui/Card';
import type { WorkoutLogWithExercise } from '../lib/types';

interface PersonalRecord {
  exerciseName: string;
  weight: number;
  performedAt: string;
}

export function WorkoutHistory({ studentId }: { studentId: string }) {
  const { t, lang } = useLanguage();
  const [logs, setLogs] = useState<WorkoutLogWithExercise[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    supabase
      .from('workout_logs')
      .select('*, routine_exercises(exercises(name))')
      .eq('student_id', studentId)
      .order('performed_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setLogs((data as WorkoutLogWithExercise[]) ?? []);
        setLoading(false);
      });
  }, [studentId]);

  if (loading) return <p style={{ color: 'var(--oc-text-muted)' }}>{t('common.loading')}</p>;
  if (logs.length === 0) return <p style={{ color: 'var(--oc-text-muted)' }}>{t('workoutHistory.noLogs')}</p>;

  const records = new Map<string, PersonalRecord>();
  for (const log of logs) {
    const name = log.routine_exercises?.exercises?.name;
    if (!name || log.weight_used == null) continue;
    const current = records.get(name);
    if (!current || log.weight_used > current.weight) {
      records.set(name, { exerciseName: name, weight: log.weight_used, performedAt: log.performed_at });
    }
  }
  const recordList = [...records.values()].sort((a, b) => b.weight - a.weight);

  const dateLocale = lang === 'en' ? 'en-US' : 'es-AR';

  return (
    <div>
      {recordList.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--oc-space-2)', marginBottom: 'var(--oc-space-4)' }}>
          {recordList.map((record) => (
            <Card key={record.exerciseName} style={{ padding: 'var(--oc-space-3)', flex: '1 1 140px' }}>
              <div style={{ fontSize: 12, color: 'var(--oc-text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {record.exerciseName}
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--oc-energy)' }}>{record.weight}kg</div>
              <div style={{ fontSize: 11, color: 'var(--oc-text-muted)' }}>{t('workoutHistory.bestMark')}</div>
            </Card>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--oc-space-2)' }}>
        {logs.map((log) => (
          <div
            key={log.id}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: 'var(--oc-space-2) var(--oc-space-3)',
              background: 'var(--oc-surface-gradient)',
              boxShadow: 'var(--oc-shadow-raised-sm)',
              borderRadius: 'var(--oc-radius-sm)',
              gap: 'var(--oc-space-3)',
              flexWrap: 'wrap',
              fontSize: 13,
            }}
          >
            <span>
              <strong>{log.routine_exercises?.exercises?.name ?? t('workoutHistory.exerciseFallback')}</strong>
              <span style={{ color: 'var(--oc-text-muted)' }}>
                {' '}
                {t('workoutHistory.setsLine', { sets: log.sets_completed ?? '—' })}{' '}
                {log.weight_used ? t('workoutHistory.weightSuffix', { weight: log.weight_used }) : ''}
              </span>
            </span>
            <span style={{ color: 'var(--oc-text-muted)' }}>{new Date(log.performed_at).toLocaleDateString(dateLocale)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
