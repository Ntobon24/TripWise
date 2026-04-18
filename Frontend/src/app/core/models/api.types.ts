export type AuthUser = {
  sub: string;
  email: string;
  name: string;
};

export type LoginResponse = {
  success?: boolean;
  message?: string;
  token?: string;
  user?: { id: string; email: string; name: string };
};

export type TravelPlanSummary = {
  id: string;
  title: string;
  budgetAmount: number;
  currency: string;
  originCityCode: string | null;
  originCityName: string | null;
  destinationCityCode: string | null;
  destinationCityName: string | null;
  departureDate: string | null;
  returnDate: string | null;
  recommendations: unknown;
  selectedFlight?: FlightOfferSummary | null;
  selectedActivities?: ActivitySummary[];
  selectionsLocked?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PlansListResponse = {
  success: boolean;
  plans: TravelPlanSummary[];
  message?: string;
};

export type TravelIntegrationsStatus = {
  flightApi: { configured: boolean; hint: string | null };
  geodb: { configured: boolean; hint: string | null };
  openTripMap: { configured: boolean; hint: string | null };
  tripadvisor: { configured: boolean; hint: string | null };
  viator: { configured: boolean; hint: string | null };
};

export type UnifiedCity = {
  source: 'geodb';
  code: string | null;
  name: string;
  countryCode: string | null;
  latitude: number | null;
  longitude: number | null;
  subtitle?: string;
};

export type ExploreDestinationsResponse = {
  keyword: string;
  destinations: UnifiedCity[];
  geodb: UnifiedCity[];
  meta: { geodbConfigured: boolean; hint: string | null };
};

export type CitiesSearchResponse = {
  query: string;
  cities: UnifiedCity[];
  geodb: UnifiedCity[];
  meta: { geodbConfigured: boolean };
};

export type FlightOfferSummary = {
  id: string;
  totalPrice: number;
  currency: string;
  withinBudget: boolean;
  carrierCodes: string[];
  summary: string;
  departureAt: string | null;
  arrivalAt: string | null;
  originAirport: string | null;
  destinationAirport: string | null;
  stops: number;
};

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

export type RecommendationsPayload = {
  budget: number;
  currency: string;
  origin: { code: string; name: string | null };
  destination: { code: string; name: string | null };
  departureDate: string;
  flights: FlightOfferSummary[];
  activities: ActivitySummary[];
  meta: {
    source: string;
    flightProvider?: string | null;
    flightApiConfigured?: boolean;
    geodbConfigured?: boolean;
    openTripMapConfigured?: boolean;
    message?: string;
    flightsFound?: number;
    note?: string;
  };
};
