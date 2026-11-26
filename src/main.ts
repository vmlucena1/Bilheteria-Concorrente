// Liga tudo (passo 6 do enunciado): eventos, operadora, bilheteria e servidor.
import { criarBilheteria } from "./bilheteria.ts";
import { Evento } from "./dominio.ts";
import { criarPagamentoFalso } from "./pagamento.ts";
import { criarServidor } from "./servidor.ts";

// O evento 1 tem 100 poltronas porque é o que o bench usa.
const eventos = [
  new Evento(1, "Festival de Música", 100, 100),
  new Evento(2, "Espetáculo de Teatro", 80, 150),
  new Evento(3, "Show de Comédia", 120, 200),
];

// Operadora falsa: cada cobrança demora 80 ms e falha 10% das vezes.
const pagar = criarPagamentoFalso({ latenciaMs: 80, taxaDeFalha: 0.1 });

const bilheteria = criarBilheteria({ eventos, pagar, limitePagamentoMs: 500 });

criarServidor(bilheteria).listen(3000, () => {
  console.log("Bilheteria no ar em http://localhost:3000");
});
