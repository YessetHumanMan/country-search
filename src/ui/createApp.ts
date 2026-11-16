import { createSearchController } from '../model/createSearchController.js';
import type { SearchState } from '../model/createSearchController.js';
import { createCountryCard } from './createCountryCard.js';
import { createCountryDetails } from './createCountryDetails.js';
import { element } from './dom.js';

export function createApp() {
  const root = element('div', 'page');
  const header = element('header', 'site-header');
  const brand = element('a', 'brand', 'Country Search');
  brand.href = './';
  header.append(brand, element('span', 'api-badge', 'Данные countries.dev'));

  const main = element('main', 'main');
  const intro = element('section', 'intro');
  intro.append(
    element('p', 'eyebrow', 'МАЛЕНЬКИЙ ПОИСК. БОЛЬШОЙ МИР.'),
    element('h1', 'page-title', 'Откройте для себя мир.'),
    element(
      'p',
      'intro-text',
      'От первой буквы до новых открытий. Найдите страну и узнайте о ней больше.',
    ),
  );

  const form = element('form', 'search-form');
  form.setAttribute('role', 'search');
  const label = element('label', 'search-label', 'Название страны');
  label.htmlFor = 'country-query';
  const inputRow = element('div', 'input-row');
  const input = element('input', 'search-input');
  input.id = 'country-query';
  input.name = 'query';
  input.type = 'search';
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.placeholder = 'Например, Spain, Japan или Brazil';
  input.setAttribute('aria-describedby', 'search-hint');
  const clear = element('button', 'button clear-button', 'Очистить');
  clear.type = 'button';
  clear.disabled = true;
  const hint = element(
    'p',
    'search-hint',
    'Введите название латиницей — поиск начнётся автоматически.',
  );
  hint.id = 'search-hint';
  inputRow.append(input, clear);
  form.append(label, inputRow, hint);

  const feedback = element('div', 'feedback');
  feedback.setAttribute('role', 'status');
  feedback.setAttribute('aria-live', 'polite');
  feedback.setAttribute('aria-atomic', 'true');
  const results = element('ul', 'country-grid');
  results.setAttribute('aria-label', 'Найденные страны');
  const details = createCountryDetails();

  function render(state: SearchState): void {
    results.replaceChildren();
    feedback.replaceChildren();
    feedback.className = `feedback feedback-${state.status}`;
    feedback.setAttribute(
      'role',
      state.status === 'error' ? 'alert' : 'status',
    );
    results.setAttribute('aria-busy', String(state.status === 'loading'));

    switch (state.status) {
      case 'idle':
        feedback.append(
          element('h2', '', 'Куда отправимся?'),
          element(
            'p',
            '',
            'Начните с названия страны. Здесь появятся результаты поиска.',
          ),
        );
        break;
      case 'debouncing':
        feedback.append(element('p', '', 'Готовимся к поиску…'));
        break;
      case 'loading': {
        const spinner = element('span', 'spinner');
        spinner.setAttribute('aria-hidden', 'true');
        feedback.append(
          spinner,
          element('p', '', `Ищем страны по запросу «${state.query}»…`),
        );
        break;
      }
      case 'empty':
        feedback.append(
          element('h2', '', 'Пока ничего не найдено'),
          element(
            'p',
            '',
            `По запросу «${state.query}» нет совпадений. Попробуйте другое название.`,
          ),
        );
        break;
      case 'error': {
        const retry = element('button', 'button retry-button', 'Повторить');
        retry.type = 'button';
        retry.addEventListener('click', () => controller.retry());
        feedback.append(
          element('h2', '', 'Не получилось загрузить страны'),
          element('p', '', state.error.message),
          retry,
        );
        break;
      }
      case 'success':
        feedback.append(
          element(
            'p',
            'results-count',
            `Найдено стран: ${state.countries.length}`,
          ),
        );
        results.append(
          ...state.countries.map((country) =>
            createCountryCard(country, details.open),
          ),
        );
        break;
    }
  }

  const controller = createSearchController({ onStateChange: render });
  input.addEventListener('input', () => {
    clear.disabled = input.value.length === 0;
    controller.setQuery(input.value);
  });
  clear.addEventListener('click', () => {
    input.value = '';
    clear.disabled = true;
    controller.setQuery('');
    input.focus();
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    controller.retry();
  });

  const footer = element(
    'footer',
    'site-footer',
    'Мир ближе, чем кажется. Данные предоставлены countries.dev.',
  );
  main.append(intro, form, feedback, results);
  root.append(header, main, footer, details.element);
  render(controller.getState());

  return {
    element: root,
    dispose(): void {
      controller.dispose();
      if (details.element.open) details.element.close();
      root.remove();
    },
  };
}
