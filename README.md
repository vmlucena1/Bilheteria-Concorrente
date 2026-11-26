# Bilheteria concorrente

> **Vídeo:** 

Projeto final de Paradigmas de Linguagens de Programação. Enunciado completo no Blackboard.

Os arquivos de `src/` que vocês escrevem já existem, vazios; o `tipos.ts` e o `servidor.ts` vêm prontos. O que vai em cada um está no passo
indicado do enunciado:

| Arquivo | Passo do enunciado |
| :--- | :--- |
| `src/tipos.ts` (pronto) | 1: os tipos |
| `src/regras.ts` | 2: meia-entrada |
| `src/preco.ts` | 3: preço (funcional) |
| `src/dominio.ts` | 4: evento e erros (orientado a objetos) |
| `src/bilheteria.ts` | 5: a venda, onde a concorrência aparece |
| `src/servidor.ts` (pronto) e `src/main.ts` | 6: ligar o servidor |

Não alterem `src/pagamento.ts`, `src/servidor.ts`, `src/bench.ts` nem `testes/`: a correção usa os originais.

Para começar, sigam o `GUIA.md`. Depois dele, os comandos são:

```bash
npm install
npm test          # correção automática: mostra os pontos
npm start         # serviço em http://localhost:3000
npm run bench     # com o serviço no ar: 200 pedidos simultâneos no evento 1, dois por poltrona
```

Exemplo de pedido:

```bash
curl -X POST localhost:3000/reservas -H 'Content-Type: application/json' \
  -d '{"eventoId":1,"ingressos":[{"nome":"Ana","idade":20,"estudante":true,"pcd":false,"poltrona":7}]}'
```

---

## Preencham (avaliado no vídeo)

**Link do vídeo:** _PENDENTE (o mesmo link do topo deste arquivo)._

### Integrantes

