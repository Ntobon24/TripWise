/** Formato unificado para listados de ciudades (GeoDB). */

export type UnifiedCity = {
  source: 'geodb';
  code: string | null;
  name: string;
  countryCode: string | null;
  latitude: number | null;
  longitude: number | null;
  subtitle?: string;
};

export function mapGeodbCity(raw: unknown): UnifiedCity | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const r = raw as Record<string, unknown>;
  const name = (r['city'] as string) ?? (r['name'] as string);
  if (!name) {
    return null;
  }
  const country = r['country'] as string | undefined;
  const countryCode = (r['countryCode'] as string) ?? null;
  const lat = r['latitude'];
  const lng = r['longitude'];
  const pop = r['population'];

  return {
    source: 'geodb',
    code: countryCode,
    name,
    countryCode,
    latitude: typeof lat === 'number' ? lat : typeof lat === 'string' ? parseFloat(lat) : null,
    longitude: typeof lng === 'number' ? lng : typeof lng === 'string' ? parseFloat(lng) : null,
    subtitle: [country ?? countryCode, pop != null ? `${pop} hab.` : null]
      .filter(Boolean)
      .join(' · ') || undefined,
  };
}
