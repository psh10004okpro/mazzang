import Decimal from "break_infinity.js";

const KR_UNITS: [number, string][] = [
  [16, "경"],
  [12, "조"],
  [8, "억"],
  [4, "만"],
];

/**
 * 한국식 단위 표기
 * - 1만 미만: 콤마 정수 (9,999)
 * - 1만 이상: 만/억/조/경
 */
export function formatNumber(value: Decimal | number, decimals = 1): string {
  const d = value instanceof Decimal ? value : new Decimal(value);

  if (d.lt(10000)) {
    const n = Math.floor(d.toNumber());
    return n.toLocaleString("ko-KR");
  }

  for (const [exp, unit] of KR_UNITS) {
    const threshold = Decimal.pow(10, exp);
    if (d.gte(threshold)) {
      const scaled = d.div(threshold);
      return scaled.toFixed(decimals) + unit;
    }
  }

  return d.toExponential(2);
}

/**
 * 화폐 표시 (뒤에 "원" 붙임)
 * - "1,234원", "1.5만원", "3.2억원"
 */
export function formatCurrency(value: Decimal | number): string {
  return formatNumber(value) + "원";
}
