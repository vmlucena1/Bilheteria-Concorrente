// A venda (passo 5 do enunciado): é aqui que a concorrência aparece.
import { DadosInvalidosErro, NaoEncontradoErro, PagamentoErro, type Evento } from "./dominio.ts";
import type { Pagamento } from "./pagamento.ts";
import { calcularTotal, montarIngressos } from "./preco.ts";
import { direitoAMeia } from "./regras.ts";
import type { Comprovante, ConfigBilheteria, EventoInfo, Pedido } from "./tipos.ts";

// Função da parte C, copiada do enunciado. O Promise.race devolve quem terminar
// primeiro: a cobrança ou o relógio, que rejeita depois de ms milissegundos.
function comTempoLimite<T>(promessa: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limite = new Promise<never>((_, rejeitar) => {
    timer = setTimeout(() => rejeitar(new Error("tempo esgotado")), ms);
  });
  // O finally desliga o relógio quando a cobrança termina antes.
  return Promise.race([promessa, limite]).finally(() => clearTimeout(timer));
}

export class Bilheteria {
  // Campos #: ninguém de fora troca os eventos, a operadora, o limite ou o contador.
  readonly #eventos: Evento[];
  readonly #pagar: Pagamento;
  readonly #limitePagamentoMs: number;
  #ultimoReservaId = 0;

  constructor(config: ConfigBilheteria) {
    this.#eventos = [...config.eventos];
    this.#pagar = config.pagar;
    this.#limitePagamentoMs = config.limitePagamentoMs;
  }

  // O info() de cada evento (não entrega os objetos Evento para fora).
  listarEventos(): EventoInfo[] {
    return this.#eventos.map((evento) => evento.info());
  }

  // Faz a venda inteira, na ordem do enunciado.
  async reservar(pedido: Pedido): Promise<Comprovante> {
    // 1. Confere o pedido e procura o evento.
    if (!Array.isArray(pedido?.ingressos) || pedido.ingressos.length === 0) {
      throw new DadosInvalidosErro("o pedido precisa ter pelo menos um ingresso");
    }
    const evento = this.#eventos.find((e) => e.id === pedido.eventoId);
    if (evento === undefined) {
      throw new NaoEncontradoErro(`o evento ${pedido.eventoId} não existe`);
    }

    // 2. Marca as poltronas ANTES do await do pagamento. Este trecho é síncrono:
    //    nenhum outro pedido roda entre conferir e marcar.
    const poltronas = pedido.ingressos.map((pessoa) => pessoa.poltrona);
    evento.reservar(poltronas);

    // 3. Monta os ingressos e o total com as funções puras do preco.ts.
    const ingressos = montarIngressos(evento.preco, pedido.ingressos, direitoAMeia);
    const total = calcularTotal(ingressos);

    // 4. Cobra. Enquanto este pedido espera aqui, o Node atende os outros.
    //    Se a operadora recusar ou passar do tempo limite, devolve as poltronas
    //    DESTE pedido e avisa com PagamentoErro.
    try {
      await comTempoLimite(this.#pagar(total), this.#limitePagamentoMs);
    } catch {
      evento.liberar(poltronas);
      throw new PagamentoErro("a operadora não aprovou o pagamento");
    }

    // 5. Pagamento aprovado: emite o comprovante com um reservaId novo.
    this.#ultimoReservaId += 1;
    return { reservaId: this.#ultimoReservaId, eventoId: evento.id, ingressos, total };
  }
}

export function criarBilheteria(config: ConfigBilheteria): Bilheteria {
  return new Bilheteria(config);
}
