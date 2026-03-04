# Domain Rules

Last updated: 2026-03-04

## Video States

- `parsed` — видео распарсено, но не опубликовано;
- `published` — видео опубликовано через `published_videos`;
- `hidden` — запись существует в `published_videos`, но не должна попадать в public.

## Publish Rules

- Видео нельзя успешно опубликовать без рабочего `player_source_url`.
- Перед публикацией должны быть закрыты обязательные governance-задачи по raw-сущностям.
- Публикация создает или обновляет snapshot в `published_videos`.
- Hidden/non-public записи не должны попадать в public read-model.

## Parsed Rules

- Parsed-слой предназначен для админки и внутренних операций.
- Если видео уже находится в published-слое, оно не должно появляться в default выборке parsed-видео для повторной публикации.
- Parsed-данные могут обновляться повторным парсингом той же страницы.

## Source Rules

- `PLAYER` source обязателен для успешного жизненного цикла публикации.
- `DIRECT_VIDEO` может протухать и обновляться.
- Второстепенные ассеты могут отсутствовать.
- Отсутствие второстепенных ассетов не должно ломать архитектуру.

## Category Rules

- Категории управляются админкой и хранятся в core.
- Категории не проходят отдельный publish flow.
- Категория может иметь собственное превью-изображение (`preview_url`) для публичного сайта.
- Для внешнего/public контура доступны все категории с `is_active=true`.
- Неактивные категории не должны отдаваться через `external/categories`.

## Public Data Rules

- Public API не должен раскрывать raw entities.
- Public API не должен раскрывать governance internals.
- Public API не должен зависеть от структуры внутренних админских таблиц.
- Public backend должен работать со своей read-model.

## External Sync Rules

- `external/public-feed` — это integration API для machine-to-machine sync.
- Это не browser API и не endpoint для прямого использования фронтом.
- Public backend обязан обрабатывать `upsert/delete` идемпотентно.
- Cursor должен сдвигаться только после успешного применения batch.

## Editing Rules

- Перед публикацией админ может редактировать только разрешенные поля.
- На текущем этапе основной ручной override перед публикацией: `title` и `description`.
- Если набор редактируемых полей изменится, это нужно отразить в API и документации.

## Architecture Rules

- `admin/*` и `public/*` не смешиваются.
- `external/*` существует как отдельный интеграционный слой.
- Новый функционал для public replication должен по умолчанию добавляться в `external`, а не в admin-модули.
