export interface CommandGuardResult {
  isBlocked: boolean;
  reasons: string[];
  rule?: string;
}
