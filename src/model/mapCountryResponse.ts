import type { Country, RawCountry } from './country.js';

/** Создаёт независимую модель UI, не изменяя данные API. */
export function mapCountryResponse(raw: RawCountry): Country {
  const location = raw.region ? ` — ${raw.region}` : '';
  const capitalDescription = raw.capital ? ` Столица: ${raw.capital}.` : '';

  return {
    name: raw.name,
    flag: raw.flag ?? '',
    flagUrl: raw.flags?.svg || raw.flags?.png || '',
    capital: raw.capital || 'Не указана',
    region: raw.region || 'Не указан',
    population: raw.population ?? null,
    languages: (raw.languages ?? []).map((language) => language.name),
    currencies: (raw.currencies ?? []).map((currency) => {
      const details = [currency.code, currency.symbol]
        .filter(Boolean)
        .join(', ');
      return details ? `${currency.name} (${details})` : currency.name;
    }),
    area: raw.area ?? null,
    borders: [...(raw.borders ?? [])],
    description: `${raw.name}${location}.${capitalDescription}`,
  };
}
