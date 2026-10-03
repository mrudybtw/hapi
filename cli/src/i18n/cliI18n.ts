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
 * `ru.UTF-8`, `en_US@euro`) onto a supported locale. Returns null for
 * `C`/`POSIX` and anything we do not ship.
 */
export function normalizeCliLocale(tag: string | null | undefined): CliLocale | null {
    if (!tag) return null
    // Drop the POSIX codeset (`.UTF-8`) and modifier (`@euro`) parts.
    const language = tag.trim().toLowerCase().replace(/_/g, '-').split('.')[0].split('@')[0]
    if (!language || language === 'c' || language === 'posix') return null
    if (language === 'ru' || language.startsWith('ru-')) return 'ru'
    if (language === 'en' || language.startsWith('en-')) return 'en'
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
    'auth.help.tagline': 'Authentication management',
    'auth.help.usage': 'Usage:',
    'auth.help.status': 'Show current configuration',
    'auth.help.login': 'Enter and save CLI_API_TOKEN',
    'auth.help.logout': 'Clear saved credentials',
    'auth.help.priority': 'Token priority (highest to lowest):',
    'auth.help.priority1': '1. CLI_API_TOKEN environment variable',
    'auth.help.priority2': '2. ~/.hapi/settings.json',
    'auth.help.priority3': '3. Interactive prompt (on first run)',

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
    'runner.help.cleanupBody': 'Use {doctorClean}',

    'doctor.title': '🩺 hapi CLI Doctor',
    'doctor.section.basic': '📋 Basic Information',
    'doctor.section.spawn': '🔧 Runner Spawn Diagnostics',
    'doctor.section.config': '⚙️  Configuration',
    'doctor.section.env': '🌍 Environment Variables',
    'doctor.section.settings': '📄 Settings',
    'doctor.section.settingsFile': '📄 Settings (settings.json):',
    'doctor.section.auth': '🔐 Direct Connect Auth',
    'doctor.section.runner': '🤖 Runner Status',
    'doctor.section.runnerState': '📄 Runner State:',
    'doctor.section.processes': '🔍 All hapi CLI Processes',
    'doctor.section.processManagement': '💡 Process Management',
    'doctor.section.logs': '📝 Log Files',
    'doctor.section.support': '🐛 Support & Bug Reports',
    'doctor.label.cliVersion': 'hapi CLI Version',
    'doctor.label.platform': 'Platform',
    'doctor.label.nodeVersion': 'Node.js Version',
    'doctor.label.executable': 'Executable',
    'doctor.label.runtimeAssets': 'Runtime Assets',
    'doctor.label.projectRoot': 'Project Root',
    'doctor.label.cliEntrypoint': 'CLI Entrypoint',
    'doctor.label.cliExists': 'CLI Exists',
    'doctor.label.hapiHome': 'hapi Home',
    'doctor.label.botUrl': 'Bot URL',
    'doctor.label.logsDir': 'Logs Dir',
    'doctor.label.pid': 'PID',
    'doctor.label.started': 'Started',
    'doctor.label.httpPort': 'HTTP Port',
    'doctor.label.location': 'Location',
    'doctor.value.yes': '✓ Yes',
    'doctor.value.no': '❌ No',
    'doctor.value.set': 'set',
    'doctor.value.notSet': 'not set',
    'doctor.value.enabled': 'ENABLED',
    'doctor.settings.failed': '❌ Failed to read settings',
    'doctor.auth.set': '✓ CLI_API_TOKEN is set (from {source})',
    'doctor.auth.missing': '❌ CLI_API_TOKEN is not set',
    'doctor.auth.hint': '  Run `hapi auth login` to configure or set CLI_API_TOKEN env var',
    'doctor.runner.running': '✓ Runner is running',
    'doctor.runner.stale': '⚠️  Runner state exists but process not running (stale)',
    'doctor.runner.notRunning': '❌ Runner is not running',
    'doctor.processes.none': '❌ No hapi processes found',
    'doctor.processes.cleanupHint': 'To clean up runaway processes: hapi doctor clean',
    'doctor.processes.error': '❌ Error checking runner status',
    'doctor.logs.recent': 'Recent Logs:',
    'doctor.logs.runner': 'Runner Logs:',
    'doctor.logs.more': '  ... and {count} more log files',
    'doctor.logs.moreRunner': '  ... and {count} more runner log files',
    'doctor.logs.noRunner': 'No runner log files found',
    'doctor.logs.none': 'No log files found',
    'doctor.support.report': 'Report issues:',
    'doctor.support.docs': 'Documentation:',
    'doctor.support.readme': 'See project README',
    'doctor.done': '✅ Doctor diagnosis complete!',
    'doctor.processType.current': '📍 Current Process',
    'doctor.processType.runner': '🤖 Runner',
    'doctor.processType.runnerVersionCheck': '🔍 Runner Version Check (stuck)',
    'doctor.processType.runnerSpawnedSession': '🔗 Runner-Spawned Sessions',
    'doctor.processType.userSession': '👤 User Sessions',
    'doctor.processType.devRunner': '🛠️  Dev Runner',
    'doctor.processType.devRunnerVersionCheck': '🛠️  Dev Runner Version Check (stuck)',
    'doctor.processType.devSession': '🛠️  Dev Sessions',
    'doctor.processType.devDoctor': '🛠️  Dev Doctor',
    'doctor.processType.devRelated': '🛠️  Dev Related',
    'doctor.processType.doctor': '🩺 Doctor',
    'doctor.processType.unknown': '❓ Unknown',
    'doctor.clean.killing': 'Killing runaway process PID {pid}: {command}',
    'doctor.clean.force': 'Process PID {pid} ignored termination request, using force kill',
    'doctor.clean.killed': 'Successfully killed runaway process PID {pid}',
    'doctor.clean.failed': 'Failed to kill process PID {pid}: {error}',
    'doctor.auth.source.environment': 'environment variable',
    'doctor.auth.source.settingsFile': 'settings file',
    'doctor.auth.source.none': 'none',
    'doctor.clean.summary': 'Cleaned up {count} runaway processes',
    'doctor.inline.title': '🖼️  hapi inline media doctor',
    'doctor.inline.check.helper': 'Helper script (repo shell fallback)',
    'doctor.inline.check.helperMissing': 'missing: {path} (optional outside source checkout)',
    'doctor.inline.check.sdk': '@modelcontextprotocol/sdk (repo shell fallback)',
    'doctor.inline.check.sdkOk': 'resolvable from cli or repo root',
    'doctor.inline.check.sdkMissing': 'not found — optional outside source checkout',
    'doctor.inline.check.hubAuth': 'Hub auth',
    'doctor.inline.check.hubAuthMissing': 'CLI_API_TOKEN missing or auth failed',
    'doctor.inline.noAuth': 'Cannot probe sessions without hub auth.',
    'doctor.inline.probeFailed': '✗ Session probe failed: {error}',
    'doctor.inline.sessions': 'Active sessions',
    'doctor.inline.noSessions': '  No active sessions on hub.',
    'doctor.inline.bridge': 'bridge',
    'doctor.inline.noBridge': 'no bridge',
    'doctor.inline.listOmitsMcp': '⚠ Some active sessions have hapiMcpUrl on detail GET but not on list — upgrade hub or use per-session GET.',
    'doctor.inline.cursorNote1': '  Cursor ignores session/new mcpServers. Remote sessions use ~/.cursor/mcp.json + `agent mcp enable hapi-<sessionId>`.',
    'doctor.inline.cursorNote2': '  Tool names are bare: display_image, display_video, display_media, change_title (not hapi_display_image).',
    'doctor.inline.cursorVerify': '  Verify ({prefix}): agent mcp list-tools {serverId}',
    'doctor.inline.agentTitle': 'Agent inline path',
    'doctor.inline.agentStep1': '  1. MCP tool display_image / display_video / display_media in the running session (ACP flavors via hapi bridge)',
    'doctor.inline.agentStep2': '  2. Shell fallback (HAPI session id prefix, not cursorSessionId):',
    'doctor.inline.agentStep2Unavailable': '  2. Shell fallback unavailable (packaged install / no repo checkout) — use MCP tools only',
    'doctor.inline.ok': '✓ Inline media path available',
    'doctor.inline.noSession': '⚠ No active session with hapiMcpUrl — start or resume a remote session first.',
    'doctor.inline.failed': '✗ Inline media checks failed — fix items marked ✗ above.',
    'doctor.clean.errors': 'Errors:'

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
    'auth.help.tagline': 'Управление аутентификацией',
    'auth.help.usage': 'Использование:',
    'auth.help.status': 'Показать текущую конфигурацию',
    'auth.help.login': 'Ввести и сохранить CLI_API_TOKEN',
    'auth.help.logout': 'Удалить сохранённые учётные данные',
    'auth.help.priority': 'Приоритет токена (от высшего к низшему):',
    'auth.help.priority1': '1. Переменная окружения CLI_API_TOKEN',
    'auth.help.priority2': '2. ~/.hapi/settings.json',
    'auth.help.priority3': '3. Интерактивный запрос (при первом запуске)',

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
    'runner.help.cleanupBody': 'используйте {doctorClean}',

    'doctor.title': '🩺 hapi CLI Doctor',
    'doctor.section.basic': '📋 Основная информация',
    'doctor.section.spawn': '🔧 Диагностика запуска раннера',
    'doctor.section.config': '⚙️  Конфигурация',
    'doctor.section.env': '🌍 Переменные окружения',
    'doctor.section.settings': '📄 Настройки',
    'doctor.section.settingsFile': '📄 Настройки (settings.json):',
    'doctor.section.auth': '🔐 Аутентификация прямого подключения',
    'doctor.section.runner': '🤖 Статус раннера',
    'doctor.section.runnerState': '📄 Состояние раннера:',
    'doctor.section.processes': '🔍 Все процессы hapi CLI',
    'doctor.section.processManagement': '💡 Управление процессами',
    'doctor.section.logs': '📝 Файлы логов',
    'doctor.section.support': '🐛 Поддержка и багрепорты',
    'doctor.label.cliVersion': 'Версия hapi CLI',
    'doctor.label.platform': 'Платформа',
    'doctor.label.nodeVersion': 'Версия Node.js',
    'doctor.label.executable': 'Исполняемый файл',
    'doctor.label.runtimeAssets': 'Ресурсы рантайма',
    'doctor.label.projectRoot': 'Корень проекта',
    'doctor.label.cliEntrypoint': 'Точка входа CLI',
    'doctor.label.cliExists': 'CLI существует',
    'doctor.label.hapiHome': 'Домашний каталог hapi',
    'doctor.label.botUrl': 'URL бота',
    'doctor.label.logsDir': 'Каталог логов',
    'doctor.label.pid': 'PID',
    'doctor.label.started': 'Запущен',
    'doctor.label.httpPort': 'HTTP-порт',
    'doctor.label.location': 'Расположение',
    'doctor.value.yes': '✓ Да',
    'doctor.value.no': '❌ Нет',
    'doctor.value.set': 'задано',
    'doctor.value.notSet': 'не задано',
    'doctor.value.enabled': 'ВКЛЮЧЕНО',
    'doctor.settings.failed': '❌ Не удалось прочитать настройки',
    'doctor.auth.set': '✓ CLI_API_TOKEN задан (источник: {source})',
    'doctor.auth.missing': '❌ CLI_API_TOKEN не задан',
    'doctor.auth.hint': '  Выполните `hapi auth login` или задайте переменную окружения CLI_API_TOKEN',
    'doctor.runner.running': '✓ Раннер запущен',
    'doctor.runner.stale': '⚠️  Состояние раннера есть, но процесс не запущен (устарело)',
    'doctor.runner.notRunning': '❌ Раннер не запущен',
    'doctor.processes.none': '❌ Процессы hapi не найдены',
    'doctor.processes.cleanupHint': 'Для очистки зависших процессов: hapi doctor clean',
    'doctor.processes.error': '❌ Ошибка при проверке статуса раннера',
    'doctor.logs.recent': 'Последние логи:',
    'doctor.logs.runner': 'Логи раннера:',
    'doctor.logs.more': '  ... и ещё {count} файлов логов',
    'doctor.logs.moreRunner': '  ... и ещё {count} файлов логов раннера',
    'doctor.logs.noRunner': 'Файлы логов раннера не найдены',
    'doctor.logs.none': 'Файлы логов не найдены',
    'doctor.support.report': 'Сообщить о проблемах:',
    'doctor.support.docs': 'Документация:',
    'doctor.support.readme': 'см. README проекта',
    'doctor.done': '✅ Диагностика завершена!',
    'doctor.processType.current': '📍 Текущий процесс',
    'doctor.processType.runner': '🤖 Раннер',
    'doctor.processType.runnerVersionCheck': '🔍 Проверка версии раннера (зависла)',
    'doctor.processType.runnerSpawnedSession': '🔗 Сессии, запущенные раннером',
    'doctor.processType.userSession': '👤 Пользовательские сессии',
    'doctor.processType.devRunner': '🛠️  Раннер для разработки',
    'doctor.processType.devRunnerVersionCheck': '🛠️  Проверка версии dev-раннера (зависла)',
    'doctor.processType.devSession': '🛠️  Сессии разработки',
    'doctor.processType.devDoctor': '🛠️  Dev Doctor',
    'doctor.processType.devRelated': '🛠️  Связанное с разработкой',
    'doctor.processType.doctor': '🩺 Doctor',
    'doctor.processType.unknown': '❓ Неизвестно',
    'doctor.clean.killing': 'Завершаем зависший процесс PID {pid}: {command}',
    'doctor.clean.force': 'Процесс PID {pid} проигнорировал запрос на завершение, применяем принудительное завершение',
    'doctor.clean.killed': 'Зависший процесс PID {pid} успешно завершён',
    'doctor.clean.failed': 'Не удалось завершить процесс PID {pid}: {error}',
    'doctor.auth.source.environment': 'переменная окружения',
    'doctor.auth.source.settingsFile': 'файл настроек',
    'doctor.auth.source.none': 'нет',
    'doctor.clean.summary': 'Очищено зависших процессов: {count}',
    'doctor.inline.title': '🖼️  hapi inline media doctor',
    'doctor.inline.check.helper': 'Вспомогательный скрипт (shell-фолбэк репозитория)',
    'doctor.inline.check.helperMissing': 'отсутствует: {path} (необязателен вне исходников)',
    'doctor.inline.check.sdk': '@modelcontextprotocol/sdk (shell-фолбэк репозитория)',
    'doctor.inline.check.sdkOk': 'найден в cli или в корне репозитория',
    'doctor.inline.check.sdkMissing': 'не найден — необязателен вне исходников',
    'doctor.inline.check.hubAuth': 'Авторизация в хабе',
    'doctor.inline.check.hubAuthMissing': 'CLI_API_TOKEN отсутствует или авторизация не удалась',
    'doctor.inline.noAuth': 'Невозможно проверить сессии без авторизации в хабе.',
    'doctor.inline.probeFailed': '✗ Не удалось опросить сессии: {error}',
    'doctor.inline.sessions': 'Активные сессии',
    'doctor.inline.noSessions': '  На хабе нет активных сессий.',
    'doctor.inline.bridge': 'мост',
    'doctor.inline.noBridge': 'без моста',
    'doctor.inline.listOmitsMcp': '⚠ У некоторых активных сессий hapiMcpUrl есть в detail GET, но нет в списке — обновите хаб или используйте GET по сессии.',
    'doctor.inline.cursorNote1': '  Cursor игнорирует mcpServers из session/new. Удалённые сессии используют ~/.cursor/mcp.json + `agent mcp enable hapi-<sessionId>`.',
    'doctor.inline.cursorNote2': '  Имена инструментов без префикса: display_image, display_video, display_media, change_title (а не hapi_display_image).',
    'doctor.inline.cursorVerify': '  Проверка ({prefix}): agent mcp list-tools {serverId}',
    'doctor.inline.agentTitle': 'Инлайн-путь агента',
    'doctor.inline.agentStep1': '  1. MCP-инструменты display_image / display_video / display_media в запущенной сессии (ACP-флейворы через мост hapi)',
    'doctor.inline.agentStep2': '  2. Shell-фолбэк (префикс HAPI session id, а не cursorSessionId):',
    'doctor.inline.agentStep2Unavailable': '  2. Shell-фолбэк недоступен (пакетная установка / нет checkout репозитория) — используйте только MCP-инструменты',
    'doctor.inline.ok': '✓ Инлайн-путь медиа доступен',
    'doctor.inline.noSession': '⚠ Нет активной сессии с hapiMcpUrl — сначала запустите или возобновите удалённую сессию.',
    'doctor.inline.failed': '✗ Проверки инлайн-медиа не прошли — исправьте пункты, отмеченные ✗ выше.',
    'doctor.clean.errors': 'Ошибки:'

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
