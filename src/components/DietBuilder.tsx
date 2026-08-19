import { lazy, Suspense, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useLanguage } from '../lib/i18n';
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
  const { t } = useLanguage();
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
        setScanError(insertErr?.message ?? t('dietBuilder.scanSaveFailed'));
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
        setScanError(insertErr?.message ?? t('dietBuilder.manualSaveFailed'));
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
            {t('dietBuilder.total')}
          </div>
          <div style={{ display: 'flex', gap: 'var(--oc-space-5)', flexWrap: 'wrap' }}>
            <TotalStat label={t('dietBuilder.calories')} value={round(totals.calories)} />
            <TotalStat label={t('dietBuilder.protein')} value={round(totals.protein)} unit="g" />
            <TotalStat label={t('dietBuilder.carbs')} value={round(totals.carbs)} unit="g" />
            <TotalStat label={t('dietBuilder.fat')} value={round(totals.fat)} unit="g" />
          </div>
        </Card>
      )}

      <Card style={{ marginBottom: 'var(--oc-space-4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--oc-space-3)', flexWrap: 'wrap', gap: 'var(--oc-space-2)' }}>
          <span style={{ fontSize: 13, color: 'var(--oc-text-muted)' }}>{t('dietBuilder.notInList')}</span>
          <Button type="button" variant="secondary" onClick={() => setScanning(true)} disabled={scanBusy}>
            {scanBusy ? t('dietBuilder.searching') : t('dietBuilder.scanButton')}
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
              {t('dietBuilder.notFound', { barcode: manualBarcode })}
            </p>
            <div style={{ display: 'flex', gap: 'var(--oc-space-3)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: '1 1 200px' }}>
                <Field label={t('dietBuilder.productName')}>
                  <Input value={manualName} onChange={(e) => setManualName(e.target.value)} required />
                </Field>
              </div>
              <div style={{ width: 100 }}>
                <Field label={t('dietBuilder.kcalPer100')}>
                  <Input value={manualCalories} onChange={(e) => setManualCalories(e.target.value)} inputMode="decimal" required />
                </Field>
              </div>
              <div style={{ width: 100 }}>
                <Field label={t('dietBuilder.proteinPer100')}>
                  <Input value={manualProtein} onChange={(e) => setManualProtein(e.target.value)} inputMode="decimal" />
                </Field>
              </div>
              <div style={{ width: 100 }}>
                <Field label={t('dietBuilder.carbsPer100')}>
                  <Input value={manualCarbs} onChange={(e) => setManualCarbs(e.target.value)} inputMode="decimal" />
                </Field>
              </div>
              <div style={{ width: 100 }}>
                <Field label={t('dietBuilder.fatPer100')}>
                  <Input value={manualFat} onChange={(e) => setManualFat(e.target.value)} inputMode="decimal" />
                </Field>
              </div>
              <Button type="submit" disabled={manualSaving}>
                {manualSaving ? t('common.saving') : t('dietBuilder.saveProduct')}
              </Button>
              <Button type="button" variant="ghost" onClick={cancelManualEntry} disabled={manualSaving}>
                {t('common.cancel')}
              </Button>
            </div>
          </form>
        )}

        <form onSubmit={handleAdd} style={{ display: 'flex', gap: 'var(--oc-space-3)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 200px' }}>
            <Field label={t('dietBuilder.food')}>
              <Select value={foodId} onChange={(e) => setFoodId(e.target.value)} required>
                <option value="">{t('dietBuilder.choose')}</option>
                {foods.map((food) => (
                  <option key={food.id} value={food.id}>
                    {food.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div style={{ width: 90 }}>
            <Field label={t('dietBuilder.quantity')}>
              <Input value={quantity} onChange={(e) => setQuantity(e.target.value)} inputMode="decimal" required />
            </Field>
          </div>
          <div style={{ width: 80 }}>
            <Field label={t('dietBuilder.unit')}>
              <Select value={quantityUnit} onChange={(e) => setQuantityUnit(e.target.value as QuantityUnit)}>
                <option value="g">g</option>
                <option value="ml">ml</option>
              </Select>
            </Field>
          </div>
          <div style={{ width: 150 }}>
            <Field label={t('dietBuilder.meal')}>
              <Input
                value={mealLabel}
                onChange={(e) => setMealLabel(e.target.value)}
                placeholder={t('dietBuilder.mealPlaceholder')}
              />
            </Field>
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? t('common.saving') : t('common.add')}
          </Button>
        </form>
        <p style={{ color: 'var(--oc-text-muted)', fontSize: 12, marginTop: 'var(--oc-space-2)', marginBottom: 0 }}>
          {t('dietBuilder.mealHint')}
        </p>

        {selectedFood && Number(quantity) > 0 && (
          <p style={{ color: 'var(--oc-energy)', fontSize: 13, marginTop: 'var(--oc-space-3)', marginBottom: 0 }}>
            {t('dietBuilder.previewLine', {
              kcal: round(preview.calories),
              protein: round(preview.protein),
              carbs: round(preview.carbs),
              fat: round(preview.fat),
            })}
          </p>
        )}
      </Card>

      {loading ? (
        <p style={{ color: 'var(--oc-text-muted)' }}>{t('common.loading')}</p>
      ) : mealGroups.length === 0 ? (
        <p style={{ color: 'var(--oc-text-muted)' }}>{t('dietBuilder.noDiet')}</p>
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
                  <strong style={{ fontSize: 13, color: 'var(--oc-gold)' }}>{group.label ?? t('dietBuilder.noMealAssigned')}</strong>
                  <span style={{ fontSize: 12, color: 'var(--oc-text-muted)' }}>{round(groupTotals.calories)} kcal</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 'var(--oc-space-2)' }}>
                  {group.entries.map((entry) => {
                    const macros = computeMacros(entry.foods, entry.quantity_g);
                    return (
                      <div key={entry.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--oc-space-2)', fontSize: 13 }}>
                        <span>
                          <strong>{entry.foods?.name ?? t('dietBuilder.foodFallback')}</strong>
                          <span style={{ color: 'var(--oc-text-muted)' }}>
                            {' '}
                            {t('dietBuilder.entryLine', {
                              qty: entry.quantity_g,
                              unit: entry.quantity_unit,
                              kcal: round(macros.calories),
                            })}
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemove(entry.id)}
                          style={{ background: 'none', border: 'none', color: 'var(--oc-danger)', cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap' }}
                        >
                          {t('dietBuilder.remove')}
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
              {t('dietBuilder.loadingCamera')}
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
