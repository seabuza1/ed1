// Login com e-mail e senha (Supabase Auth). Depois de entrar, cada usuário tem o próprio
// banco no aparelho (acerto-<id>), que continua funcionando sem internet.
import { useSyncExternalStore } from 'react'
import type { Papel } from '../domain/tipos'
import { criarRemotoSupabase } from './nuvem/remoto'
import { criarRepoNuvem, type RepoNuvem } from './nuvem/repoNuvem'
import { usarRepo } from './repo'
import { supabase } from './supabase'

export interface Usuario {
  id: string
  email: string
  nome: string
  papel: Papel
}

export type EstadoSessao =
  | { fase: 'carregando' }
  | { fase: 'fora' }
  | { fase: 'dentro'; usuario: Usuario; repo: RepoNuvem }

let estado: EstadoSessao = { fase: supabase ? 'carregando' : 'fora' }
const ouvintes = new Set<() => void>()
function definir(novo: EstadoSessao) {
  estado = novo
  ouvintes.forEach((o) => o())
}

export const useSessao = () =>
  useSyncExternalStore(
    (o) => (ouvintes.add(o), () => ouvintes.delete(o)),
    () => estado,
  )

/** Usuário logado, ou null sem nuvem. */
export function useUsuario(): Usuario | null {
  const s = useSessao()
  return s.fase === 'dentro' ? s.usuario : null
}

export const ehEquipe = (u: Usuario | null) => u?.papel === 'expedicao' || u?.papel === 'admin'

// Último usuário, para abrir sem internet (a sessão do Supabase pode não renovar offline).
const CHAVE = 'usuario'
function lerGuardado(): Usuario | null {
  try {
    return JSON.parse(localStorage.getItem(CHAVE) ?? 'null')
  } catch {
    return null
  }
}
function guardar(u: Usuario | null) {
  try {
    if (u) localStorage.setItem(CHAVE, JSON.stringify(u))
    else localStorage.removeItem(CHAVE)
  } catch {
    // sem localStorage: só não abre offline
  }
}

async function buscarPerfil(id: string): Promise<{ nome: string; papel: Papel } | null> {
  const { data } = await supabase!.from('perfis').select('nome, papel').eq('id', id).maybeSingle()
  return data
}

function entrarComo(u: Usuario) {
  guardar(u)
  if (estado.fase === 'dentro' && estado.usuario.id === u.id) return definir({ ...estado, usuario: u })
  if (estado.fase === 'dentro') estado.repo.parar()
  const repo = criarRepoNuvem({ nome: `acerto-${u.id}`, usuarioId: u.id, remoto: criarRemotoSupabase(supabase!) })
  usarRepo(repo)
  repo.iniciar()
  definir({ fase: 'dentro', usuario: u, repo })
}

async function usuarioDaSessao(id: string, email: string): Promise<Usuario> {
  const guardado = lerGuardado()
  const perfil = await buscarPerfil(id).catch(() => null)
  return {
    id,
    email,
    nome: perfil?.nome ?? (guardado?.id === id ? guardado.nome : email.split('@')[0]),
    papel: perfil?.papel ?? (guardado?.id === id ? guardado.papel : 'motoboy'),
  }
}

export async function iniciarSessao(): Promise<void> {
  if (!supabase) return
  const { data, error } = await supabase.auth.getSession()
  const sessao = data.session
  const guardado = lerGuardado()
  if (sessao) entrarComo(await usuarioDaSessao(sessao.user.id, sessao.user.email ?? ''))
  // Sem internet a sessão pode não renovar: segue com o último usuário, só no aparelho.
  else if (guardado && (error || !navigator.onLine)) entrarComo(guardado)
  else definir({ fase: 'fora' })

  supabase.auth.onAuthStateChange((evento, s) => {
    // Fora do callback: chamar o Supabase aqui dentro trava o cliente.
    setTimeout(async () => {
      if (evento === 'SIGNED_OUT') {
        if (estado.fase === 'dentro') estado.repo.parar()
        guardar(null)
        definir({ fase: 'fora' })
      } else if (s && (evento === 'SIGNED_IN' || evento === 'USER_UPDATED')) {
        if (estado.fase !== 'dentro' || estado.usuario.id !== s.user.id)
          entrarComo(await usuarioDaSessao(s.user.id, s.user.email ?? ''))
      }
    }, 0)
  })
}

const MENSAGENS: [RegExp, string][] = [
  [/invalid login credentials/i, 'E-mail ou senha errados.'],
  [/email not confirmed/i, 'Confirme o e-mail antes de entrar (veja a caixa de entrada).'],
  [/already registered|already exists/i, 'Já existe uma conta com esse e-mail.'],
  [/password should be at least/i, 'A senha precisa ter pelo menos 6 caracteres.'],
  [/invalid email|unable to validate email/i, 'E-mail inválido.'],
  [/fetch|network/i, 'Sem internet. Entre quando tiver conexão.'],
  [/rate limit|too many/i, 'Muitas tentativas. Espere um pouco e tente de novo.'],
]
const traduzir = (msg: string) => MENSAGENS.find(([re]) => re.test(msg))?.[1] ?? msg

/** Devolve a mensagem de erro, ou null se entrou. */
export async function entrar(email: string, senha: string): Promise<string | null> {
  const { data, error } = await supabase!.auth.signInWithPassword({ email: email.trim(), password: senha })
  if (error) return traduzir(error.message)
  entrarComo(await usuarioDaSessao(data.user.id, data.user.email ?? ''))
  return null
}

/** Conta nova vira motoboy; o nome vai em options.data.nome. */
export async function cadastrar(
  nome: string,
  email: string,
  senha: string,
): Promise<{ erro: string | null; confirmarEmail: boolean }> {
  if (nome.trim() === '') return { erro: 'Informe o seu nome.', confirmarEmail: false }
  const { data, error } = await supabase!.auth.signUp({
    email: email.trim(),
    password: senha,
    options: { data: { nome: nome.trim() } },
  })
  if (error) return { erro: traduzir(error.message), confirmarEmail: false }
  if (!data.session) return { erro: null, confirmarEmail: true }
  entrarComo({ id: data.session.user.id, email: data.session.user.email ?? '', nome: nome.trim(), papel: 'motoboy' })
  return { erro: null, confirmarEmail: false }
}

export async function sair(): Promise<void> {
  if (estado.fase === 'dentro') estado.repo.parar()
  guardar(null)
  await supabase?.auth.signOut({ scope: 'local' })
  location.assign('/')
}
