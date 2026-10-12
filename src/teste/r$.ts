/** Texto esperado nos testes: troca "R$ " pelo espaço não separável usado na exibição. */
export const r$ = (texto: string) => texto.replace(/R\$ /g, 'R$ ')
