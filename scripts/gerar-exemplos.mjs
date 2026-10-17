// Junta as fotos e as leituras de supabase/functions/_shared/exemplos/ num módulo TS para a
// Edge Function (o deploy leva só módulos). Rode depois de mudar um exemplo: npm run exemplos
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const pasta = 'supabase/functions/_shared/exemplos'
const nomes = readdirSync(pasta)
  .filter((n) => n.endsWith('.json'))
  .map((n) => n.slice(0, -5))
  .sort()
const exemplos = nomes.map((nome) => {
  const json = JSON.parse(readFileSync(join(pasta, `${nome}.json`), 'utf8'))
  return {
    nome,
    imagem: readFileSync(join(pasta, `${nome}.jpg`)).toString('base64'),
    leitura: json.leitura,
    conferencia: json.conferencia,
  }
})
writeFileSync(
  join(pasta, 'exemplos.ts'),
  `// Gerado por scripts/gerar-exemplos.mjs a partir de ${nomes.map((n) => `${n}.jpg/.json`).join(', ')}. Não edite à mão.\n` +
    `import type { Exemplo } from '../prompt.ts'\n\n` +
    `export const EXEMPLOS: (Exemplo & { nome: string })[] = ${JSON.stringify(exemplos)}\n`,
)
console.log(`exemplos.ts: ${nomes.join(', ')}`)
