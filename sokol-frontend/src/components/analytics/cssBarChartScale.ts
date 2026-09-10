export function niceMax(value: number) {
  if (value <= 0) {
    return 5;
  }
  const step = value <= 10 ? 2 : 5;
  const rounded = Math.ceil(value / step) * step;
  return rounded === value ? rounded + step : rounded;
}

export function axisTicks(max: number) {
  const step = max <= 10 ? 2 : 5;
  const ticks: number[] = [];
  for (let value = 0; value <= max; value += step) {
    ticks.push(value);
  }
  return ticks;
}
