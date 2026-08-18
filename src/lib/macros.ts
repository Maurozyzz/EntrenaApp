import type { Food, Macros } from './types';

export function computeMacros(food: Food | null | undefined, quantityG: number): Macros {
  if (!food || !quantityG) return { calories: 0, protein: 0, carbs: 0, fat: 0 };
  const factor = quantityG / 100;
  return {
    calories: food.calories_per_100g * factor,
    protein: food.protein_per_100g * factor,
    carbs: food.carbs_per_100g * factor,
    fat: food.fat_per_100g * factor,
  };
}

export function roundMacro(value: number): number {
  return Math.round(value * 10) / 10;
}
