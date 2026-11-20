// Шанс выиграть хоть один приз. Регламент: 50 лотов (15+10+5+3+1+1 основных + 15 бонусных),
// каждый купон тянется один раз и не возвращается. Тогда шанс НЕ выиграть ничего —
// вероятность, что все 50 вытянутых купонов чужие (гипергеометрическое распределение).

export const DRAWS = 50;

export function winProb(k, N, draws = DRAWS) {
  if (k <= 0 || N <= 0) return 0;
  if (N - k < draws) return 1;
  let none = 1;
  for (let i = 0; i < draws; i++) none *= (N - k - i) / (N - i);
  return 1 - none;
}

// Сколько добавит следующий купон (он попадёт и в общий барабан, поэтому N+1).
export function chanceGain(k, N, draws = DRAWS) {
  return winProb(k + 1, N + 1, draws) - winProb(k, N, draws);
}
