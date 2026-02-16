# Операционная Документация

Last updated: 2026-02-16

## Требования

- Node.js 20+
- PostgreSQL (минимум одна БД; рекомендовано две, под core и tags)

## Environment

См. шаблон: `.env.example`

Критичные переменные:

- `PORT`
- `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`, `DB_SYNCHRONIZE`
- `TAGS_DB_HOST`, `TAGS_DB_PORT`, `TAGS_DB_USERNAME`, `TAGS_DB_PASSWORD`, `TAGS_DB_DATABASE`, `TAGS_DB_SYNCHRONIZE`
- `INTERNAL_SYNC_TOKEN` (токен для `GET /internal/public-feed`; при пустом значении endpoint временно открыт)

## Локальный запуск

```bash
npm install
cp .env.example .env
npm run start:dev
```

## Проверки перед релизом

```bash
npm run lint
npm run build
npm run test
```

## Базовый runbook

### Симптом: не публикуется видео

Проверь:

1. У parsed-video есть `PLAYER` source.
2. Закрыты ли unmapped raw-теги/модели в `tag-governance`.
3. Нет ли ошибок в логах парсинга/публикации.

### Симптом: видео не открывается у пользователя

Проверь:

1. Статус в `published_videos` равен `PUBLISHED`.
2. direct-ссылка не протухла.
3. Ручной refresh через parser endpoint.

### Симптом: public-контур не подтягивает изменения

Проверь:

1. Public sync-воркер вызывает `GET /internal/public-feed` с корректным `cursor`.
2. Если включен `INTERNAL_SYNC_TOKEN`, заголовок `x-internal-sync-token` передаётся и совпадает.
3. Воркер применяет `operation=upsert|delete` идемпотентно и сохраняет `nextCursor`.

## Политика актуальности доки

- Любое изменение endpoint, бизнес-правила, обязательности полей или статусов требует обновления `docs/*.md` в том же коммите.
- В каждом файле обновляется `Last updated`.
- Документация должна оставаться компактной и прикладной.
