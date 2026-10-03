# HAPI

> 🇬🇧 [English version](README.en.md)

> **Форк с русской локализацией.** Интерфейс веб-приложения и руководства `docs/guide/` переведены на русский язык — [mrudybtw](https://github.com/mrudybtw). Английские оригиналы сохранены рядом: переводы — `<имя>.ru.md`, оригиналы — `<имя>.md`. Оригинальный проект: [tiann/hapi](https://github.com/tiann/hapi).

Запускайте официальные сессии Claude Code / Codex / Cursor Agent / Grok Build / OpenCode / Kimi / Copilot / Antigravity / Pi / DeepSeek Harness и управляйте ими удалённо через нативные приложения iOS/Android, Web/PWA или Telegram Mini App.

> **Почему HAPI?** HAPI — это локально-ориентированная (local-first) альтернатива Happy. Ключевые отличия: [Why Not Happy?](docs/guide/why-hapi.ru.md) (рус.).

## Возможности

- **Бесшовная передача** — работайте локально, при необходимости переключайтесь на удалённое управление и обратно в любой момент. Без потери контекста и без перезапуска сессии.
- **Общие сессии Codex** — используйте Codex из терминала и с телефона одновременно. Требуется Codex 0.154.0+. [Использование и ограничения](docs/guide/codex-shared-sessions.ru.md) (рус.).
- **Нативно прежде всего** — HAPI оборачивает ваш ИИ-агент, а не заменяет его. Тот же терминал, тот же опыт, та же мышечная память.
- **AFK без остановки** — отошли от рабочего места? Подтверждайте запросы ИИ с телефона одним касанием.
- **Ваш ИИ — ваш выбор** — Claude Code, Codex, Cursor Agent, Grok Build, OpenCode, Kimi, Copilot, Antigravity, Pi, DeepSeek Harness — разные агенты, единый рабочий процесс.
- **Терминал отовсюду** — выполняйте команды из браузера телефона или веб-приложения, напрямую подключённого к рабочей машине.
- **Голосовое управление** — диктовка в нативных приложениях или разговор с ИИ-агентом без рук через веб-голосового ассистента.
- **Обзор рабочего пространства** — включается флагом `hapi runner start --workspace-root <путь>`: просматривайте ограниченное дерево файлов из веба и запускайте сессии в разрешённых подкаталогах.

## Быстрый старт

```bash
npx @twsxtd/hapi hub --relay     # запустить хаб с E2E-шифрованным релеем
npx @twsxtd/hapi                 # выбрать агента и начать сессию
```

`hapi server` — это псевдоним `hapi hub`.

Используйте `hapi <агент> [опции]` для прямого запуска, например `hapi claude` или `hapi codex`. В скриптах агента нужно указывать явно. `hapi --help` покажет команды и поддерживаемых агентов.

Хаб выводит URL и два QR-кода. Откройте веб-URL в браузере или свяжите нативное приложение через QR компаньона. См. [Нативные приложения](docs/guide/native-apps.ru.md) (рус.).

> Реле использует WireGuard + TLS для сквозного шифрования. Ваши данные шифруются от устройства до вашей машины.

Варианты самостоятельного развёртывания (Cloudflare Tunnel, Tailscale, фоновые службы и т.д.) — в [руководстве по развёртыванию](docs/guide/deployment.ru.md).

## Русская локаль

В этот форк добавлен полный перевод интерфейса веб-приложения на русский язык — `web/src/lib/locales/ru.ts` (1212 строк). Переключить язык можно через переключатель в шапке или в **Настройки → Язык**.

Локали лежат в `web/src/lib/locales/`:

- `en.ts` — английский,
- `zh-CN.ts` — китайский (упрощённый),
- `ru.ts` — русский (добавлен в этом форке).

Как собрать бинарь с русской локалью — см. [развёртывание](docs/guide/deployment.ru.md#сборка-из-исходников-с-русской-локалью).

## Сборка из исходников

Требуется Bun 1.4.0.

```bash
bun install
bun run build:single-exe
```

Готовый бинарь появится в `cli/dist-exe/<платформа>/hapi`.

## Документация

Русские переводы руководств лежат рядом с английскими оригиналами (`<имя>.ru.md` / `<имя>.md`).

- [Развёртывание](docs/guide/deployment.ru.md)
- [Быстрый старт](docs/guide/quick-start.ru.md)
- [Установка](docs/guide/installation.ru.md)
- [Нативные приложения (iOS / Android)](docs/guide/native-apps.ru.md)
- [Web / PWA](docs/guide/pwa.ru.md)
- [Как это работает](docs/guide/how-it-works.ru.md)
- [Поддерживаемые агенты](docs/guide/agents.ru.md)
- [Голосовой ассистент](docs/guide/voice-assistant.ru.md)
- [Пространства имён (Namespace)](docs/guide/namespace.ru.md)
- [Уведомления](docs/guide/notifications.ru.md)
- [Почему HAPI](docs/guide/why-hapi.ru.md)
- [FAQ](docs/guide/faq.ru.md)

На английском пока остаются API-контракты ([`docs/api/`](docs/api/client-contract/index.md)), [политика конфиденциальности](docs/privacy.md) и README подпроектов ([cli](cli/README.md), [hub](hub/README.md), [relay](relay/README.md), [web](web/README.md), [iOS](ios/README.md), [Android](android/README.md)).

## Нативные приложения (iOS / Android)

Репозиторий включает клиенты на SwiftUI/UIKit и Kotlin Compose: чат, подтверждения, создание сессий, файлы, диктовка и push-уведомления. Возможности, отличия платформ и сопряжение — в [гайде по нативным приложениям](docs/guide/native-apps.ru.md). Инструкции по сборке: [iOS](ios/README.md) (англ.) и [Android](android/README.md) (англ.). Протокол разработчика: [client contract](docs/api/client-contract/index.md) (англ.).

## Благодарности

HAPI — это «哈皮», китайская транслитерация [Happy](https://github.com/slopus/happy). Большая благодарность оригинальному проекту.
