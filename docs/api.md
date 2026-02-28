# API Контракты

Last updated: 2026-02-16

## Общие правила

- Формат: JSON over HTTP.
- Админские префиксы: `/admin/...`
- Внешний integration-префикс для public-контура: `/external/...`

## External: Public Sync

### `GET /external/public-feed`

Назначение: инкрементальный фид изменений для отдельного public-контура (репликация read-model).

Query params:
- `limit` (optional, default `100`, max `500`)
- `cursor` (optional, base64url-курсор из предыдущего ответа)

Response:
- `items[]`:
  - `operation`: `upsert` | `delete`
  - `entityId`: id записи `published_videos`
  - `cursor`: `{ updatedAt, id }`
  - `payload`: snapshot полей видео для public read-model (только для `upsert`, иначе `null`)
- `nextCursor`: строка для следующего запроса или `null`
- `hasMore`: есть ли следующая страница изменений
- `limit`: фактический лимит ответа

Семантика:
- `upsert`: запись в `published_videos` имеет `status=published`, public-контур должен создать/обновить видео.
- `delete`: запись имеет не-публичный статус (`hidden` и т.п.), public-контур должен удалить/скрыть видео у себя.

Текущая защита:
- Заголовок `x-internal-sync-token` поддерживается.
- Если `INTERNAL_SYNC_TOKEN` пустой, endpoint открыт (временный мок, TODO закрыть в production).

### `GET /external/categories`

Назначение: полный snapshot активных категорий для public-контура.

Response:
- `items` не оборачиваются, endpoint возвращает массив категорий
- каждый элемент содержит:
  - `id`
  - `name`
  - `slug`
  - `updatedAt`

Семантика:
- наружу отдаются только категории с `is_active=true`
- неактивные категории public-контур должен удалять/скрывать у себя при очередном sync

## Admin: Parser

### `POST /admin/video-parser/categories/parse`

Назначение: распарсить категорию (опционально с гидрацией видео-страниц).

### `POST /admin/video-parser/videos/parse`

Назначение: распарсить конкретную страницу видео и сохранить в БД.

### `GET /admin/video-parser/parsed-videos`

Назначение: список распарсенных видео.

Query params:
- `limit` (optional)
- `offset` (optional)
- `publicationState` (optional): `unpublished` | `published` | `all`

Семантика:
- по умолчанию `publicationState=unpublished` — отдаются только `parsed_videos.status=parsed`.
- при `publicationState=published` — отдаются только `parsed_videos.status=published`.

### `GET /admin/video-parser/parsed-videos/:id`

Назначение: детальная карточка распарсенного видео для админки.

### `GET /admin/video-parser/videos/:id/playable`

Назначение: получить рабочую direct-ссылку; при необходимости обновить on-demand.

### `POST /admin/video-parser/videos/:id/refresh`

Назначение: ручное обновление источников видео.

### `POST /admin/video-parser/videos/refresh-expiring`

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
- Текущий основной продуктовый фокус: parser + governance + published + external.