| Nome | Usuário do GitHub | Parte principal |
| :--- | :--- | :--- |
| Vinícius Mendes de Lucena | [vmlucena1](https://github.com/vmlucena1) | Venda concorrente (`bilheteria.ts`) e ligação do servidor (`main.ts`) |
| Pedro Henrique Faustino | [Fausto2105](https://github.com/Fausto2105) | Regra da meia-entrada (`regras.ts`) e preço funcional (`preco.ts`) |
| Erickson Cezar Colicchio Junior | [ericksonccolicchiojr-ops](https://github.com/ericksonccolicchiojr-ops) | Evento e erros orientados a objetos (`dominio.ts`) |

### Decisões

1. **Concorrência.** Como vocês garantem que duas pessoas não ficam com a mesma poltrona? Onde estava o
   `await` perigoso?

   **Resposta.** No `bilheteria.reservar(pedido)` (`src/bilheteria.ts`), as poltronas são conferidas e
   marcadas com `evento.reservar(poltronas)` **antes** do `await` do pagamento. O `evento.reservar` é
   síncrono: confere tudo e marca tudo sem nenhum `await` no meio. Como o Node executa o JavaScript numa
   linha só, nenhum outro pedido roda entre "conferir" e "marcar". Quando o pedido chega ao
   `await comTempoLimite(pagar(total), ...)` e devolve o controle ao event loop, as poltronas dele já
   aparecem como vendidas. Um segundo pedido pela mesma poltrona recebe `PoltronaOcupadaErro` (409) e
   nunca chega à operadora, então ninguém é cobrado por uma poltrona que já tem dono.

   O `await` perigoso é o do pagamento. Se a ordem fosse "cobrar e depois marcar", os pedidos
   simultâneos pela mesma poltrona passariam todos pela conferência (a poltrona ainda estaria livre),
   todos seriam cobrados, e só o primeiro conseguiria marcar no final. No teste de 200 pedidos para 50
   poltronas, seriam 200 cobranças para 50 vendas.

   O mesmo `await` resolve o problema "um pedido não espera o outro": enquanto um pedido aguarda a
   operadora, o event loop atende os demais, sem fila e sem trava. Se a operadora recusa ou passa do
   `limitePagamentoMs` (a `comTempoLimite`, com `Promise.race`), o `catch` chama
   `evento.liberar(poltronas)` só com as poltronas **daquele** pedido e lança `PagamentoErro` (502). As
   poltronas voltam à venda.

   *Limitação do modelo:* o `Promise.race` faz a bilheteria **parar de esperar**, mas não cancela a
   cobrança que já foi enviada. Numa operadora real, uma cobrança que termina depois do tempo limite
   poderia ser aprovada mesmo com a poltrona já devolvida. Em produção seria preciso cancelar ou estornar
   essa cobrança (por exemplo com um identificador de idempotência). Isso fica fora do escopo do
   trabalho, que usa a operadora simulada.

2. **OO.** O que o `Evento` esconde e por quê? Por que o `reservar` é tudo ou nada? Por que os erros são uma hierarquia de classes?

   **Resposta.** O `Evento` (`src/dominio.ts`) esconde a lista de poltronas vendidas no campo privado
   `#poltronasVendidas`. O `#` é privado de verdade em tempo de execução: código de fora não lê essa
   lista (`evento.#poltronasVendidas` nem compila) e não a altera. O único jeito de mudar o estado é
   pelos métodos `reservar` e `liberar`, que validam tudo antes. Quem está de fora só lê
   `evento.disponivel`, um `get` sem `set` calculado como `capacidade - vendidas.length`. Por isso ele
   nunca fica inconsistente com a lista, e `evento.disponivel = 999` lança `TypeError` (o módulo roda em
   modo estrito) sem mudar nada.

   O `reservar` é tudo ou nada porque um pedido é de uma família ou grupo: vender só parte das
   poltronas deixaria gente sem lugar e poltronas presas sem dono. Por isso ele primeiro confere a lista
   inteira (vazia, inexistente fora de 1..capacidade, repetida ou já vendida) e só no final marca todas
   de uma vez. Se algo falha, nenhuma é marcada. Pedindo 4, 5 e 6 com a 5 ocupada, o resultado é 409 e
   a 4 e a 6 continuam livres.

   Os erros são uma hierarquia porque todos compartilham o mesmo comportamento (são `Error` com um
   `status` HTTP), e cada tipo representa um caso de negócio diferente. `ErroDeNegocio` é abstrata
   (não faz sentido um erro "genérico") e cada filha fixa o próprio status no `super(mensagem, status)`:
   400, 404, 409 e 502. O `servidor.ts` só precisa de um `instanceof ErroDeNegocio` para responder com
   `erro.status`, sem `if` por tipo de erro. Um erro novo só precisaria de uma classe filha nova.

3. **Funcional.** O que ganhamos com `preco.ts` puro? Como vocês testariam ele sem subir o servidor?

   **Resposta.** Em `src/preco.ts` só há constantes e funções, sem `let`, laços ou mutação:
   - `valorDoIngresso(precoBase)` e `aplicarTaxa(percentual)` são **fábricas**: devolvem uma nova
     função já configurada (`valorDoIngresso(80)` devolve uma função que recebe `"meia"` e devolve 40).
   - `montarIngressos` usa `map` para criar um `Ingresso` **novo** por pessoa, na mesma ordem. Quem
     decide se é meia é a função `temDireitoAMeia` recebida por parâmetro, e a bilheteria passa o
     `direitoAMeia`.
   - `calcularTotal` soma com `reduce` e aplica a taxa chamando `aplicarTaxa(0.1)`.
   - O arredondamento `Math.round(valor * 100) / 100` mantém o valor como número
     (`aplicarTaxa(0.1)(100)` dá `110`, e não `110.00000000000001`).

   O ganho é que a mesma entrada sempre dá a mesma saída, sem efeito colateral: não depende de
   servidor, de rede, de horário nem da ordem em que os pedidos chegam, e não altera as pessoas nem a
   lista recebida (o teste congela os objetos com `Object.freeze` e nada quebra). Por isso o cálculo é
   seguro mesmo com vários pedidos ao mesmo tempo, e pode ser reaproveitado ou trocado (outra regra de
   meia, outra taxa) sem mexer na venda.

   Para testar sem servidor, basta importar e chamar as funções. É o que o `npm test` faz:

   ```ts
   import assert from "node:assert/strict";
   import { valorDoIngresso, aplicarTaxa, montarIngressos, calcularTotal } from "./src/preco.ts";
   assert.equal(valorDoIngresso(80)("meia"), 40);
   assert.equal(aplicarTaxa(0.1)(100), 110);
   const ingressos = montarIngressos(100, pessoas, (p) => p.estudante); // regra qualquer
   assert.equal(calcularTotal(ingressos), 165);                        // 50 + 100 + 10%
   ```

4. **Se fosse em outro paradigma.** Escolham uma das partes e expliquem como ficaria em outro
   paradigma, e se ficaria melhor ou pior.

   **Resposta.** Escolhemos o **preço** (`preco.ts`) no paradigma **imperativo / orientado a objetos**:
   uma classe `CalculadoraDePreco` com um campo `total` mutável e métodos como `adicionarIngresso(pessoa)`,
   que percorre as pessoas com `for`, faz `push` numa lista interna e soma a taxa no final. Funcionaria,
   mas ficaria **pior** para este problema:
   - o resultado passa a depender do estado do objeto e da ordem das chamadas. Esquecer de "zerar" a
     calculadora entre dois pedidos soma valores de clientes diferentes;
   - se a mesma instância fosse compartilhada entre pedidos concorrentes, um pedido poderia somar
     ingressos de outro durante um `await`;
   - para testar seria preciso montar o objeto, chamar métodos em sequência e inspecionar o estado, em
     vez de comparar entrada e saída;
   - a regra da meia tenderia a ficar fixa dentro da classe, em vez de chegar como função por parâmetro.

   A vantagem do OO aqui seria só acumular um carrinho aos poucos, o que este sistema não precisa,
   porque o pedido chega inteiro. Por isso o funcional é a escolha mais adequada para o cálculo, e o OO
   faz mais sentido no `Evento`, onde existe estado que precisa ser protegido.

5. **Concorrente × paralelo.** O Node roda o JavaScript numa linha só: os pedidos de vocês são
   concorrentes, não paralelos. O que mudaria se a venda rodasse em vários núcleos ao mesmo tempo?

   **Resposta.** *Concorrência* é ter várias tarefas em andamento ao mesmo tempo, revezando: enquanto
   um pedido espera a operadora no `await`, outro avança. *Paralelismo* é executar instruções literalmente
   no mesmo instante, em núcleos diferentes. Nosso sistema é concorrente: o Node roda o JavaScript numa
   linha só e só troca de pedido nos `await`. Por isso o trecho síncrono "conferir e marcar" do
   `evento.reservar` nunca é interrompido, e não precisamos de fila nem de trava.

   Com vários núcleos executando a venda sobre o **mesmo** estado, essa garantia acaba. Duas threads
   poderiam executar o `includes` (poltrona livre?) ao mesmo tempo, as duas veriam a poltrona livre e as
   duas fariam o `push`: venda duplicada. A conferência e a marcação precisariam virar uma operação
   atômica, com trava (mutex) por evento, operações atômicas (`Atomics` sobre `SharedArrayBuffer`) ou um
   banco de dados com transação ou restrição de unicidade (`UNIQUE (evento, poltrona)`). Com vários
   **processos** (vários servidores), o problema é ainda maior: cada um teria a própria lista em
   memória, e dois processos poderiam vender a mesma poltrona sem nem perceber. Aí o estado precisaria
   sair da memória para um armazenamento compartilhado com atualização atômica. Em troca, o paralelismo
   aumentaria a vazão de trabalho pesado de CPU, que não é o gargalo aqui: o tempo é gasto esperando a
   operadora.

### Resultados do bench

| Cenário | Pedidos | Tempo (ms) | Vendidos | Poltrona ocupada | Falha de pagamento |
| :--- | ---: | ---: | ---: | ---: | ---: |
| Padrão (`main.ts`) | 200 | 209 | 95 | 100 | 5 |

Execução real com o servidor recém-iniciado (`npm start`) e `npm run bench`, sem alterar nada.
Saída: `200 pedidos em 209 ms (957 pedidos/s)` e `por status HTTP: { '201': 95, '409': 100, '502': 5 }`.
Ao final, o evento 1 ficou com `disponivel: 5`. Os números de 201 e 502 variam a cada execução, porque a
operadora falsa falha aleatoriamente em 10% das cobranças.

O bench ocupa as poltronas do evento 1: para rodar de novo, parem o `npm start` (Ctrl+C) e subam outra
vez.

O que os números mostram:

- **Nenhuma poltrona vendida duas vezes.** Foram 200 pedidos, dois para cada uma das 100 poltronas, e
  houve no máximo uma venda por poltrona: 95 vendidas + 5 devolvidas = 100.
- **Exatamente 100 recusas 409.** O segundo pedido de cada poltrona chegou enquanto o primeiro ainda
  esperava a operadora (80 ms). A poltrona já estava marcada, então ele foi recusado **sem ser cobrado**.
  Isso só acontece porque a marcação vem antes do `await`.
- **5 falhas de pagamento (502).** A operadora falsa recusa cerca de 10% das cobranças, e nesta execução
  foram 5 (perto dos ~10 esperados). As 5 poltronas foram devolvidas pelo `evento.liberar`, e por isso o
  evento terminou com `disponivel: 5` em vez de 0. Elas não foram revendidas no bench porque o pedido
  concorrente pela mesma poltrona já tinha sido recusado antes da falha.
- **Os pedidos não esperam uns pelos outros.** 200 cobranças de 80 ms em sequência levariam cerca de
  16 s (só as 100 cobradas, cerca de 8 s). O bench inteiro levou 209 ms porque as cobranças ficaram
  pendentes ao mesmo tempo enquanto o Node atendia os outros pedidos: concorrência sem paralelismo.
