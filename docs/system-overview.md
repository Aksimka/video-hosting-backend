# System Overview

Last updated: 2026-02-16

## High-Level Structure

Система разделена на три логических контура:

1. `control plane` — админка, парсинг, governance, публикация;
2. `external sync plane` — integration API для репликации во внешний public backend;
3. `public read plane` — отдельный сервис/контур, который отдает каталог пользователям.

## Modules

### `video-parser`

Отвечает за:

- стратегии парсинга внешних сайтов;
- сохранение `parsed_videos`;
- сохранение `parsed_video_sources`;
- обновление протухающих direct links.

### `tag-governance`

Отвечает за:

- raw tags / canonical tags;
- raw models / canonical models;
- категории и их связи с canonical tags;
- проверку готовности parsed-видео к публикации.

### `published-videos`

Отвечает за:

- snapshot опубликованных видео;
- publish/hide/resync lifecycle;
- связь между parsed-слоем и публичным слоем.

### `external`

Отвечает за:

- внешний integration API для отдельного public backend;
- инкрементальный feed опубликованных видео;
- snapshot активных категорий.

### Legacy Modules

- `videos`
- `video-proxy`
- `videoAssets`

Они не считаются текущей опорной архитектурой для нового функционала.

## Main Data Flows

### Parse Flow

1. Strategy парсит внешний ресурс.
2. `video-parser` приводит данные к unified video shape.
3. Данные сохраняются в `parsed_videos` и `parsed_video_sources`.
4. Сырые теги/модели и связи сохраняются в tags DB.

### Governance Flow

1. Админ видит raw-сущности.
2. Сопоставляет их с canonical сущностями или игнорирует.
3. Пока обязательные raw-сущности не обработаны, publish запрещен.

### Publish Flow

1. Админ инициирует публикацию из parsed-слоя.
2. `published-videos` копирует snapshot из parsed-видео.
3. Snapshot может содержать ручные override-поля.
4. `parsed_videos.status` синхронизируется с жизненным циклом публикации.

### External Replication Flow

1. `external/public-feed` отдает инкрементальные изменения published-видео.
2. `external/categories` отдает полный snapshot активных категорий.
3. Отдельный public backend строит собственную БД/read-model.
4. Публичный фронт работает только с этим отдельным public backend.

## Data Ownership

### Source of Truth

- `parsed_videos` — source of truth для распарсенных данных.
- `published_videos` — source of truth для опубликованных snapshot-данных.
- `categories` — source of truth для категорий.
- `canonical_tags` / `canonical_models` — source of truth для канонических справочников.

### Read Models

- Public backend должен иметь собственную read-model.
- Эта read-model является производной от `external` API.

## Databases

### Primary DB

Содержит:

- `parsed_videos`
- `parsed_video_sources`
- `published_videos`
- другие core-сущности

### Tags DB

Содержит:

- parser tags
- parser video tags
- raw/canonical mappings
- categories
- category to canonical tag links
- raw/canonical models

## External Contracts

### `GET /external/public-feed`

Используется public backend для инкрементального синка published-видео.

### `GET /external/categories`

Используется public backend для полного обновления активных категорий.

## Design Intent

- не пускать пользовательский публичный трафик в core;
- не смешивать admin API и integration API;
- минимизировать утечку внутренних сущностей наружу;
- оставить возможность масштабировать public mirrors независимо от core.
