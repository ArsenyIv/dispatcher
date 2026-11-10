import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = 'src/modules'

// Разрешены: функции с суффиксом Mutator, useXxxStore и читающие get/select
const isAllowed = (name) =>
  /Mutator$/.test(name) ||
  /^use\w+Store$/.test(name) ||
  /^(get|select)[A-Z]/.test(name)

const fnDeclaration =
  /(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(/g
const arrowDeclaration =
  /(?:export\s+)?const\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z0-9_$]+)\s*(?::\s*[^=]+)?=>/g

const storeFiles = readdirSync(ROOT, { recursive: true })
  .map((p) => String(p).replace(/\\/g, '/'))
  .filter((p) => /(^|\/)store\/[^/]+\.ts$/.test(p) && !p.endsWith('.spec.ts'))

const errors = []

for (const relative of storeFiles) {
  const text = readFileSync(join(ROOT, relative), 'utf8')
  for (const regex of [fnDeclaration, arrowDeclaration]) {
    regex.lastIndex = 0
    let match
    while ((match = regex.exec(text)) !== null) {
      const name = match[1]
      if (!isAllowed(name)) {
        const line = text.slice(0, match.index).split('\n').length
        errors.push(`${ROOT}/${relative}:${line}  функция "${name}" должна называться ...Mutator`)
      }
    }
  }
}

if (errors.length > 0) {
  console.error('Нарушено правило суффикса Mutator:')
  for (const e of errors) console.error('  ' + e)
  process.exit(1)
}

console.log(`Проверка Mutator: файлов store проверено ${storeFiles.length}, нарушений нет`)