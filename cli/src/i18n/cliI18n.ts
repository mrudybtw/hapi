/**
 * Minimal CLI message catalog.
 *
 * The CLI runs in a terminal, so the locale is resolved from `HAPI_LANG`, the
 * `language` field in `~/.hapi/settings.json`, the POSIX locale environment,
 * and finally English. Keep the module dependency-free so it can be imported
 * from any command.
 */

import { existsSync, readFileSync } from 'node:fs'
import { configuration } from '@/configuration'

export type CliLocale = 'en' | 'ru'

/**
 * Map a BCP-47-ish or POSIX language tag (`ru`, `ru-RU`, `ru_RU.UTF-8`,
 * `en_US`) onto a supported locale. Returns null for `C`/`POSIX` and anything
 * we do not ship.
 */
export function normalizeCliLocale(tag: string | null | undefined): CliLocale | null {
    if (!tag) return null
    const lower = tag.trim().toLowerCase().replace(/_/g, '-')
    if (!lower || lower === 'c' || lower === 'posix') return null
    if (lower.startsWith('c.') || lower.startsWith('posix.')) return null
    if (lower === 'ru' || lower.startsWith('ru-')) return 'ru'
    if (lower === 'en' || lower.startsWith('en-')) return 'en'
    return null
}

/**
 * Pick the CLI locale. An explicit `HAPI_LANG` wins, then the settings file,
 * then the POSIX locale variables, then English. Following POSIX, the first
 * locale variable that is set decides: `LC_ALL=C` with `LANG=ru_RU.UTF-8` is
 * English, not Russian.
 */
export function resolveCliLocale(
    env: NodeJS.ProcessEnv = process.env,
    settingsLanguage: string | null = null
): CliLocale {
    const explicit = normalizeCliLocale(env.HAPI_LANG) ?? normalizeCliLocale(settingsLanguage)
    if (explicit) return explicit

    for (const candidate of [env.LC_ALL, env.LC_MESSAGES, env.LANG]) {
        if (candidate?.trim()) return normalizeCliLocale(candidate) ?? 'en'
    }
    return 'en'
}

/**
 * Read the optional `language` field from a settings file. Missing, unreadable
 * or malformed files resolve to null so a broken file cannot break the CLI.
 */
export function readSettingsLanguage(settingsFile: string): string | null {
    try {
        if (!existsSync(settingsFile)) return null
        const parsed = JSON.parse(readFileSync(settingsFile, 'utf8')) as { language?: unknown }
        return typeof parsed.language === 'string' ? parsed.language : null
    } catch {
        return null
    }
}

let currentLocale: CliLocale | null = null

/** Resolve the process-wide CLI locale (cached after the first call). */
export function getCliLocale(): CliLocale {
    if (!currentLocale) {
        currentLocale = resolveCliLocale(process.env, readSettingsLanguage(configuration.settingsFile))
    }
    return currentLocale
}

/** Override the cached locale; `null` re-resolves on the next lookup. */
export function setCliLocale(locale: CliLocale | null): void {
    currentLocale = locale
}

