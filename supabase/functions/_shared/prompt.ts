// Prompt da leitura da comanda (docs/SPEC-leitura.md, "Prompt"), igual para todo provedor.
// Usado pela Edge Function ler-comanda e por scripts/comparar-modelos.ts. Não depende de Deno, para
// os testes do app rodarem aqui também. A IA só transcreve (R19): o cardápio vai sem preços e sem
// ingredientes.
import { ESQUEMA, type TipoLeitura } from './schema.ts'

/** O pedaço do cardapio-mel.json que o prompt usa. */
export interface CardapioPrompt {
  glossario: Record<string, string>
  pizzas: {
    tamanhos: Record<string, string>
    faixas: Record<string, unknown>
    sabores: { nome: string; faixa: string; apelidos?: string[] }[]
  }
  bordas: { nome: string }[]
  adicionais: { itens: string[]; outros: { nome: string }[] }
  combos: { id: string; itens: string[] }[]
  bebidas: { grupo: string; nome: string; apelidos?: string[] }[]
  refrigerante: { marcas: string[]; tamanhos: Record<string, string[]> }
  bairros: Record<string, string[]>
  outros: { nome: string }[]
  ambiguidades: { escrito: string; apelidos?: string[]; opcoes: string[] }[]
}

/** Foto de exemplo (JPEG em base64) com as duas leituras esperadas. */
export interface Exemplo {
  imagem: string
  leitura: unknown
  conferencia: unknown
}

export const REGRAS =
  'Você está lendo uma comanda de pizzaria escrita à mão. Transcreva exatamente o que está escrito, linha por linha, ' +
  'sem corrigir, deduzir ou completar nada. Marque trechos ilegíveis com [?] e liste-os em "ilegiveis". Transcreva o ' +
  'total e o telefone dígito por dígito. Use o cardápio e o glossário só para identificar itens, e marque ' +
  'casou_pelo_cardapio quando usar. Se uma palavra couber em mais de um sabor ou item, não escolha: na pizza, ' +
  'ponha a palavra como escrita em sabores; nos outros itens, devolva as opções. ' +
  'Não calcule valores.'

const comApelidos = (nome: string, apelidos?: string[]) => (apelidos?.length ? `${nome} (${apelidos.join(', ')})` : nome)

