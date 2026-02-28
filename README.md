# Video Hosting Backend

Backend для админского парсинга видео из внешних источников, публикации и внешней репликации данных в отдельный public backend.

Last updated: 2026-02-16

## Documentation

- Бизнес-процессы: `docs/business.md`
- Product requirements: `docs/prd.md`
- Обзор системы: `docs/system-overview.md`
- Доменные правила: `docs/domain-rules.md`
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
- Внешний integration-слой: `external/*` для отдельного public backend
- Legacy-модуль `videos` остается в проекте, но текущий фокус развития: parser + published + external

## Documentation Policy

- Любое изменение бизнес-правил, API-контракта или структуры данных должно обновлять соответствующий файл в `docs/` в том же PR.
- Документация должна оставаться короткой: только рабочие сценарии и ограничения, без лишней теории.
