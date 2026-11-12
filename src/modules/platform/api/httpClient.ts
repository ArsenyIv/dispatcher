// Единственный HTTP-клиент приложения. Все api-слои модулей ходят через него.
// Относительные адреса: в разработке их обслуживает прокси Vite, внешних запросов нет.

export type HttpErrorKind =
  | 'network' // нет связи или обрыв
  | 'timeout' // не дождались ответа: исход неизвестен
  | 'aborted' // отменено вызывающим кодом
  | 'forbidden' // 403
  | 'conflict' // 409, в body актуальный объект
  | 'not_found' // 404
  | 'client' // прочие 4xx
  | 'server' // 5xx
  | 'invalid' // ответ 2xx не является JSON

export class HttpError extends Error {
  readonly kind: HttpErrorKind
  readonly status: number | null
  readonly body: unknown
  // можно ли безопасно повторить запрос с тем же Idempotency-Key
  readonly retryable: boolean

  constructor(kind: HttpErrorKind, message: string, status: number | null = null, body: unknown = null) {
    super(message)
    this.name = 'HttpError'
    this.kind = kind
    this.status = status
    this.body = body
    this.retryable = kind === 'network' || kind === 'timeout' || kind === 'server'
  }
}

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>

export interface HttpClientOptions {
  baseUrl?: string
  fetchImpl?: FetchLike
  defaultTimeoutMs?: number
}

export interface RequestOptions {
  method?: 'GET' | 'POST'
  headers?: Record<string, string>
  body?: unknown
  timeoutMs?: number
  signal?: AbortSignal
}

export interface HttpClient {
  // Возвращает разобранный JSON ответа 2xx. Остальное — исключение HttpError.
  request(path: string, options?: RequestOptions): Promise<unknown>
}

function kindForStatus(status: number): HttpErrorKind {
  if (status === 403) return 'forbidden'
  if (status === 409) return 'conflict'
  if (status === 404) return 'not_found'
  if (status >= 500) return 'server'
  return 'client'
}

export function createHttpClient(options: HttpClientOptions = {}): HttpClient {
  const baseUrl = options.baseUrl ?? ''
  const fetchImpl: FetchLike = options.fetchImpl ?? ((input, init) => globalThis.fetch(input, init))
  const defaultTimeoutMs = options.defaultTimeoutMs ?? 8000

  async function request(path: string, req: RequestOptions = {}): Promise<unknown> {
    const controller = new AbortController()
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, req.timeoutMs ?? defaultTimeoutMs)
    const onAbort = () => controller.abort()
    if (req.signal?.aborted) controller.abort()
    req.signal?.addEventListener('abort', onAbort)

    const failure = (): HttpError => {
      if (timedOut) return new HttpError('timeout', 'Сервер не ответил вовремя')
      if (req.signal?.aborted) return new HttpError('aborted', 'Запрос отменён')
      return new HttpError('network', 'Нет связи с сервером')
    }

    try {
      const headers: Record<string, string> = { Accept: 'application/json', ...req.headers }
      let body: string | undefined
      if (req.body !== undefined) {
        body = JSON.stringify(req.body)
        headers['Content-Type'] = 'application/json'
      }

      let response: Response
      let text: string
      try {
        response = await fetchImpl(baseUrl + path, {
          method: req.method ?? 'GET',
          headers,
          body,
          signal: controller.signal,
        })
        text = await response.text() // таймаут действует и на чтение тела
      } catch {
        throw failure()
      }

      let parsed: unknown = null
      if (text !== '') {
        try {
          parsed = JSON.parse(text)
        } catch {
          if (response.ok) throw new HttpError('invalid', 'Ответ сервера не является JSON', response.status)
        }
      }
      if (response.ok) return parsed
      throw new HttpError(kindForStatus(response.status), `HTTP ${response.status}`, response.status, parsed)
    } finally {
      clearTimeout(timer)
      req.signal?.removeEventListener('abort', onAbort)
    }
  }

  return { request }
}

// Общий экземпляр для всех модулей
export const http: HttpClient = createHttpClient()