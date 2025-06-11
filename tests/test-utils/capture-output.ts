export interface CapturedOutput {
  stdout: string;
  stderr: string;
}

/**
 * Captures console output (stdout and stderr) during test execution
 * 
 * @param fn - The function to execute while capturing output
 * @returns Object containing captured stdout and stderr
 * 
 * @example
 * const { stdout, stderr } = await captureOutput(async () => {
 *   await myCommand();
 * });
 * expect(stdout).toContain('Expected output');
 */
export async function captureOutput(
  fn: () => void | Promise<void>
): Promise<CapturedOutput> {
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;
  const originalInfo = console.info;
  
  let stdout = '';
  let stderr = '';
  
  // Capture all console methods
  console.log = (...args: any[]) => {
    stdout += args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ') + '\n';
  };
  
  console.info = (...args: any[]) => {
    stdout += args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ') + '\n';
  };
  
  console.error = (...args: any[]) => {
    stderr += args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ') + '\n';
  };
  
  console.warn = (...args: any[]) => {
    stderr += args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ') + '\n';
  };
  
  try {
    await fn();
  } finally {
    // Restore original console methods
    console.log = originalLog;
    console.error = originalError;
    console.warn = originalWarn;
    console.info = originalInfo;
  }
  
  return { stdout, stderr };
}

/**
 * Helper to parse table output from captured stdout
 * 
 * @param output - The captured output string
 * @returns Object with headers and rows arrays
 */
export function parseTableOutput(output: string): { headers: string[]; rows: string[][] } {
  const lines = output.trim().split('\n').filter(line => line.trim());
  if (lines.length === 0) return { headers: [], rows: [] };
  
  // Assume first line is headers
  const headers = lines[0].split(/\s{2,}/).map(h => h.trim());
  
  // Skip separator line if present (like -----)
  const dataStartIndex = lines[1]?.match(/^[\-\s]+$/) ? 2 : 1;
  
  const rows = lines.slice(dataStartIndex).map(line => 
    line.split(/\s{2,}/).map(cell => cell.trim())
  );
  
  return { headers, rows };
}