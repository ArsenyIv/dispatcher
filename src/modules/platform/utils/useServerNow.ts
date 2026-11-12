import { onScopeDispose, readonly, shallowRef } from 'vue'
import { serverClock } from './serverClock'

// Один общий таймер на весь экран: раз в секунду обновляет «текущее время сервера».
// Все обратные отсчёты читают его, отдельных setInterval на каждую строку нет.
const now = shallowRef<number | null>(serverClock.now())
let users = 0
let timer: ReturnType<typeof setInterval> | null = null

export function useServerNow() {
  now.value = serverClock.now()
  users += 1
  if (timer === null) {
    timer = setInterval(() => {
      now.value = serverClock.now()
    }, 1000)
  }
  onScopeDispose(() => {
    users -= 1
    if (users === 0 && timer !== null) {
      clearInterval(timer)
      timer = null
    }
  })
  return readonly(now)
}