const en = {
    'common.error': 'Error:',
    'common.unknownError': 'Unknown error',

    'auth.status.title': 'Direct Connect Status',
    'auth.status.tokenSet': 'set',
    'auth.status.tokenMissing': 'missing',
    'auth.status.tokenSourceLabel': 'Token Source',
    'auth.status.tokenSource.environment': 'environment',
    'auth.status.tokenSource.settingsFile': 'settings file',
    'auth.status.tokenSource.none': 'none',
    'auth.status.machineId': 'Machine ID',
    'auth.status.notSet': 'not set',
    'auth.status.host': 'Host',
    'auth.status.missing.title': 'Token not configured. To get your token:',
    'auth.status.missing.step1': '1. Check the server startup logs (first run shows generated token)',
    'auth.status.missing.step2': '2. Read ~/.hapi/settings.json on the server',
    'auth.status.missing.step3': '3. Ask your server administrator (if token is set via env var)',
    'auth.status.missing.then': 'Then run: hapi auth login',
    'auth.error.noTty': 'Cannot prompt for token in non-TTY environment.',
    'auth.error.noTtyHint': 'Set CLI_API_TOKEN environment variable instead.',
    'auth.error.emptyToken': 'Token cannot be empty',
    'auth.prompt.token': 'Enter CLI_API_TOKEN: ',
    'auth.saved': 'Token saved to {path}',
    'auth.logout.done': 'Cleared local credentials (token and machineId).',
    'auth.logout.note': 'Note: If CLI_API_TOKEN is set via environment variable, it will still be used.',
    'auth.error.unknownSubcommand': 'Unknown auth subcommand: {subcommand}',
    'auth.help': `hapi auth - Authentication management

Usage:
  hapi auth status            Show current configuration
  hapi auth login             Enter and save CLI_API_TOKEN
  hapi auth logout            Clear saved credentials

Token priority (highest to lowest):
  1. CLI_API_TOKEN environment variable
  2. ~/.hapi/settings.json
  3. Interactive prompt (on first run)`,

    'token.missing.title': 'No CLI_API_TOKEN found.',
    'token.missing.where': 'Where to find the token:',
    'token.missing.step1': '  1. Check the server startup logs (first run shows generated token)',
    'token.missing.step2': '  2. Read ~/.hapi/settings.json on the server',
    'token.missing.step3': '  3. Ask your server administrator (if token is set via env var)',
    'token.required': 'CLI_API_TOKEN is required. Set it via environment variable or run `hapi auth login`.',

    'connect.unavailable': 'The `hapi connect` command is not available in direct-connect mode.',
    'connect.unavailableHint': 'Vendor token storage was part of the hosted server flow.',
    'notify.unavailable': 'The `hapi notify` command is not available in direct-connect mode.',
    'notify.unavailableHint': 'Use Telegram notifications from hapi-hub instead.',

    'runner.workspaceRoot.needsPath': '--workspace-root requires a path argument',
    'runner.workspaceRoot.empty': '--workspace-root requires a non-empty path',
    'runner.workspaceRoot.notDirectory': '--workspace-root path does not exist or is not a directory: {path}',
    'runner.list.empty': 'No active sessions this runner is aware of (they might have been started by a previous version of the runner)',
    'runner.list.header': 'Active sessions:',
    'runner.notRunning': 'No runner running',
    'runner.stopSession.needsId': 'Session ID required',
    'runner.stopSession.stopped': 'Session stopped',
    'runner.stopSession.alreadyGone': 'Session was already stopped',
    'runner.stopSession.failed': 'Failed to stop session',
    'runner.start.replacing': 'Existing runner detected, stopping it before starting a new one...',
    'runner.start.stopFailed': 'Failed to stop existing runner',
    'runner.start.started': 'Runner started successfully',
    'runner.start.failed': 'Failed to start runner',
    'runner.logs.none': 'No runner logs found',
    'runner.help.tagline': 'Runner management',
    'runner.help.usage': 'Usage:',
    'runner.help.start': 'Start the runner (replaces existing runner)',
    'runner.help.stop': 'Stop the runner (sessions stay alive)',
    'runner.help.status': 'Show runner status',
    'runner.help.list': 'List active sessions',
    'runner.help.options': 'Options:',
    'runner.help.workspaceRoot.part1': 'Restrict the runner to this directory.',
    'runner.help.workspaceRoot.part2': 'Repeat to allow multiple directories/drives.',
    'runner.help.workspaceRoot.part3': 'Browse & spawn reject paths outside them.',
    'runner.help.workspaceRoot.part4': 'Supports `~` / `~/foo` expansion.',
    'runner.help.workspaceRoot.part5': 'Omit to leave browsing off (legacy mode).',
    'runner.help.killHint': 'If you want to kill all hapi related processes run',
    'runner.help.note': 'Note:',
    'runner.help.noteBody': 'The runner runs in the background and manages Claude sessions.',
    'runner.help.noteStart': 'Running {runnerStart} stops any existing runner first so new flags and environment variables take effect.',
    'runner.help.cleanup': 'To clean up runaway processes:',
    'runner.help.cleanupBody': 'Use {doctorClean}'

}

