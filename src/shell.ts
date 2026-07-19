export function shellQuote(value: string): string {
  if (value === '') return "''";
  if (/^[A-Za-z0-9_@%+=:,./-]+$/.test(value)) return value;
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

export function commandFromArgs(args: string[], literal = false): string {
  if (args.length === 0) return '';
  if (literal || args.length === 1) return args[0];
  return args.map(shellQuote).join(' ');
}
