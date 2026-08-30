import Big from "big.js";
import {
  type CanonicalDecimal,
  canonicalDecimal,
  parseCanonicalDecimal,
} from "../schema/primitives.ts";

Big.strict = true;

export function moneyAdd(
  first: CanonicalDecimal,
  ...rest: readonly CanonicalDecimal[]
): CanonicalDecimal {
  let result = new Big(parseCanonicalDecimal(first));
  for (const value of rest) result = result.plus(parseCanonicalDecimal(value));
  return canonicalDecimal(result.toString());
}

export function moneySubtract(
  first: CanonicalDecimal,
  ...rest: readonly CanonicalDecimal[]
): CanonicalDecimal {
  let result = new Big(parseCanonicalDecimal(first));
  for (const value of rest) result = result.minus(parseCanonicalDecimal(value));
  return canonicalDecimal(result.toString());
}

export function moneyMultiply(
  first: CanonicalDecimal,
  second: CanonicalDecimal,
): CanonicalDecimal {
  return canonicalDecimal(
    new Big(parseCanonicalDecimal(first))
      .times(parseCanonicalDecimal(second))
      .toString(),
  );
}

export function moneyDivide(
  first: CanonicalDecimal,
  second: CanonicalDecimal,
): CanonicalDecimal {
  const divisor = new Big(parseCanonicalDecimal(second));
  if (divisor.cmp("0") === 0) {
    throw new Error("Cannot divide money by zero.");
  }
  return canonicalDecimal(
    new Big(parseCanonicalDecimal(first)).div(divisor).toString(),
  );
}

export function moneyCompare(
  first: CanonicalDecimal,
  second: CanonicalDecimal,
): -1 | 0 | 1 {
  return new Big(parseCanonicalDecimal(first)).cmp(
    parseCanonicalDecimal(second),
  ) as -1 | 0 | 1;
}

export function moneySum(
  values: readonly CanonicalDecimal[],
): CanonicalDecimal {
  if (values.length === 0) return "0";
  return moneyAdd(values[0], ...values.slice(1));
}
