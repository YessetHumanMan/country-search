# Country Search

Учебное приложение для живого поиска стран через countries.dev.

## Разработка

Требуется Node.js 24 LTS и npm.

```sh
npm ci
npm run build
npm start
```

Откройте адрес, напечатанный статическим сервером. Не используйте `file://`.
В отдельном терминале `npm run dev` запускает перекомпиляцию TypeScript при изменениях.

## Проверки

```sh
npm run lint
npm run format:check
npm test
npm run build
```

- `npm run format` — форматирование.
- `npm run test:watch` — тесты в watch-режиме.
- `pre-commit` — только lint-staged (ESLint и Prettier).
- `pre-push` — `npm test`.

Обязательные функции разрабатываются через TDD: сначала отдельный коммит с
падающими тестами, затем отдельный коммит с реализацией.
