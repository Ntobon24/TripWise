export type ActivitySummary = {
  id: string;
  name: string | null;
  shortDescription: string | null;
  category: string | null;
  popularity: number | null;
  priceAmount: number | null;
  priceCurrency: string | null;
  estimatedPrice: boolean;
  withinBudget: boolean | null;
};

export function mapActivityRecord(
  raw: Record<string, unknown>,
  budget: number,
): ActivitySummary {
  const id = raw['id'];
  const name = (raw['name'] as string) ?? null;
  const shortDescription = (raw['shortDescription'] as string) ?? null;
  const category = (raw['category'] as string) ?? null;
  const popularityRaw = raw['popularity'];
  const popularity =
    typeof popularityRaw === 'number'
      ? popularityRaw
      : typeof popularityRaw === 'string'
        ? parseFloat(popularityRaw)
        : null;
  const price = raw['price'] as Record<string, unknown> | undefined;
  const amountRaw = price?.['amount'];
  const amount =
    typeof amountRaw === 'number'
      ? amountRaw
      : typeof amountRaw === 'string'
        ? parseFloat(amountRaw)
        : null;
  const currency = (price?.['currencyCode'] as string) ?? (price?.['currency'] as string) ?? null;
  const priceOk = amount != null && !Number.isNaN(amount);

  return {
    id: typeof id === 'string' ? id : String(id),
    name,
    shortDescription: shortDescription?.slice(0, 280) ?? null,
    category,
    popularity: popularity != null && !Number.isNaN(popularity) ? popularity : null,
    priceAmount: priceOk ? amount : null,
    priceCurrency: currency,
    estimatedPrice: false,
    withinBudget: priceOk ? amount <= budget : null,
  };
}
