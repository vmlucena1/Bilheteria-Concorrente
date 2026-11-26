// Evento e erros de negócio (passo 4 do enunciado), no paradigma orientado a objetos.
import type { EventoInfo } from "./tipos.ts";

// ---------------------------------------------------------------- Erros de negócio

// Classe abstrata: ninguém cria um "ErroDeNegocio" genérico, só as filhas.
// Cada erro guarda o próprio status HTTP, e o servidor.ts responde com ele.
export abstract class ErroDeNegocio extends Error {
  readonly status: number;

  constructor(mensagem: string, status: number) {
    super(mensagem);
    this.name = this.constructor.name; // ex.: "PoltronaOcupadaErro"
    this.status = status;
  }
}

// Pedido ou poltrona inválidos.
export class DadosInvalidosErro extends ErroDeNegocio {
  constructor(mensagem: string) {
    super(mensagem, 400);
  }
}

// O evento não existe.
export class NaoEncontradoErro extends ErroDeNegocio {
  constructor(mensagem: string) {
    super(mensagem, 404);
  }
}

// A poltrona já foi vendida.
export class PoltronaOcupadaErro extends ErroDeNegocio {
  constructor(mensagem: string) {
    super(mensagem, 409);
  }
}

// A operadora não aprovou o pagamento (recusou ou passou do tempo limite).
export class PagamentoErro extends ErroDeNegocio {
  constructor(mensagem: string) {
    super(mensagem, 502);
  }
}

// ---------------------------------------------------------------- Evento

export class Evento {
  readonly id: number;
  readonly nome: string;
  readonly preco: number;
  readonly capacidade: number;

  // Privado de verdade (#): nenhum código fora da classe lê ou altera esta lista.
  #poltronasVendidas: number[] = [];

  constructor(id: number, nome: string, preco: number, capacidade: number) {
    this.id = id;
    this.nome = nome;
    this.preco = preco;
    this.capacidade = capacidade;
  }

  // Só leitura: não existe setter, então "evento.disponivel = 999" não muda nada.
  get disponivel(): number {
    return this.capacidade - this.#poltronasVendidas.length;
  }

  // Marca as poltronas como vendidas. Tudo ou nada: primeiro confere todas,
  // só depois marca. Se alguma der erro, nenhuma da lista é marcada.
  reservar(poltronas: number[]): void {
    if (poltronas.length === 0) {
      throw new DadosInvalidosErro("o pedido não tem poltronas");
    }
    const inexistente = poltronas.find((p) => !Number.isInteger(p) || p < 1 || p > this.capacidade);
    if (inexistente !== undefined) {
      throw new DadosInvalidosErro(`a poltrona ${inexistente} não existe (vai de 1 a ${this.capacidade})`);
    }
    if (new Set(poltronas).size !== poltronas.length) {
      throw new DadosInvalidosErro("a mesma poltrona aparece mais de uma vez no pedido");
    }
    const ocupada = poltronas.find((p) => this.#poltronasVendidas.includes(p));
    if (ocupada !== undefined) {
      throw new PoltronaOcupadaErro(`a poltrona ${ocupada} já foi vendida`);
    }

    // Tudo conferido: agora sim marca todas de uma vez.
    this.#poltronasVendidas.push(...poltronas);
  }

  // Devolve as poltronas para a venda (usado quando o pagamento falha).
  liberar(poltronas: number[]): void {
    const naoVendida = poltronas.find((p) => !this.#poltronasVendidas.includes(p));
    if (naoVendida !== undefined) {
      throw new DadosInvalidosErro(`a poltrona ${naoVendida} não estava vendida`);
    }
    this.#poltronasVendidas = this.#poltronasVendidas.filter((p) => !poltronas.includes(p));
  }

  // Os 5 campos públicos do evento; a lista de poltronas continua escondida.
  info(): EventoInfo {
    return {
      id: this.id,
      nome: this.nome,
      preco: this.preco,
      capacidade: this.capacidade,
      disponivel: this.disponivel,
    };
  }
}
