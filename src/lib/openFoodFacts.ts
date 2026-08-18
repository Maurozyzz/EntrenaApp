export interface ScannedProduct {
  name: string;
  caloriesPer100: number;
  proteinPer100: number;
  carbsPer100: number;
  fatPer100: number;
}

interface OpenFoodFactsResponse {
  status: number;
  product?: {
    product_name?: string;
    generic_name?: string;
    nutriments?: {
      'energy-kcal_100g'?: number;
      energy_100g?: number;
      proteins_100g?: number;
      carbohydrates_100g?: number;
      fat_100g?: number;
    };
  };
}

/** Busca un producto por código de barras en Open Food Facts (base abierta, sin costo ni API key). */
export async function lookupBarcode(barcode: string): Promise<ScannedProduct | null> {
  const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`);
  if (!res.ok) return null;

  const data = (await res.json()) as OpenFoodFactsResponse;
  if (data.status !== 1 || !data.product) return null;

  const n = data.product.nutriments ?? {};
  const calories = n['energy-kcal_100g'] ?? (n.energy_100g != null ? n.energy_100g / 4.184 : null);
  if (calories == null) return null;

  return {
    name: data.product.product_name || data.product.generic_name || 'Producto escaneado',
    caloriesPer100: Math.round(calories),
    proteinPer100: n.proteins_100g ?? 0,
    carbsPer100: n.carbohydrates_100g ?? 0,
    fatPer100: n.fat_100g ?? 0,
  };
}
