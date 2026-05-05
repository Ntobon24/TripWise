/** Pool de destinos para «Decide por mí» y planes generados por IA (códigos tipo IATA/zona). */

export type DestinationContinent = 'europe' | 'americas' | 'asia' | 'africa' | 'oceania';

export type DestinationEntry = {
  cityCode: string;
  cityName: string;
  minBudget: number;
  maxBudget: number;
  continent: DestinationContinent;
};

export const DESTINATION_POOL: DestinationEntry[] = [
  { cityCode: 'NYC', cityName: 'New York', minBudget: 1100, maxBudget: 6000, continent: 'americas' },
  { cityCode: 'LON', cityName: 'Londres', minBudget: 1050, maxBudget: 5600, continent: 'europe' },
  { cityCode: 'BER', cityName: 'Berlin', minBudget: 850, maxBudget: 4300, continent: 'europe' },
  { cityCode: 'ROM', cityName: 'Roma', minBudget: 900, maxBudget: 4500, continent: 'europe' },
  { cityCode: 'AMS', cityName: 'Amsterdam', minBudget: 950, maxBudget: 4700, continent: 'europe' },
  { cityCode: 'IST', cityName: 'Estambul', minBudget: 700, maxBudget: 3800, continent: 'europe' },
  { cityCode: 'DXB', cityName: 'Dubai', minBudget: 1200, maxBudget: 7000, continent: 'asia' },
  { cityCode: 'BKK', cityName: 'Bangkok', minBudget: 900, maxBudget: 5000, continent: 'asia' },
  { cityCode: 'TYO', cityName: 'Tokyo', minBudget: 1300, maxBudget: 7800, continent: 'asia' },
  { cityCode: 'SEL', cityName: 'Seul', minBudget: 1200, maxBudget: 7200, continent: 'asia' },
  { cityCode: 'SIN', cityName: 'Singapur', minBudget: 1350, maxBudget: 7600, continent: 'asia' },
  { cityCode: 'SYD', cityName: 'Sidney', minBudget: 1600, maxBudget: 9000, continent: 'oceania' },
  { cityCode: 'CPT', cityName: 'Ciudad del Cabo', minBudget: 1200, maxBudget: 6800, continent: 'africa' },
  { cityCode: 'CAI', cityName: 'El Cairo', minBudget: 700, maxBudget: 3600, continent: 'africa' },
  { cityCode: 'MRA', cityName: 'Marrakech', minBudget: 780, maxBudget: 3900, continent: 'africa' },
  { cityCode: 'MEX', cityName: 'Ciudad de Mexico', minBudget: 350, maxBudget: 2200, continent: 'americas' },
  { cityCode: 'LIM', cityName: 'Lima', minBudget: 320, maxBudget: 2100, continent: 'americas' },
  { cityCode: 'SCL', cityName: 'Santiago de Chile', minBudget: 380, maxBudget: 2600, continent: 'americas' },
  { cityCode: 'MAD', cityName: 'Madrid', minBudget: 700, maxBudget: 4000, continent: 'europe' },
  { cityCode: 'BCN', cityName: 'Barcelona', minBudget: 760, maxBudget: 4200, continent: 'europe' },
  { cityCode: 'MIA', cityName: 'Miami', minBudget: 650, maxBudget: 3500, continent: 'americas' },
  { cityCode: 'CUN', cityName: 'Cancun', minBudget: 450, maxBudget: 2800, continent: 'americas' },
  { cityCode: 'BUE', cityName: 'Buenos Aires', minBudget: 450, maxBudget: 2600, continent: 'americas' },
  { cityCode: 'RIO', cityName: 'Rio de Janeiro', minBudget: 550, maxBudget: 3200, continent: 'americas' },
  { cityCode: 'PAR', cityName: 'Paris', minBudget: 900, maxBudget: 5200, continent: 'europe' },
  { cityCode: 'ZRH', cityName: 'Zurich', minBudget: 1200, maxBudget: 7000, continent: 'europe' },
  { cityCode: 'PRG', cityName: 'Praga', minBudget: 780, maxBudget: 3900, continent: 'europe' },
  { cityCode: 'VIE', cityName: 'Viena', minBudget: 820, maxBudget: 4100, continent: 'europe' },
  { cityCode: 'BUD', cityName: 'Budapest', minBudget: 700, maxBudget: 3600, continent: 'europe' },
  { cityCode: 'ATH', cityName: 'Atenas', minBudget: 760, maxBudget: 3900, continent: 'europe' },
  { cityCode: 'MNL', cityName: 'Manila', minBudget: 900, maxBudget: 5000, continent: 'asia' },
  { cityCode: 'DEL', cityName: 'Nueva Delhi', minBudget: 900, maxBudget: 5200, continent: 'asia' },
  { cityCode: 'JNB', cityName: 'Johannesburgo', minBudget: 1050, maxBudget: 6000, continent: 'africa' },
  { cityCode: 'HNL', cityName: 'Honolulu', minBudget: 1500, maxBudget: 8200, continent: 'oceania' },
];
