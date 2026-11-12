// Время показывается в часовом поясе площадки из /api/me, а не в поясе браузера.

const formatters = new Map<string, Intl.DateTimeFormat>()

function getFormatter(tz: string, withDate: boolean): Intl.DateTimeFormat {
  const key = `${tz}|${withDate ? 'dt' : 't'}`
  let formatter = formatters.get(key)
  if (!formatter) {
    const base: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }
    if (withDate) {
      base.year = 'numeric'
      base.month = '2-digit'
      base.day = '2-digit'
    }
    try {
      formatter = new Intl.DateTimeFormat('ru-RU', { ...base, timeZone: tz })
    } catch {
      // неизвестный пояс: показываем UTC, но не подменяем поясом браузера
      formatter = new Intl.DateTimeFormat('ru-RU', { ...base, timeZone: 'UTC' })
    }
    formatters.set(key, formatter)
  }
  return formatter
}

// ISO 8601 в миллисекунды (NaN, если строка некорректна). Разбираем один раз при приёме данных.
export function parseIsoMs(iso: string): number {
  return Date.parse(iso)
}

export function formatSiteTime(ms: number, tz: string): string {
  if (!Number.isFinite(ms)) return '—'
  return getFormatter(tz, false).format(ms)
}

export function formatSiteDateTime(ms: number, tz: string): string {
  if (!Number.isFinite(ms)) return '—'
  return getFormatter(tz, true).format(ms)
}