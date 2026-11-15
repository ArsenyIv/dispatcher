// Только форматирование: значение ожидания приходит с сервера, экран его не считает.
export function formatWait(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—'
  const total = Math.round(seconds)
  if (total < 60) return `${total} с`
  const minutes = Math.floor(total / 60)
  const rest = total % 60
  return rest === 0 ? `${minutes} мин` : `${minutes} мин ${rest} с`
}

