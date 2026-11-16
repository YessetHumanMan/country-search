/** Создаёт элементы без HTML-строк; текст API всегда остаётся текстом. */
export function element<Tag extends keyof HTMLElementTagNameMap>(
  tag: Tag,
  className = '',
  text?: string,
): HTMLElementTagNameMap[Tag] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const numberFormatter = new Intl.NumberFormat('ru-RU');

export function formatNumber(value: number | null): string {
  return value === null ? 'Нет данных' : numberFormatter.format(value);
}

export function createFact(label: string, value: string): HTMLDivElement {
  const row = element('div', 'fact');
  row.append(element('dt', '', label), element('dd', '', value));
  return row;
}
