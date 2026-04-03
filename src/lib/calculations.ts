export interface Constants {
  currencyRate: number;
  shippingRate: number;
  customsRate: number;
  profitMargin: number;
  taxRate: number;
}

export interface ProductInput {
  itemModel: string;
  priceUsd: number;
  quantity: number;
  shippingOverride?: number | null;
  customsOverride?: number | null;
}

export interface CalculatedRow extends ProductInput {
  // Per-unit values
  jodPrice: number;
  shipping: number;
  customs: number;
  shippingIsOverridden: boolean;
  customsIsOverridden: boolean;
  landedCost: number;
  profit: number;
  preTaxPrice: number;
  tax: number;
  finalPrice: number;
  // Totals (per-unit × quantity)
  jodPriceTotal: number;
  shippingTotal: number;
  customsTotal: number;
  landedCostTotal: number;
  profitTotal: number;
  preTaxPriceTotal: number;
  taxTotal: number;
  finalPriceTotal: number;
}

export interface TotalsRow {
  jodPriceTotal: number;
  shippingTotal: number;
  customsTotal: number;
  landedCostTotal: number;
  profitTotal: number;
  preTaxPriceTotal: number;
  taxTotal: number;
  finalPriceTotal: number;
}

export function calculateRow(
  input: ProductInput,
  constants: Constants
): CalculatedRow {
  const { priceUsd, quantity } = input;
  const { currencyRate, shippingRate, customsRate, profitMargin, taxRate } =
    constants;

  const { shippingOverride, customsOverride } = input;
  const jodPrice = priceUsd * currencyRate;
  const shippingIsOverridden = shippingOverride != null;
  const customsIsOverridden = customsOverride != null;
  const shipping = shippingIsOverridden ? shippingOverride! : jodPrice * shippingRate;
  const customs = customsIsOverridden ? customsOverride! : jodPrice * customsRate;
  const landedCost = jodPrice + shipping + customs;
  const profit = landedCost * profitMargin;
  const preTaxPrice = landedCost + profit;
  const tax = preTaxPrice * taxRate;
  const finalPrice = preTaxPrice + tax;

  return {
    ...input,
    jodPrice,
    shipping,
    customs,
    shippingIsOverridden,
    customsIsOverridden,
    landedCost,
    profit,
    preTaxPrice,
    tax,
    finalPrice,
    jodPriceTotal: jodPrice * quantity,
    shippingTotal: shipping * quantity,
    customsTotal: customs * quantity,
    landedCostTotal: landedCost * quantity,
    profitTotal: profit * quantity,
    preTaxPriceTotal: preTaxPrice * quantity,
    taxTotal: tax * quantity,
    finalPriceTotal: finalPrice * quantity,
  };
}

export function calculateTotals(rows: CalculatedRow[]): TotalsRow {
  return rows.reduce(
    (acc, row) => ({
      jodPriceTotal: acc.jodPriceTotal + row.jodPriceTotal,
      shippingTotal: acc.shippingTotal + row.shippingTotal,
      customsTotal: acc.customsTotal + row.customsTotal,
      landedCostTotal: acc.landedCostTotal + row.landedCostTotal,
      profitTotal: acc.profitTotal + row.profitTotal,
      preTaxPriceTotal: acc.preTaxPriceTotal + row.preTaxPriceTotal,
      taxTotal: acc.taxTotal + row.taxTotal,
      finalPriceTotal: acc.finalPriceTotal + row.finalPriceTotal,
    }),
    {
      jodPriceTotal: 0,
      shippingTotal: 0,
      customsTotal: 0,
      landedCostTotal: 0,
      profitTotal: 0,
      preTaxPriceTotal: 0,
      taxTotal: 0,
      finalPriceTotal: 0,
    }
  );
}

export const DEFAULT_CONSTANTS: Constants = {
  currencyRate: 0.71,
  shippingRate: 0.15,
  customsRate: 0.12,
  profitMargin: 0.25,
  taxRate: 0.16,
};

export function fmt(value: number, decimals = 3): string {
  return value.toFixed(decimals);
}
