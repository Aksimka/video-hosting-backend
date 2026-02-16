# Техническая Архитектура

Last updated: 2026-02-16

## Модульная структура

- `video-parser` — стратегии парсинга источников, запись parsed-video и parsed-sources.
- `tag-governance` — канонизация тегов/моделей, ручной маппинг raw-данных.
- `published-videos` — админская проекция опубликованных видео (snapshot для выдачи).
- `public-videos` — публичная read-only выдача `status=published`.
- `videos`, `video-proxy`, `videoAssets` — legacy/вспомогательные модули.

## Контуры системы

- Control plane (админ): `admin/video-parser`, `admin/published-videos`, `admin/tag-governance`.
- Public read plane: `public/videos`.
- Internal sync plane: `internal/public-feed` для передачи изменений в отдельный public-бэкенд.

## Принцип унификации

- Все стратегии парсинга могут иметь разные алгоритмы сбора данных.
- На выходе каждая стратегия обязана формировать единый контракт `ParsedVideoData`.
- Обязательное поле для успеха парсинга: `playerSourceUrl`.

## Хранилища данных

Приложение использует 2 подключения к БД:

- Primary DB (`databaseConfig`): `parsed_videos`, `parsed_video_sources`, `published_videos` и другие core-таблицы.

- Tags DB (`tagsDatabaseConfig`): `parser_tags`, `parser_video_tags`, `raw_tag_mappings`, `canonical_tags`, `raw_models`, `video_raw_models`, `raw_model_mappings`, `canonical_models`, `categories`, `category_canonical_tags`.

## Ключевые технические флоу

### Parse -> Persist

1. Стратегия парсит страницу.
2. Сервис сохраняет/обновляет `parsed_videos`.
3. Сохраняются источники в `parsed_video_sources` по типам (`PLAYER`, `DIRECT_VIDEO`, `THUMBNAIL`, ...).
4. Сохраняются raw-теги и raw-модели + связи с видео.

### Governance -> Publish

1. Админ закрывает unmapped raw-данные через map/ignore.
2. `published-videos` проверяет готовность к публикации.
3. Создается/обновляется snapshot опубликованного видео.

### Publish -> Public Read

1. В core-модуле `published-videos` формируется инкрементальный фид `GET /internal/public-feed`.
2. Public-контур периодически забирает изменения курсором (`updated_at`, `id`) и строит локальную read-model.
3. `public-videos` отдает данные только из локальной public read-model и только для `status=published`.
4. Для non-published статусов в фиде передается операция `delete`.

## Internal Feed Contract

- `operation=upsert` содержит полный snapshot публичных полей.
- `operation=delete` содержит только `entityId`, `payload=null`.
- Cursor кодируется в base64url (`{ updatedAt, id }`).
- Мок-защита: заголовок `x-internal-sync-token`, управляется `INTERNAL_SYNC_TOKEN` (TODO: сделать обязательным в production).

## Типы и контракты

- Типы internal public feed вынесены в отдельный файл:
  - `src/published-videos/types/public-feed.types.ts`
- Правило: для модульных API-контрактов не хранить крупные `type`-блоки внутри `.service`.

## Протухание direct-ссылок

- Проверка и обновление реализованы в `video-parser.service`.
- Стратегия: on-demand refresh при запросе playable-ссылки и плановый batched refresh для истекающих ссылок.

## Границы ответственности

- `video-parser` не решает, что публиковать.
- `published-videos` не занимается парсингом HTML.
- `public-videos` не знает про governance и raw-слой.
