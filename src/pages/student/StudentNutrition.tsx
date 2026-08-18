import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../lib/AuthContext';
import { AppShell } from '../../components/layout/AppShell';
import { Card } from '../../components/ui/Card';
import { PhotoLogUploader } from '../../components/PhotoLogUploader';
import { DietBuilder } from '../../components/DietBuilder';
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
      <h1 style={{ color: 'var(--oc-gold)' }}>Mi dieta</h1>

      {loading ? (
        <p style={{ color: 'var(--oc-text-muted)' }}>Cargando…</p>
      ) : !plan ? (
        <p style={{ color: 'var(--oc-text-muted)' }}>Todavía no tenés un plan nutricional asignado.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--oc-space-4)', marginTop: 'var(--oc-space-4)' }}>
          <Card style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: 'var(--oc-text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
              Calorías diarias
            </div>
            <div
              style={{
                fontSize: 48,
                fontWeight: 800,
                color: 'var(--oc-energy)',
                lineHeight: 1.2,
                textShadow: '0 0 24px rgba(183, 255, 55, 0.35)',
              }}
            >
              {plan.calories_target ?? '—'}
            </div>
          </Card>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--oc-space-3)' }}>
            <Macro label="Proteína" value={plan.protein_g} accent="var(--oc-gold)" />
            <Macro label="Carbohidratos" value={plan.carbs_g} accent="var(--oc-energy)" />
            <Macro label="Grasas" value={plan.fat_g} accent="var(--oc-danger)" />
          </div>

          {plan.notes && (
            <Card>
              <strong style={{ color: 'var(--oc-gold)' }}>Notas del entrenador</strong>
              <p style={{ color: 'var(--oc-text-muted)', marginTop: 'var(--oc-space-2)', marginBottom: 0 }}>{plan.notes}</p>
            </Card>
          )}
        </div>
      )}

      {profile && (
        <>
          <h2 style={{ color: 'var(--oc-gold)', marginTop: 'var(--oc-space-6)' }}>Mi dieta detallada</h2>
          <p style={{ color: 'var(--oc-text-muted)', fontSize: 13, marginTop: -8 }}>
            Cargá acá lo que te mandó tu entrenador (ej: 200g de pollo, 200g de arroz) y calculamos los macros al
            instante.
          </p>
          <DietBuilder studentId={profile.id} />

          <h2 style={{ color: 'var(--oc-gold)', marginTop: 'var(--oc-space-6)' }}>Mis comidas</h2>
          <p style={{ color: 'var(--oc-text-muted)', fontSize: 13, marginTop: -8 }}>
            Subí una foto de lo que vas comiendo para que tu entrenador pueda verlo.
          </p>
          <PhotoLogUploader
            bucket="meal-photos"
            table="meal_photos"
            studentId={profile.id}
            uploadLabel="+ Subir foto de una comida"
            emptyLabel="Todavía no subiste fotos de comidas."
          />
        </>
      )}
    </AppShell>
  );
}

function Macro({ label, value, accent }: { label: string; value: number | null; accent: string }) {
  return (
    <Card style={{ padding: 'var(--oc-space-4)', textAlign: 'center' }}>
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: '50%',
          background: `radial-gradient(circle at 35% 30%, ${accent}, color-mix(in srgb, ${accent} 55%, black))`,
          boxShadow: `var(--oc-shadow-raised-sm), inset -2px -3px 5px rgba(0,0,0,0.35), inset 2px 2px 3px rgba(255,255,255,0.35)`,
          margin: '0 auto var(--oc-space-3)',
        }}
      />
      <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--oc-text)' }}>
        {value ?? '—'}
        {value ? 'g' : ''}
      </div>
      <div style={{ fontSize: 13, color: 'var(--oc-text-muted)' }}>{label}</div>
    </Card>
  );
}
