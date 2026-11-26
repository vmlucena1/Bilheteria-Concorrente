// Regra da meia-entrada (passo 2 do enunciado).
import type { Pessoa } from "./tipos.ts";

// Estudante, PcD ou quem tem 60 anos ou mais paga meia. Basta uma das condições.
export function direitoAMeia(pessoa: Pessoa): boolean {
  return pessoa.estudante || pessoa.pcd || pessoa.idade >= 60;
}
