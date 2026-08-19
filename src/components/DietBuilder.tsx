import { lazy, Suspense, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Field, Input, Select } from './ui/Input';
import { computeMacros, roundMacro as round } from '../lib/macros';
import { lookupBarcode } from '../lib/openFoodFacts';
import type { DietEntryWithFood, Food, QuantityUnit } from '../lib/types';

const BarcodeScanner = lazy(() => import('./BarcodeScanner').then((m) => ({ default: m.BarcodeScanner })));

interface MealGroup {
  label: string | null;
  entries: DietEntryWithFood[];
}

function groupByMeal(entries: DietEntryWithFood[]): MealGroup[] {
  const map = new Map<string | null, DietEntryWithFood[]>();
  for (const entry of entries) {
    const key = entry.meal_label;
    if (!map.has(key)) map.set(key, []);
    map.get(key)?.push(entry);
  }
  return [...map.entries()].map(([label, groupEntries]) => ({ label, entries: groupEntries }));
}

export function DietBuilder({ studentId }: { studentId: string }) {
  const [foods, setFoods] = useState<Food[]>([]);
  const [entries, setEntries] = useState<DietEntryWithFood[]>([]);
  const [loading, setLoading] = useState(true);
  const [foodId, setFoodId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [quantityUnit, setQuantityUnit] = useState<QuantityUnit>('g');
  const [mealLabel, setMealLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanBusy, setScanBusy] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [manualBarcode, setManualBarcode] = useState<string | null>(null);
  const [manualName, setManualName] = useState('');
  const [manualCalories, setManualCalories] = useState('');
  const [manualProtein, setManualProtein] = useState('');
  const [manualCarbs, setManualCarbs] = useState('');
  const [manualFat, setManualFat] = useState('');
  const [manualSaving, setManualSaving] = useState(false);

  async function load() {
    setLoading(true);
    const [{ data: foodsData }, { data: entriesData }] = await Promise.all([
      supabase.from('foods').select('*').order('name', { ascending: true }),
      supabase
        .from('diet_entries')
        .select('*, foods(*)')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false }),
    ]);
    setFoods(foodsData ?? []);
    setEntries((entriesData as DietEntryWithFood[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  const selectedFood = foods.find((f) => f.id === Number(foodId)) ?? null;
  const preview = computeMacros(selectedFood, Number(quantity) || 0);

  function sumMacros(list: DietEntryWithFood[]) {
    return list.reduce(
      (acc, entry) => {
        const m = computeMacros(entry.foods, entry.quantity_g);
        return {
          calories: acc.calories + m.calories,
          protein: acc.protein + m.protein,
          carbs: acc.carbs + m.carbs,
          fat: acc.fat + m.fat,
        };
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
    );
  }

  const totals = sumMacros(entries);
  const mealGroups = groupByMeal(entries);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!foodId || !quantity) return;
    setSaving(true);
    await supabase.from('diet_entries').insert({
      student_id: studentId,
      food_id: Number(foodId),
      quantity_g: Number(quantity),
      quantity_unit: quantityUnit,
      meal_label: mealLabel || null,
    });
    setFoodId('');
    setQuantity('');
    setSaving(false);
    load();
  }

  async function handleRemove(id: number) {
    await supabase.from('diet_entries').delete().eq('id', id);
    load();
  }

  async function handleBarcodeDetected(barcode: string) {
    setScanning(false);
    setScanBusy(true);
    setScanError(null);

    const { data: existing } = await supabase.from('foods').select('*').eq('barcode', barcode).maybeSingle();
    if (existing) {
      setFoods((prev) => (prev.some((f) => f.id === existing.id) ? prev : [...prev, existing]));
      setFoodId(String(existing.id));
      setScanBusy(false);
      return;
    }

    const product = await lookupBarcode(barcode);
    if (!product) {
      setManualBarcode(barcode);
      setScanBusy(false);
      return;
    }

    const { data: inserted, error: insertErr } = await supabase
      .from('foods')
      .insert({
        name: product.name,
        calories_per_100g: product.caloriesPer100,
        protein_per_100g: product.proteinPer100,
        carbs_per_100g: product.carbsPer100,
        fat_per_100g: product.fatPer100,
        barcode,
      })
      .select()
      .single();

    if (insertErr || !inserted) {
      // otro usuario pudo haber escaneado el mismo código justo antes
      const { data: retryExisting } = await supabase.from('foods').select('*').eq('barcode', barcode).maybeSingle();
      if (retryExisting) {
        setFoods((prev) => (prev.some((f) => f.id === retryExisting.id) ? prev : [...prev, retryExisting]));
        setFoodId(String(retryExisting.id));
      } else {
        setScanError(insertErr?.message ?? 'No se pudo guardar el producto escaneado.');
      }
      setScanBusy(false);
      return;
    }

    setFoods((prev) => [...prev, inserted].sort((a, b) => a.name.localeCompare(b.name)));
    setFoodId(String(inserted.id));
    setScanBusy(false);
  }

  function cancelManualEntry() {
    setManualBarcode(null);
    setManualName('');
    setManualCalories('');
    setManualProtein('');
    setManualCarbs('');
    setManualFat('');
  }

  async function handleManualFoodSubmit(e: FormEvent) {
    e.preventDefault();
    if (!manualBarcode || !manualName || !manualCalories) return;
    setManualSaving(true);
    setScanError(null);

    const { data: inserted, error: insertErr } = await supabase
      .from('foods')
      .insert({
        name: manualName,
        calories_per_100g: Number(manualCalories),
        protein_per_100g: Number(manualProtein) || 0,
        carbs_per_100g: Number(manualCarbs) || 0,
        fat_per_100g: Number(manualFat) || 0,
        barcode: manualBarcode,
      })
      .select()
      .single();

    if (insertErr || !inserted) {
      // otro usuario pudo haber cargado el mismo código justo antes
      const { data: retryExisting } = await supabase.from('foods').select('*').eq('barcode', manualBarcode).maybeSingle();
      if (retryExisting) {
        setFoods((prev) => (prev.some((f) => f.id === retryExisting.id) ? prev : [...prev, retryExisting]));
        setFoodId(String(retryExisting.id));
        cancelManualEntry();
      } else {
        setScanError(insertErr?.message ?? 'No se pudo guardar el producto.');
      }
      setManualSaving(false);
      return;
    }

    setFoods((prev) => [...prev, inserted].sort((a, b) => a.name.localeCompare(b.name)));
    setFoodId(String(inserted.id));
    setManualSaving(false);
    cancelManualEntry();
  }

  return (
    <div>
      {entries.length > 0 && (
        <Card style={{ marginBottom: 'var(--oc-space-4)' }}>
          <div style={{ fontSize: 13, color: 'var(--oc-text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 'var(--oc-space-3)' }}>
            Total cargado
          </div>
          <div style={{ display: 'flex', gap: 'var(--oc-space-5)', flexWrap: 'wrap' }}>
            <TotalStat label="Calorías" value={round(totals.calories)} />
            <TotalStat label="Proteína" value={round(totals.protein)} unit="g" />
            <TotalStat label="Carbohidratos" value={round(totals.carbs)} unit="g" />
            <TotalStat label="Grasas" value={round(totals.fat)} unit="g" />
          </div>
        </Card>
      )}

      <Card style={{ marginBottom: 'var(--oc-space-4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--oc-space-3)', flexWrap: 'wrap', gap: 'var(--oc-space-2)' }}>
          <span style={{ fontSize: 13, color: 'var(--oc-text-muted)' }}>
            ¿No está en la lista? Escaneá el código de barras del producto.
          </span>
          <Button type="button" variant="secondary" onClick={() => setScanning(true)} disabled={scanBusy}>
            {scanBusy ? 'Buscando…' : '📷 Escanear código de barras'}
          </Button>
        </div>
        {scanError && <p style={{ color: 'var(--oc-danger)', fontSize: 13, marginBottom: 'var(--oc-space-2)' }}>{scanError}</p>}

        {manualBarcode && (
          <form
            onSubmit={handleManualFoodSubmit}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--oc-space-3)',
              padding: 'var(--oc-space-3)',
              marginBottom: 'var(--oc-space-3)',
              background: 'var(--oc-surface-gradient)',
              boxShadow: 'var(--oc-shadow-inset)',
              borderRadius: 'var(--oc-radius-sm)',
            }}
          >
            <p style={{ margin: 0, fontSize: 13, color: 'var(--oc-text-muted)' }}>
              No encontramos ese producto (código {manualBarcode}). Cargalo con los datos de la etiqueta y lo vamos
              a reconocer solo la próxima vez que se escanee este mismo código.
            </p>
            <div style={{ display: 'flex', gap: 'var(--oc-space-3)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: '1 1 200px' }}>
                <Field label="Nombre del producto">
                  <Input value={manualName} onChange={(e) => setManualName(e.target.value)} required />
                </Field>
              </div>
              <div style={{ width: 100 }}>
                <Field label="Kcal /100g">
                  <Input value={manualCalories} onChange={(e) => setManualCalories(e.target.value)} inputMode="decimal" required />
                </Field>
              </div>
              <div style={{ width: 100 }}>
                <Field label="Proteína /100g">
                  <Input value={manualProtein} onChange={(e) => setManualProtein(e.target.value)} inputMode="decimal" />
                </Field>
              </div>
              <div style={{ width: 100 }}>
                <Field label="Carbos /100g">
                  <Input value={manualCarbs} onChange={(e) => setManualCarbs(e.target.value)} inputMode="decimal" />
                </Field>
              </div>
              <div style={{ width: 100 }}>
                <Field label="Grasas /100g">
                  <Input value={manualFat} onChange={(e) => setManualFat(e.target.value)} inputMode="decimal" />
                </Field>
              </div>
              <Button type="submit" disabled={manualSaving}>
                {manualSaving ? 'Guardando…' : 'Guardar producto'}
              </Button>
              <Button type="button" variant="ghost" onClick={cancelManualEntry} disabled={manualSaving}>
                Cancelar
              </Button>
            </div>
          </form>
        )}

        <form onSubmit={handleAdd} style={{ display: 'flex', gap: 'var(--oc-space-3)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 200px' }}>
            <Field label="Alimento">
              <Select value={foodId} onChange={(e) => setFoodId(e.target.value)} required>
                <option value="">Elegir…</option>
                {foods.map((food) => (
                  <option key={food.id} value={food.id}>
                    {food.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div style={{ width: 90 }}>
            <Field label="Cantidad">
              <Input value={quantity} onChange={(e) => setQuantity(e.target.value)} inputMode="decimal" required />
            </Field>
          </div>
          <div style={{ width: 80 }}>
            <Field label="Unidad">
              <Select value={quantityUnit} onChange={(e) => setQuantityUnit(e.target.value as QuantityUnit)}>
                <option value="g">g</option>
                <option value="ml">ml</option>
              </Select>
            </Field>
          </div>
          <div style={{ width: 150 }}>
            <Field label="Comida">
              <Input
                value={mealLabel}
                onChange={(e) => setMealLabel(e.target.value)}
                placeholder="Desayuno, Comida 1…"
              />
            </Field>
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? 'Agregando…' : 'Agregar'}
          </Button>
        </form>
        <p style={{ color: 'var(--oc-text-muted)', fontSize: 12, marginTop: 'var(--oc-space-2)', marginBottom: 0 }}>
          Usá el mismo nombre de "Comida" para juntar varios alimentos en un mismo renglón (ej: "Comida 1" para
          pollo + arroz + palta).
        </p>

        {selectedFood && Number(quantity) > 0 && (
          <p style={{ color: 'var(--oc-energy)', fontSize: 13, marginTop: 'var(--oc-space-3)', marginBottom: 0 }}>
            {round(preview.calories)} kcal · {round(preview.protein)}g prot · {round(preview.carbs)}g carb ·{' '}
            {round(preview.fat)}g grasa
          </p>
        )}
      </Card>

      {loading ? (
        <p style={{ color: 'var(--oc-text-muted)' }}>Cargando…</p>
      ) : mealGroups.length === 0 ? (
        <p style={{ color: 'var(--oc-text-muted)' }}>Todavía no cargaste tu dieta.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--oc-space-3)' }}>
          {mealGroups.map((group) => {
            const groupTotals = sumMacros(group.entries);
            return (
              <div
                key={group.label ?? '__none__'}
                style={{
                  padding: 'var(--oc-space-3)',
                  background: 'var(--oc-surface-gradient)',
                  boxShadow: 'var(--oc-shadow-raised-sm)',
                  borderRadius: 'var(--oc-radius-sm)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 'var(--oc-space-2)' }}>
                  <strong style={{ fontSize: 13, color: 'var(--oc-gold)' }}>{group.label ?? 'Sin comida asignada'}</strong>
                  <span style={{ fontSize: 12, color: 'var(--oc-text-muted)' }}>{round(groupTotals.calories)} kcal</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 'var(--oc-space-2)' }}>
                  {group.entries.map((entry) => {
                    const macros = computeMacros(entry.foods, entry.quantity_g);
                    return (
                      <div key={entry.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--oc-space-2)', fontSize: 13 }}>
                        <span>
                          <strong>{entry.foods?.name ?? 'Alimento'}</strong>
                          <span style={{ color: 'var(--oc-text-muted)' }}>
                            {' '}
                            · {entry.quantity_g}
                            {entry.quantity_unit} · {round(macros.calories)} kcal
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemove(entry.id)}
                          style={{ background: 'none', border: 'none', color: 'var(--oc-danger)', cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap' }}
                        >
                          Quitar
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {scanning && (
        <Suspense
          fallback={
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(9,13,16,0.9)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--oc-text-muted)' }}>
              Cargando cámara…
            </div>
          }
        >
          <BarcodeScanner onDetected={handleBarcodeDetected} onClose={() => setScanning(false)} />
        </Suspense>
      )}
    </div>
  );
}

function TotalStat({ label, value, unit }: { label: string; value: number; unit?: string }) {
  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--oc-text)' }}>
        {value}
        {unit ?? ''}
      </div>
      <div style={{ fontSize: 12, color: 'var(--oc-text-muted)' }}>{label}</div>
    </div>
  );
}
