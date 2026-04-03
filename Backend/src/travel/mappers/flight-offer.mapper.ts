/** Resumen unificado de oferta de vuelo (p. ej. FlightAPI). */

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
