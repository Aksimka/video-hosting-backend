# API Контракты

Last updated: 2026-02-13

## Общие правила

- Формат: JSON over HTTP.
- Публичный префикс: `/public/...`
- Админские префиксы: `/admin/...`, `/video-parser/...`

## Public API

### `GET /public/videos`

Назначение: список опубликованных видео.

Query params:
- `limit` (optional)
- `offset` (optional)

Response:
- `items[]` (краткие карточки)
- `total`, `limit`, `offset`

### `GET /public/videos/:id`

Назначение: детальная карточка опубликованного видео.

Response включает:
- title/description/duration
- player/direct/trailer/timeline URLs
- publishedAt, site, pageUrl

Важно:
- endpoint возвращает только `status=published`.
- внутренние raw/governance поля в публичный ответ не попадают.

## Admin: Parser

### `POST /video-parser/categories/parse`

Назначение: распарсить категорию (опционально с гидрацией видео-страниц).

### `POST /video-parser/videos/parse`

Назначение: распарсить конкретную страницу видео и сохранить в БД.

### `GET /video-parser/parsed-videos`

Назначение: список распарсенных видео.

### `GET /video-parser/parsed-videos/:id`

Назначение: детальная карточка распарсенного видео для админки.

### `GET /video-parser/videos/:id/playable`

Назначение: получить рабочую direct-ссылку; при необходимости обновить on-demand.

### `POST /video-parser/videos/:id/refresh`

Назначение: ручное обновление источников видео.

### `POST /video-parser/videos/refresh-expiring`

Назначение: батч-обновление протухающих direct-ссылок.

## Admin: Published Videos

### `POST /admin/published-videos`

Назначение: опубликовать видео из `parsed_video_id`.

Дополнительно:
- может принимать только редактируемые поля `title` и `description`,
- если поля переданы, они применяются поверх snapshot из parsed-данных.

### `GET /admin/published-videos`

Назначение: список опубликованных/скрытых видео (для админки).

### `GET /admin/published-videos/:id`

Назначение: получить карточку опубликованного видео.

### `PATCH /admin/published-videos/:id`

Назначение: обновить snapshot-данные и/или статус.

### `DELETE /admin/published-videos/:id`

Назначение: скрыть видео.

### `POST /admin/published-videos/:id/resync`

Назначение: обновить snapshot из актуального parsed-video.

## Admin: Tag Governance

### Канонические справочники

- `GET/POST/PATCH/DELETE /admin/tag-governance/canonical-tags...`
- `GET/POST/PATCH/DELETE /admin/tag-governance/canonical-models...`

### Работа с сырыми сущностями

- `GET /admin/tag-governance/raw-tags/unmapped`
- `PATCH /admin/tag-governance/raw-tags/:rawTagId/map`
- `PATCH /admin/tag-governance/raw-tags/:rawTagId/ignore`
- `GET /admin/tag-governance/raw-models/unmapped`
- `PATCH /admin/tag-governance/raw-models/:rawModelId/map`
- `PATCH /admin/tag-governance/raw-models/:rawModelId/ignore`

### Категории

- `GET/POST/PATCH/DELETE /admin/tag-governance/categories...`

## Legacy API

- `/videos/*`, `/video-proxy/*`, `/videoAssets/*` присутствуют в проекте.
- Текущий основной продуктовый фокус: parser + governance + published + public.