const ru: Record<keyof typeof en, string> = {
    'common.error': 'Ошибка:',
    'common.unknownError': 'Неизвестная ошибка',

    'auth.status.title': 'Статус прямого подключения',
    'auth.status.tokenSet': 'задан',
    'auth.status.tokenMissing': 'отсутствует',
    'auth.status.tokenSourceLabel': 'Источник токена',
    'auth.status.tokenSource.environment': 'переменная окружения',
    'auth.status.tokenSource.settingsFile': 'файл настроек',
    'auth.status.tokenSource.none': 'нет',
    'auth.status.machineId': 'ID машины',
    'auth.status.notSet': 'не задан',
    'auth.status.host': 'Хост',
    'auth.status.missing.title': 'Токен не настроен. Где его взять:',
    'auth.status.missing.step1': '1. Посмотрите логи запуска сервера (при первом запуске он печатает сгенерированный токен)',
    'auth.status.missing.step2': '2. Прочитайте ~/.hapi/settings.json на сервере',
    'auth.status.missing.step3': '3. Спросите администратора сервера (если токен задан через переменную окружения)',
    'auth.status.missing.then': 'Затем выполните: hapi auth login',
    'auth.error.noTty': 'Невозможно запросить токен в окружении без TTY.',
    'auth.error.noTtyHint': 'Вместо этого задайте переменную окружения CLI_API_TOKEN.',
    'auth.error.emptyToken': 'Токен не может быть пустым',
    'auth.prompt.token': 'Введите CLI_API_TOKEN: ',
    'auth.saved': 'Токен сохранён в {path}',
    'auth.logout.done': 'Локальные учётные данные удалены (токен и machineId).',
    'auth.logout.note': 'Учтите: если CLI_API_TOKEN задан через переменную окружения, он всё ещё будет использоваться.',
    'auth.error.unknownSubcommand': 'Неизвестная подкоманда auth: {subcommand}',
    'auth.help': `hapi auth - управление аутентификацией

Использование:
  hapi auth status            Показать текущую конфигурацию
  hapi auth login             Ввести и сохранить CLI_API_TOKEN
  hapi auth logout            Удалить сохранённые учётные данные

Приоритет токена (от высшего к низшему):
  1. Переменная окружения CLI_API_TOKEN
  2. ~/.hapi/settings.json
  3. Интерактивный запрос (при первом запуске)`,

    'token.missing.title': 'CLI_API_TOKEN не найден.',
    'token.missing.where': 'Где взять токен:',
    'token.missing.step1': '  1. Посмотрите логи запуска сервера (при первом запуске он печатает сгенерированный токен)',
    'token.missing.step2': '  2. Прочитайте ~/.hapi/settings.json на сервере',
    'token.missing.step3': '  3. Спросите администратора сервера (если токен задан через переменную окружения)',
    'token.required': 'Требуется CLI_API_TOKEN. Задайте его через переменную окружения или выполните `hapi auth login`.',

    'connect.unavailable': 'Команда `hapi connect` недоступна в режиме прямого подключения.',
    'connect.unavailableHint': 'Хранение вендорных токенов относилось к потоку хостингового сервера.',
    'notify.unavailable': 'Команда `hapi notify` недоступна в режиме прямого подключения.',
    'notify.unavailableHint': 'Используйте уведомления Telegram из hapi-hub.',

    'runner.workspaceRoot.needsPath': '--workspace-root требует аргумент с путём',
    'runner.workspaceRoot.empty': '--workspace-root требует непустой путь',
    'runner.workspaceRoot.notDirectory': 'Путь --workspace-root не существует или не является каталогом: {path}',
    'runner.list.empty': 'У этого раннера нет известных активных сессий (возможно, их запустила предыдущая версия раннера)',
    'runner.list.header': 'Активные сессии:',
    'runner.notRunning': 'Раннер не запущен',
    'runner.stopSession.needsId': 'Требуется ID сессии',
    'runner.stopSession.stopped': 'Сессия остановлена',
    'runner.stopSession.alreadyGone': 'Сессия уже была остановлена',
    'runner.stopSession.failed': 'Не удалось остановить сессию',
    'runner.start.replacing': 'Обнаружен работающий раннер — останавливаем его перед запуском нового...',
    'runner.start.stopFailed': 'Не удалось остановить существующий раннер',
    'runner.start.started': 'Раннер успешно запущен',
    'runner.start.failed': 'Не удалось запустить раннер',
    'runner.logs.none': 'Логи раннера не найдены',
    'runner.help.tagline': 'Управление раннером',
    'runner.help.usage': 'Использование:',
    'runner.help.start': 'Запустить раннер (заменяет существующий)',
    'runner.help.stop': 'Остановить раннер (сессии продолжают работать)',
    'runner.help.status': 'Показать статус раннера',
    'runner.help.list': 'Список активных сессий',
    'runner.help.options': 'Опции:',
    'runner.help.workspaceRoot.part1': 'Ограничить раннер этим каталогом.',
    'runner.help.workspaceRoot.part2': 'Повторите, чтобы разрешить несколько каталогов/дисков.',
    'runner.help.workspaceRoot.part3': 'Просмотр и запуск отклоняют пути вне них.',
    'runner.help.workspaceRoot.part4': 'Поддерживается раскрытие `~` / `~/foo`.',
    'runner.help.workspaceRoot.part5': 'Не указывайте, чтобы отключить просмотр (устаревший режим).',
    'runner.help.killHint': 'Если нужно завершить все процессы, связанные с hapi, выполните',
    'runner.help.note': 'Примечание:',
    'runner.help.noteBody': 'Раннер работает в фоне и управляет сессиями Claude.',
    'runner.help.noteStart': 'Запуск {runnerStart} сначала останавливает существующий раннер, чтобы новые флаги и переменные окружения вступили в силу.',
    'runner.help.cleanup': 'Для очистки зависших процессов:',
    'runner.help.cleanupBody': 'используйте {doctorClean}'

}

const catalogs: Record<CliLocale, Record<string, string>> = { en, ru }

function interpolate(template: string, params?: Record<string, string | number>): string {
    if (!params) return template
    return template.replace(/\{(\w+)\}/g, (match, key) => {
        const value = params[key]
        return value !== undefined ? String(value) : match
    })
}

/** Translate a catalog key for the resolved CLI locale. */
export function cliT(key: string, params?: Record<string, string | number>): string {
    const catalog = catalogs[getCliLocale()] ?? en
    const template = catalog[key] ?? (en as Record<string, string>)[key] ?? key
    return interpolate(template, params)
}
