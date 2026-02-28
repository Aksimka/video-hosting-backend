# Agent Context

Last updated: 2026-02-16

## Purpose

Этот файл нужен как короткая точка входа для нового чата/агента.
Он не дублирует детальные документы, а направляет в нужные файлы.

## Read Order

1. `docs/prd.md`
2. `docs/domain-rules.md`
3. `docs/system-overview.md`
4. `docs/api.md`
5. `docs/tech.md`

## Current Product Focus

- Основной фокус проекта: parser + governance + published + external + public.
- `videos`, `video-proxy`, `videoAssets` считаются legacy/вспомогательными и не являются основным вектором развития.
- Парсинг и админские операции относятся к control plane.
- Публичная выдача относится к public read plane.
- Репликация данных в отдельный public-контур идет через `external` модуль.

## Architecture Boundaries

- `admin/*` — только админский контур.
- `public/*` — только публичная выдача для клиента.
- `external/*` — integration API для отдельного public backend, не browser API.
- Public-контур не должен ходить в core runtime-запросами пользователя.

## Core Invariants

- Видео не может считаться успешно опубликованным без `player_source_url`.
- В public попадают только данные из `published_videos`.
- Категории не публикуются вручную: активные категории (`is_active=true`) доступны наружу по умолчанию.
- Raw/governance сущности не должны утекать в public API.
- Если правило, endpoint или data flow изменился, нужно обновить соответствующий файл в `docs/`.

## Change Guidance

- При изменении бизнес-сценариев обновляй `docs/prd.md` и `docs/domain-rules.md`.
- При изменении модулей, таблиц, data flow обновляй `docs/system-overview.md` и `docs/tech.md`.
- При изменении endpoint'ов обновляй `docs/api.md`.