/** Regras, glossário e cardápio: igual em toda chamada, vai com cache. */
export function montarSistema(c: CardapioPrompt): string {
  const faixas = Object.keys(c.pizzas.faixas).map((faixa) => {
    const sabores = c.pizzas.sabores.filter((s) => s.faixa === faixa).map((s) => comApelidos(s.nome, s.apelidos))
    return `- ${faixa}: ${sabores.join('; ')}`
  })
  const grupos = [...new Set(c.bebidas.map((b) => b.grupo))].map(
    (g) =>
      `- ${g}: ${c.bebidas
        .filter((b) => b.grupo === g)
        .map((b) => comApelidos(b.nome, b.apelidos))
        .join('; ')}`,
  )
  return [
    REGRAS,
    '',
    'Formato: telefone_final são os 4 últimos dígitos do telefone do cliente, que identificam a comanda. Um asterisco ' +
      'na comanda é a promoção da noite (promocao). local_escrito é o bairro, a cidade ou a referência, como escritos. ' +
      'Nos itens, sabores e item usam os nomes exatos do cardápio abaixo; combo vem como "01" a "04". Pizza meio a ' +
      'meio (dois sabores ou mais na mesma pizza, escritos com "/", "-", "1/2", "½", "meia" ou um embaixo do outro) é ' +
      'um item só, com todos os sabores em sabores, na ordem escrita. Quando o sabor escrito for uma das palavras ' +
      'ambíguas listadas no fim, ponha em sabores a própria palavra (ex.: "frango"), no lugar daquele sabor, e deixe ' +
      'opcoes vazio: o app pergunta ao motoboy. opcoes é para bebida, borda, adicional e outros. Pedido para tirar ' +
      'ingrediente ("S/ cebola", "S/ catupiry") não é item nem adicional: fica só na transcrição. Na forma de ' +
      'pagamento, forma_escrita é o texto como está; forma é "dinheiro", "cartao" ou "pix" só quando o texto diz ' +
      'claramente uma forma, e null se diz mais de uma ou nenhuma. Valores (total_escrito, valor_escrito) vêm como ' +
      'texto, do jeito que estão escritos.',
    '',
    '## Glossário',
    ...Object.entries(c.glossario).map(([abrev, sentido]) => `- "${abrev}" = ${sentido}`),
    '',
    '## Cardápio',
    `Tamanhos de pizza: ${Object.entries(c.pizzas.tamanhos)
      .map(([t, nome]) => `${t} = ${nome}`)
      .join('; ')}.`,
    'Sabores por faixa (apelidos entre parênteses):',
    ...faixas,
    `Bordas: ${c.bordas.map((b) => b.nome).join('; ')}.`,
    `Adicionais: ${[...c.adicionais.itens, ...c.adicionais.outros.map((o) => o.nome)].join('; ')}.`,
    'Combos:',
    ...c.combos.map((k) => `- ${k.id}: ${k.itens.join(' + ')}`),
    'Bebidas:',
    ...grupos,
    `Refrigerante: a marca não muda o preço. Marca (${c.refrigerante.marcas.join(', ')}) com o tamanho é o item do ` +
      `tamanho: ${Object.entries(c.refrigerante.tamanhos)
        .map(([nome, grafias]) => `${grafias.join(', ')} = ${nome}`)
        .join('; ')}.`,
    `Outros: ${c.outros.map((o) => o.nome).join('; ')}.`,
    'Palavras que cabem em mais de um sabor ou item (na pizza, a palavra vai em "sabores"; nos outros itens, as ' +
      'opções em "opcoes"; outras grafias entre parênteses):',
    ...c.ambiguidades.map((a) => `- ${comApelidos(`"${a.escrito}"`, a.apelidos)}: ${a.opcoes.join('; ')}`),
    '',
    '## Bairros',
    'Muitas comandas trazem o bairro no lugar da cidade, às vezes abreviado ("N. Horizonte", "Jd. Araguaia"). Em ' +
      'local_escrito, transcreva como está escrito; a lista só ajuda a ler a letra.',
    ...Object.entries(c.bairros).map(([cidade, nomes]) => `- ${cidade}: ${nomes.join('; ')}.`),
  ].join('\n')
}

const PEDIDO: Record<TipoLeitura, string> = {
  completa: 'Leia esta comanda e devolva a leitura completa.',
  conferencia:
    'Leia de novo só os campos críticos desta comanda: o telefone e o total dígito por dígito, a forma de pagamento ' +
    'como escrita, o local como escrito e se tem asterisco.',
}

/** O pedido de uma leitura, igual para todo provedor: o adaptador só muda o formato. */
export interface Pedido {
  /** Regras, glossário e cardápio. */
  sistema: string
  /** Cada exemplo com a foto e a resposta esperada (JSON). */
  exemplos: { imagem: string; resposta: string }[]
  instrucao: string
  /** A foto da vez: vai por último, depois da parte fixa (assim o cache do provedor funciona). */
  imagem: string
  esquema: (typeof ESQUEMA)[TipoLeitura]
}

export function montarPedido(tipo: TipoLeitura, e: { cardapio: CardapioPrompt; exemplos: Exemplo[]; imagem: string }): Pedido {
  return {
    sistema: montarSistema(e.cardapio),
    exemplos: e.exemplos.map((x) => ({
      imagem: x.imagem,
      resposta: JSON.stringify(tipo === 'completa' ? x.leitura : x.conferencia),
    })),
    instrucao: PEDIDO[tipo],
    imagem: e.imagem,
    esquema: ESQUEMA[tipo],
  }
}

/** Bytes de um base64 (sem o prefixo data:), para recusar foto acima de 2 MB sem decodificar. */
export function tamanhoBase64(b64: string): number {
  const limpo = b64.replace(/\s/g, '')
  const enchimento = limpo.endsWith('==') ? 2 : limpo.endsWith('=') ? 1 : 0
  return Math.floor((limpo.length * 3) / 4) - enchimento
}

export const LIMITE_FOTO = 2 * 1024 * 1024
