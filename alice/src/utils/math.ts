const USDC_DECIMALS = 6;
const SECONDS_PER_DAY = 86400;
const DAYS_PER_YEAR = 365;

export function calculateInterest(principalWei: bigint, aprPercent: number, termDays: number): bigint {
  const bps = Math.round(aprPercent * 100);
  const interest = (principalWei * BigInt(bps) * BigInt(termDays)) / (BigInt(10000) * BigInt(DAYS_PER_YEAR));
  return interest;
}

export function calculateTotalRepayment(principalWei: bigint, aprPercent: number, termDays: number): bigint {
  return principalWei + calculateInterest(principalWei, aprPercent, termDays);
}

export function calculateReserveRatio(totalReserves: bigint, deployedCapital: bigint): number {
  if (totalReserves <= BigInt(0)) return 0;
  const available = totalReserves - deployedCapital;
  if (available <= BigInt(0)) return 0;
  return Number((available * BigInt(10000)) / totalReserves) / 100;
}

export function calculateDefaultRate(totalLoans: number, defaultedLoans: number): number {
  if (totalLoans === 0) return 0;
  return (defaultedLoans / totalLoans) * 100;
}

export function formatUSDC(wei: bigint): string {
  if (wei < BigInt(0)) return `-${formatUSDC(-wei)}`;
  const whole = wei / BigInt(10 ** USDC_DECIMALS);
  const frac = wei % BigInt(10 ** USDC_DECIMALS);
  return `${whole}.${frac.toString().padStart(USDC_DECIMALS, '0')} USDC`;
}

export function parseUSDC(amount: string | number): bigint {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return BigInt(Math.round(num * 10 ** USDC_DECIMALS));
}

export function daysToMs(days: number): number {
  return days * SECONDS_PER_DAY * 1000;
}

export function msToTimestamp(ms: number): number {
  return Math.floor(ms / 1000);
}

export function nowTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}
