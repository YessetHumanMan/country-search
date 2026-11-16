import type { Country } from '../model/country.js';
import { createFact, element, formatNumber } from './dom.js';

export function createCountryDetails() {
  const dialog = element('dialog', 'country-dialog');
  dialog.setAttribute('aria-labelledby', 'country-detail-title');

  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });

  return {
    element: dialog,
    open(country: Country): void {
      const content = element('div', 'detail-content');
      const close = element('button', 'button close-button', 'Закрыть');
      close.type = 'button';
      close.addEventListener('click', () => dialog.close());
      const title = element('h2', 'detail-title', country.name);
      title.id = 'country-detail-title';
      const flag = element('span', 'detail-flag', country.flag);
      flag.setAttribute('aria-hidden', 'true');
      const facts = element('dl', 'facts detail-facts');
      facts.append(
        createFact('Столица', country.capital),
        createFact('Регион', country.region),
        createFact('Население', formatNumber(country.population)),
        createFact(
          'Площадь',
          country.area === null
            ? 'Нет данных'
            : `${formatNumber(country.area)} км²`,
        ),
        createFact(
          'Границы (коды стран)',
          country.borders.join(', ') || 'Нет сухопутных границ / нет данных',
        ),
        createFact('Языки', country.languages.join(', ') || 'Нет данных'),
        createFact('Валюта', country.currencies.join(', ') || 'Нет данных'),
      );
      content.append(
        close,
        flag,
        title,
        element('p', 'detail-description', country.description),
        facts,
      );
      dialog.replaceChildren(content);
      dialog.showModal();
      close.focus();
    },
  };
}
