# Техническая Архитектура

Last updated: 2026-02-13

## Модульная структура

- `video-parser` — стратегии парсинга источников, запись parsed-video и parsed-sources.
- `tag-governance` — канонизация тегов/моделей, ручной маппинг raw-данных.
- `published-videos` — админская проекция опубликованных видео (snapshot для выдачи).
- `public-videos` — публичная read-only выдача `status=published`.
- `videos`, `video-proxy`, `videoAssets` — legacy/вспомогательные модули.

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

1. `public-videos` читает только `published_videos`.
2. Фильтрация по `status=published`.
3. Клиенту отдаются только публичные поля карточки видео.

## Протухание direct-ссылок

- Проверка и обновление реализованы в `video-parser.service`.
- Стратегия: on-demand refresh при запросе playable-ссылки и плановый batched refresh для истекающих ссылок.

## Границы ответственности

- `video-parser` не решает, что публиковать.
- `published-videos` не занимается парсингом HTML.
- `public-videos` не знает про governance и raw-слой.
