import { describe, expect, it } from 'vitest'
import { createHttpClient, type FetchLike } from './httpClient'

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

const clientWith = (fetchImpl: FetchLike, defaultTimeoutMs = 1000) =>
  createHttpClient({ fetchImpl, defaultTimeoutMs })

describe('http client', () => {
  it('возвращает разобранный JSON при 2xx', async () => {
    const client = clientWith(async () => json(200, { ok: 1 }))
    await expect(client.request('/x')).resolves.toEqual({ ok: 1 })
  })

  it('409 даёт конфликт с актуальным объектом в body', async () => {
    const client = clientWith(async () => json(409, { decision_id: 'd-1', status: 'executed' }))
    await expect(client.request('/x')).rejects.toMatchObject({
      kind: 'conflict',
      status: 409,
      retryable: false,
      body: { decision_id: 'd-1', status: 'executed' },
    })
  })

  it('403 это отказ в правах без повтора', async () => {
    const client = clientWith(async () => json(403, { error: 'forbidden' }))
    await expect(client.request('/x')).rejects.toMatchObject({ kind: 'forbidden', retryable: false })
  })

  it('5xx можно повторять', async () => {
    const client = clientWith(async () => json(503, {}))
    await expect(client.request('/x')).rejects.toMatchObject({ kind: 'server', retryable: true })
  })

  it('обрыв связи даёт network и допускает повтор', async () => {
    const client = clientWith(async () => {
      throw new TypeError('Failed to fetch')
    })
    await expect(client.request('/x')).rejects.toMatchObject({ kind: 'network', retryable: true })
  })

  it('отсутствие ответа даёт timeout и допускает повтор', async () => {
    const hanging: FetchLike = (_input, init) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new Error('aborted')))
      })
    const client = clientWith(hanging, 20)
    await expect(client.request('/x')).rejects.toMatchObject({ kind: 'timeout', retryable: true })
  })

  it('передаёт тело и заголовки', async () => {
    let seen: RequestInit | undefined
    const client = clientWith(async (_input, init) => {
      seen = init
      return json(200, {})
    })
    await client.request('/x', { method: 'POST', headers: { 'Idempotency-Key': 'k' }, body: { a: 1 } })
    expect(seen?.method).toBe('POST')
    expect(seen?.body).toBe('{"a":1}')
    expect(seen?.headers).toMatchObject({ 'Idempotency-Key': 'k', 'Content-Type': 'application/json' })
  })
})