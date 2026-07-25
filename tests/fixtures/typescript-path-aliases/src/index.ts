import { formatCurrency } from "@lib/format";

export function describeAmount(amount: number): string {
  return `Amount: ${formatCurrency(amount)}`;
}
