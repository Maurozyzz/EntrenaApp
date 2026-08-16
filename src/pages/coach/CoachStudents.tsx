import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../lib/AuthContext';
import { AppShell } from '../../components/layout/AppShell';
import { Card } from '../../components/ui/Card';
import type { Profile } from '../../lib/types';

const NAV = [
  { to: '/coach', label: 'Alumnos' },
  { to: '/coach/ejercicios', label: 'Ejercicios' },
];

export function CoachStudents() {
  const { profile } = useAuth();
  const [students, setStudents] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    supabase
      .from('profiles')
      .select('*')
      .eq('trainer_id', profile.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setStudents(data ?? []);
        setLoading(false);
      });
  }, [profile]);

  return (
    <AppShell links={NAV}>
      <h1 style={{ color: 'var(--oc-gold)' }}>Alumnos</h1>
      <p style={{ color: 'var(--oc-text-muted)', fontSize: 13 }}>
        Para sumar un alumno nuevo, pedile que se registre desde la pantalla de login con su propio email — queda
        vinculado a vos automáticamente.
      </p>

      {loading ? (
        <p style={{ color: 'var(--oc-text-muted)' }}>Cargando…</p>
      ) : students.length === 0 ? (
        <p style={{ color: 'var(--oc-text-muted)' }}>Todavía no tenés alumnos registrados.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--oc-space-3)', marginTop: 'var(--oc-space-4)' }}>
          {students.map((student) => (
            <Card key={student.id}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--oc-space-3)' }}>
                <div>
                  <strong>{student.full_name || 'Sin nombre'}</strong>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--oc-text-muted)' }}>{student.email}</p>
                </div>
                <Link to={`/coach/alumnos/${student.id}`} style={{ color: 'var(--oc-gold)', fontSize: 14, whiteSpace: 'nowrap' }}>
                  Ver →
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
