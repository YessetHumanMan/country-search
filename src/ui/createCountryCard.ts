import type { Country } from '../model/country.js';
import { createFact, element, formatNumber } from './dom.js';

export function createCountryCard(
  country: Country,
  onOpen: (country: Country) => void,
): HTMLLIElement {
  const item = element('li', 'country-item');
  const button = element('button', 'country-card');
  button.type = 'button';
  button.setAttribute('aria-label', `Подробнее о стране ${country.name}`);

  const flag = element('div', 'country-flag');
  if (country.flagUrl) {
    const image = element('img');
    image.src = country.flagUrl;
    image.alt = '';
    image.loading = 'lazy';
    image.addEventListener(
      'error',
      () => {
        flag.replaceChildren(
          element('span', 'flag-fallback', country.flag || '—'),
        );
      },
      { once: true },
    );
    flag.append(image);
  } else {
    flag.append(element('span', 'flag-fallback', country.flag || '—'));
  }

  const content = element('div', 'country-content');
  const facts = element('dl', 'facts');
  facts.append(
    createFact('Столица', country.capital),
    createFact('Население', formatNumber(country.population)),
  );
  content.append(
    element('p', 'country-region', country.region),
    element('h2', 'country-name', country.name),
    facts,
    element('span', 'card-link', 'Подробнее →'),
  );
  button.append(flag, content);
  button.addEventListener('click', () => onOpen(country));
  item.append(button);
  return item;
}
