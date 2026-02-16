# Video Hosting Backend

Backend для админского парсинга видео из внешних источников и публичной выдачи опубликованных видео.

Last updated: 2026-02-13

## Documentation

- Бизнес-процессы: `docs/business.md`
- API-контракты: `docs/api.md`
- Техническая архитектура: `docs/tech.md`
- Операционная документация: `docs/ops.md`
- Код-стайл: `docs/code-style.md`

## Quick Start

```bash
npm install
cp .env.example .env
npm run start:dev
```

Сервер по умолчанию стартует на `PORT=3001`.

## Main Scripts

- `npm run start:dev` — запуск в watch-режиме
- `npm run build` — production build
- `npm run lint` — ESLint + autofix
- `npm run test` — unit tests

## Scope

- Админские модули: парсинг, governance тегов/моделей, публикация
- Публичный модуль: только опубликованные видео (`status=published`)
- Legacy-модуль `videos` остается в проекте, но текущий фокус развития: parser + published + public

## Documentation Policy

- Любое изменение бизнес-правил, API-контракта или структуры данных должно обновлять соответствующий файл в `docs/` в том же PR.
- Документация должна оставаться короткой: только рабочие сценарии и ограничения, без лишней теории.
