export type ActivitySummary = {
  id: string;
  name: string | null;
  shortDescription: string | null;
  priceAmount: number | null;
  priceCurrency: string | null;
  withinBudget: boolean | null;
};

export function mapActivityRecord(
  raw: Record<string, unknown>,
  budget: number,
): ActivitySummary {
  const id = raw['id'];
  const name = (raw['name'] as string) ?? null;
  const shortDescription = (raw['shortDescription'] as string) ?? null;
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
    priceAmount: priceOk ? amount : null,
    priceCurrency: currency,
    withinBudget: priceOk ? amount <= budget : null,
  };
}
