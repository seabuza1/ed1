// O trabalhador da skill trabalhador-flatt: um segundo Claude Code, com o modelo da flatt, faz o braçal
// que o Opus manda. A chave vem de FLATT_API_KEY (variável do ambiente de nuvem ou do computador) ou do
// ~/.claude/flatt/chave; nunca do repositório.
//
//   node .claude/skills/trabalhador-flatt/flatt.mjs <<'TAREFA'
//   <a tarefa>
//   TAREFA
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const URL_FLATT = 'https://infer.flatt.com.br'
const MODELO = 'qwen3.8-27b'
const MODELO_RAPIDO = 'glm-5.3-flash'
// Lê, busca e edita; não roda comandos. Quem testa é o Opus.
const FERRAMENTAS = 'Read,Glob,Grep,Edit,Write'

const arquivoChave = join(process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude'), 'flatt', 'chave')
const chave = process.env.FLATT_API_KEY || (existsSync(arquivoChave) && readFileSync(arquivoChave, 'utf8').trim())
if (!chave) sair('Sem FLATT_API_KEY: crie a variável no ambiente de nuvem (ou no computador).')
const tarefa = readFileSync(0, 'utf8')
if (!tarefa.trim()) sair("Mande a tarefa pela entrada: node .claude/skills/trabalhador-flatt/flatt.mjs <<'TAREFA' ... TAREFA")

const env = { ...process.env }
// Nada da sessão do Opus (login, endereço, modelo, sessão na nuvem) pode vazar para o trabalhador.
for (const nome of Object.keys(env))
  if (/^(ANTHROPIC_|CLAUDE)/.test(nome) && !['CLAUDE_CONFIG_DIR', 'CLAUDE_CODE_GIT_BASH_PATH'].includes(nome)) delete env[nome]
delete env.FLATT_API_KEY
Object.assign(env, {
  ANTHROPIC_BASE_URL: URL_FLATT,
  ANTHROPIC_AUTH_TOKEN: chave,
  ANTHROPIC_MODEL: MODELO,
  ANTHROPIC_DEFAULT_OPUS_MODEL: MODELO,
  ANTHROPIC_DEFAULT_SONNET_MODEL: MODELO,
  ANTHROPIC_DEFAULT_HAIKU_MODEL: MODELO_RAPIDO,
  CLAUDE_CODE_SUBAGENT_MODEL: MODELO,
  CLAUDE_CODE_MAX_CONTEXT_TOKENS: '262144',
  CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
})

const args = ['-p', '--model', MODELO, '--permission-mode', 'acceptEdits', '--allowedTools', FERRAMENTAS, '--strict-mcp-config']
// No Windows o claude pode ser .cmd; a tarefa vai pela entrada, então o shell não mexe nela.
const r = spawnSync('claude', args, { input: tarefa, stdio: ['pipe', 'inherit', 'inherit'], env, shell: process.platform === 'win32' })
if (r.error) sair(`Não achei o claude: ${r.error.message}`)
process.exit(r.status ?? 1)

function sair(msg) {
  console.error(msg)
  process.exit(1)
}
