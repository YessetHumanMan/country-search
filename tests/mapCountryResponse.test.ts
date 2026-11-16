import { describe, expect, it } from 'vitest';
import { mapCountryResponse } from '../src/model/mapCountryResponse.js';
import type { RawCountry } from '../src/model/country.js';
import { spainResponse } from './fixtures/spain.js';

describe('mapCountryResponse', () => {
  it('maps API data into the card and detail model', () => {
    expect(mapCountryResponse(spainResponse)).toEqual({
      name: 'Spain',
      flag: '🇪🇸',
      flagUrl: 'https://flagcdn.com/es.svg',
      capital: 'Madrid',
      region: 'Europe',
      population: 47351567,
      languages: ['Spanish'],
      currencies: ['Euro (EUR, €)'],
      area: 505992,
      borders: ['AND', 'FRA', 'GIB', 'PRT', 'MAR'],
      description: 'Spain — Europe. Столица: Madrid.',
    });
  });

  it('provides explicit fallbacks for missing optional fields', () => {
    expect(mapCountryResponse({ name: 'Unknown' })).toEqual({
      name: 'Unknown',
      flag: '',
      flagUrl: '',
      capital: 'Не указана',
      region: 'Не указан',
      population: null,
      languages: [],
      currencies: [],
      area: null,
      borders: [],
      description: 'Unknown.',
    });
  });

  it('uses PNG when SVG is unavailable', () => {
    const raw = {
      name: 'Spain',
      flags: { png: 'https://flagcdn.com/w320/es.png' },
    };

    expect(mapCountryResponse(raw).flagUrl).toBe(raw.flags.png);
  });

  it('maps every language and currency in their original order', () => {
    const raw: RawCountry = {
      name: 'Example',
      languages: [{ name: 'English' }, { name: 'French' }],
      currencies: [
        { name: 'Dollar', code: 'USD', symbol: '$' },
        { name: 'Euro', code: 'EUR' },
        { name: 'Pound', symbol: '£' },
        { name: 'Other currency' },
      ],
    };

    const country = mapCountryResponse(raw);

    expect(country.languages).toEqual(['English', 'French']);
    expect(country.currencies).toEqual([
      'Dollar (USD, $)',
      'Euro (EUR)',
      'Pound (£)',
      'Other currency',
    ]);
  });

  it('preserves zero population and area rather than treating them as missing', () => {
    const country = mapCountryResponse({
      name: 'Example',
      population: 0,
      area: 0,
    });

    expect(country.population).toBe(0);
    expect(country.area).toBe(0);
  });

  it('treats empty capital and region as missing', () => {
    const country = mapCountryResponse({
      name: 'Example',
      capital: '',
      region: '',
    });

    expect(country.capital).toBe('Не указана');
    expect(country.region).toBe('Не указан');
    expect(country.description).toBe('Example.');
  });

  it.each([
    [{ name: 'Example', region: 'Europe' }, 'Example — Europe.'],
    [{ name: 'Example', capital: 'City' }, 'Example. Столица: City.'],
  ])(
    'builds a description only from available facts: %j',
    (raw, description) => {
      expect(mapCountryResponse(raw).description).toBe(description);
    },
  );

  it('does not mutate the response or expose its arrays for mutation', () => {
    const raw = structuredClone(spainResponse);
    const original = structuredClone(raw);
    raw.languages.forEach(Object.freeze);
    raw.currencies.forEach(Object.freeze);
    Object.freeze(raw.languages);
    Object.freeze(raw.currencies);
    Object.freeze(raw.borders);
    Object.freeze(raw.flags);
    Object.freeze(raw);

    const country = mapCountryResponse(raw);
    country.languages.push('Another language');
    country.currencies.push('Another currency');
    country.borders.push('XXX');

    expect(raw).toEqual(original);
    expect(country.borders).not.toBe(raw.borders);
  });

  it('returns equal data but independent arrays for repeated calls', () => {
    const first = mapCountryResponse(spainResponse);
    const second = mapCountryResponse(spainResponse);

    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first.languages).not.toBe(second.languages);
    expect(first.currencies).not.toBe(second.currencies);
    expect(first.borders).not.toBe(second.borders);
  });
});
