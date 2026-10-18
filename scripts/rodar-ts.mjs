// Roda um script .ts com a resolução do Vite (imports sem extensão, JSON), igual aos testes.
// Uso: node scripts/rodar-ts.mjs scripts/comparar-modelos.ts [argumentos do script]
import { createServer, createServerModuleRunner } from 'vite'

const [, , arquivo, ...resto] = process.argv
// O script vê os próprios argumentos em process.argv.slice(2).
process.argv = [process.argv[0], arquivo, ...resto]
const servidor = await createServer({
  configFile: false,
  appType: 'custom',
  logLevel: 'error',
  server: { middlewareMode: true, hmr: false },
  optimizeDeps: { noDiscovery: true, include: [] },
})
const runner = createServerModuleRunner(servidor.environments.ssr, { hmr: false })
try {
  await runner.import(arquivo)
} finally {
  await runner.close()
  await servidor.close()
}
