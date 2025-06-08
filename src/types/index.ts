export interface SSHConfig {
  host: string;
  user: string;
  keyPath: string;
}

export interface CommandGuardResult {
  isBlocked: boolean;
  reasons: string[];
  rule?: string;
}