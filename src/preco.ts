// Cálculo de preço (passo 3 do enunciado), no paradigma funcional:
// só constantes e funções puras, sem laços e sem alterar o que recebem.
import type { Ingresso, Pessoa, TipoIngresso } from "./tipos.ts";

// Arredonda em 2 casas decimais e continua sendo número (o toFixed devolveria texto).
const arredondar = (valor: number): number => Math.round(valor * 100) / 100;

// Fábrica: recebe o preço base e devolve uma função que recebe o tipo e devolve o valor.
export const valorDoIngresso =
  (precoBase: number) =>
  (tipo: TipoIngresso): number =>
    tipo === "meia" ? arredondar(precoBase / 2) : precoBase;

// Outra fábrica: recebe o percentual e devolve uma função que soma a taxa a um valor.
export const aplicarTaxa =
  (percentual: number) =>
  (valor: number): number =>
    arredondar(valor + valor * percentual);

// Um Ingresso novo por pessoa, na mesma ordem. Quem decide se é meia é a regra recebida.
export const montarIngressos = (
  precoBase: number,
  pessoas: readonly Pessoa[],
  temDireitoAMeia: (pessoa: Pessoa) => boolean,
): Ingresso[] => {
  const valorPorTipo = valorDoIngresso(precoBase);
  return pessoas.map((pessoa): Ingresso => {
    const tipo: TipoIngresso = temDireitoAMeia(pessoa) ? "meia" : "inteira";
    return { nome: pessoa.nome, poltrona: pessoa.poltrona, tipo, valor: valorPorTipo(tipo) };
  });
};

// Soma os valores com reduce e aplica a taxa de serviço de 10% sobre a soma.
export const calcularTotal = (ingressos: readonly Ingresso[]): number => {
  const subtotal = ingressos.reduce((soma, ingresso) => soma + ingresso.valor, 0);
  return aplicarTaxa(0.1)(subtotal);
};
