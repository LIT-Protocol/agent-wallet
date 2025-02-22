/**
 * Converts a decimal amount to atomic units based on decimals
 * @param amount - The amount in decimal format (e.g. "1.5")
 * @param decimals - The number of decimal places
 * @returns The amount in atomic units as a string
 */
export function toAtomicAmount(amount: string, decimals: number): string {
  try {
    amount = amount.replace(/,/g, '');
    const [whole = '0', fraction = ''] = amount.split('.');
    const cleanFraction = fraction.replace(/0+$/, '');
    const paddedFraction = cleanFraction.padEnd(decimals, '0');
    const atomicAmount = `${whole}${paddedFraction}`;
    return atomicAmount.replace(/^0+/, '') || '0';
  } catch (error) {
    throw new Error(`Failed to convert amount ${amount} to atomic units: ${error}`);
  }
}