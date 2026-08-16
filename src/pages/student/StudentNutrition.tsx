import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../lib/AuthContext';
import { AppShell } from '../../components/layout/AppShell';
import { Card } from '../../components/ui/Card';
import { STUDENT_NAV } from './nav';
import type { NutritionPlan } from '../../lib/types';

export function StudentNutrition() {
  const { profile } = useAuth();
  const [plan, setPlan] = useState<NutritionPlan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    supabase
      .from('nutrition_plans')
      .select('*')
      .eq('student_id', profile.id)
      .eq('active', true)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        setPlan(data ?? null);
        setLoading(false);
      });
  }, [profile]);

  return (
    <AppShell links={STUDENT_NAV}>
      <h1 style={{ color: 'var(--oc-gold)' }}>Mi nutrición</h1>

      {loading ? (
        <p style={{ color: 'var(--oc-text-muted)' }}>Cargando…</p>
      ) : !plan ? (
        <p style={{ color: 'var(--oc-text-muted)' }}>Todavía no tenés un plan nutricional asignado.</p>
      ) : (
        <Card style={{ marginTop: 'var(--oc-space-4)' }}>
          <div style={{ display: 'flex', gap: 'var(--oc-space-5)', flexWrap: 'wrap' }}>
            <Metric label="Calorías" value={plan.calories_target} />
            <Metric label="Proteína" value={plan.protein_g} unit="g" />
            <Metric label="Carbohidratos" value={plan.carbs_g} unit="g" />
            <Metric label="Grasas" value={plan.fat_g} unit="g" />
          </div>
          {plan.notes && <p style={{ color: 'var(--oc-text-muted)', marginTop: 'var(--oc-space-4)' }}>{plan.notes}</p>}
        </Card>
      )}
    </AppShell>
  );
}

function Metric({ label, value, unit }: { label: string; value: number | null; unit?: string }) {
  return (
    <div>
      <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--oc-energy)' }}>
        {value ?? '—'}
        {value && unit ? unit : ''}
      </div>
      <div style={{ fontSize: 13, color: 'var(--oc-text-muted)' }}>{label}</div>
    </div>
  );
}
