import { SSHService } from '../../src/services/ssh';

export interface MockResponse {
  command: string;
  output: string;
  error?: string;
  delay?: number;
}

export interface MockScenario {
  name: string;
  responses: MockResponse[];
}

/**
 * MockSSHService - A comprehensive mock for testing plugin commands
 * 
 * Features:
 * - Pattern-based command matching
 * - Pre-configured scenarios
 * - Command history tracking
 * - Error simulation
 * - Connection state management
 */
export class MockSSHService {
  private responses: Map<string, MockResponse> = new Map();
  private executedCommands: string[] = [];
  private connected = true;
  private throwOnConnect = false;
  private scenarios: Map<string, MockScenario> = new Map();

  constructor() {
    this.loadDefaultResponses();
    this.loadDefaultScenarios();
  }

  async connect(): Promise<void> {
    if (this.throwOnConnect) {
      throw new Error('Mock SSH connection failed');
    }
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async executeCommand(command: string): Promise<string> {
    if (!this.connected) {
      throw new Error('SSH not connected');
    }

    this.executedCommands.push(command);

    // Check for exact match first
    if (this.responses.has(command)) {
      const response = this.responses.get(command)!;
      if (response.delay) {
        await new Promise(resolve => setTimeout(resolve, response.delay));
      }
      if (response.error) {
        throw new Error(response.error);
      }
      return response.output;
    }

    // Check for pattern matches
    for (const [pattern, response] of this.responses.entries()) {
      if (pattern.includes('*') || pattern.includes('{{') || pattern.includes('--format')) {
        const regex = this.patternToRegex(pattern);
        if (regex.test(command)) {
          if (response.delay) {
            await new Promise(resolve => setTimeout(resolve, response.delay));
          }
          if (response.error) {
            throw new Error(response.error);
          }
          return response.output;
        }
      }
    }

    // Default response for unknown commands
    return '';
  }

  // Helper methods for testing
  setResponse(command: string, output: string, error?: string, delay?: number): void {
    this.responses.set(command, { command, output, error, delay });
  }

  setScenario(scenarioName: string): void {
    const scenario = this.scenarios.get(scenarioName);
    if (!scenario) {
      throw new Error(`Unknown scenario: ${scenarioName}`);
    }
    
    this.responses.clear();
    this.loadDefaultResponses();
    
    scenario.responses.forEach(response => {
      this.responses.set(response.command, response);
    });
  }

  getExecutedCommands(): string[] {
    return [...this.executedCommands];
  }

  getLastCommand(): string | undefined {
    return this.executedCommands[this.executedCommands.length - 1];
  }

  clearHistory(): void {
    this.executedCommands = [];
  }

  setConnectionError(shouldThrow: boolean): void {
    this.throwOnConnect = shouldThrow;
  }

  setConnected(connected: boolean): void {
    this.connected = connected;
  }

  throwOnCommand(command: string, errorMessage: string): void {
    this.setResponse(command, '', errorMessage);
  }

  private patternToRegex(pattern: string): RegExp {
    // Convert simple patterns to regex
    let regexPattern = pattern
      .replace(/\*/g, '.*')
      .replace(/\{\{[^}]+\}\}/g, '[^|]+')
      .replace(/--format\s+"[^"]+"/g, '--format\\s+"[^"]+');
    
    return new RegExp(`^${regexPattern}$`);
  }

  private loadDefaultResponses(): void {
    // Basic system commands
    this.responses.set('pwd', { command: 'pwd', output: '/root' });
    this.responses.set('whoami', { command: 'whoami', output: 'root' });
    this.responses.set('ls -la', { command: 'ls -la', output: 'drwxr-xr-x 2 root root 4096 Jan 1 00:00 .\ndrwxr-xr-x 3 root root 4096 Jan 1 00:00 ..' });
    this.responses.set('df -h', { command: 'df -h', output: 'Filesystem      Size  Used Avail Use% Mounted on\n/dev/sda1        20G  5.5G   14G  30% /' });
    this.responses.set('free -m', { command: 'free -m', output: '              total        used        free      shared  buff/cache   available\nMem:           7976        1234        5678          12        1064        6543' });
    
    // Docker commands
    this.responses.set('docker ps -a --format "{{.ID}}|{{.Names}}|{{.Status}}|{{.Image}}|{{.Ports}}|{{.CreatedAt}}"', {
      command: 'docker ps -a --format "{{.ID}}|{{.Names}}|{{.Status}}|{{.Image}}|{{.Ports}}|{{.CreatedAt}}"',
      output: ''
    });
    
    this.responses.set('docker network ls --format "{{.ID}}|{{.Name}}|{{.Driver}}|{{.Scope}}"', {
      command: 'docker network ls --format "{{.ID}}|{{.Name}}|{{.Driver}}|{{.Scope}}"',
      output: 'abc123|bridge|bridge|local\ndef456|host|host|local\nghi789|none|null|local'
    });
    
    this.responses.set('docker info --format json', {
      command: 'docker info --format json',
      output: JSON.stringify({
        ServerVersion: '24.0.5',
        Containers: 5,
        ContainersRunning: 3,
        ContainersPaused: 0,
        ContainersStopped: 2,
        Images: 12,
        OSType: 'linux',
        Architecture: 'x86_64',
        MemTotal: 8369217536,
        DockerRootDir: '/var/lib/docker'
      })
    });
    
    // Coolify commands
    this.responses.set('cat /data/coolify/proxy/docker-compose.yml', {
      command: 'cat /data/coolify/proxy/docker-compose.yml',
      output: 'version: "3.8"\nservices:\n  traefik:\n    image: traefik:v2.10'
    });
    
    this.responses.set('ls -la /data/coolify/proxy/dynamic/', {
      command: 'ls -la /data/coolify/proxy/dynamic/',
      output: 'drwxr-xr-x 2 root root 4096 Jan 1 00:00 .\n-rw-r--r-- 1 root root 1234 Jan 1 00:00 app1.yml'
    });
  }

  private loadDefaultScenarios(): void {
    // Scenario: Docker with running containers
    this.scenarios.set('docker_running', {
      name: 'docker_running',
      responses: [
        {
          command: 'docker ps -a --format "{{.ID}}|{{.Names}}|{{.Status}}|{{.Image}}|{{.Ports}}|{{.CreatedAt}}"',
          output: 'abc123|web-app|Up 2 hours|nginx:latest|0.0.0.0:80->80/tcp|2024-01-01 12:00:00 +0000 UTC\ndef456|api-server|Up 1 hour|node:18|0.0.0.0:3000->3000/tcp|2024-01-01 13:00:00 +0000 UTC\nghi789|database|Exited (0) 3 hours ago|postgres:15||2024-01-01 10:00:00 +0000 UTC'
        },
        {
          command: 'docker logs web-app --tail 50',
          output: '2024-01-01 14:00:00 [info] Server started\n2024-01-01 14:00:01 [info] Listening on port 80'
        },
        {
          command: 'docker port web-app',
          output: '80/tcp -> 0.0.0.0:80'
        }
      ]
    });

    // Scenario: Empty Docker environment
    this.scenarios.set('docker_empty', {
      name: 'docker_empty',
      responses: [
        {
          command: 'docker ps -a --format "{{.ID}}|{{.Names}}|{{.Status}}|{{.Image}}|{{.Ports}}|{{.CreatedAt}}"',
          output: ''
        },
        {
          command: 'docker network ls --format "{{.ID}}|{{.Name}}|{{.Driver}}|{{.Scope}}"',
          output: 'abc123|bridge|bridge|local\ndef456|host|host|local\nghi789|none|null|local'
        }
      ]
    });

    // Scenario: Coolify configured
    this.scenarios.set('coolify_configured', {
      name: 'coolify_configured',
      responses: [
        {
          command: 'cat /data/coolify/proxy/docker-compose.yml',
          output: `version: "3.8"
services:
  traefik:
    image: traefik:v2.10
    container_name: coolify-proxy
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - /data/coolify/proxy/dynamic:/dynamic:ro`
        },
        {
          command: 'ls -la /data/coolify/proxy/dynamic/',
          output: `total 16
drwxr-xr-x 2 root root 4096 Jan 1 00:00 .
drwxr-xr-x 3 root root 4096 Jan 1 00:00 ..
-rw-r--r-- 1 root root 1234 Jan 1 00:00 app1.yml
-rw-r--r-- 1 root root 2345 Jan 1 00:00 app2.yml`
        }
      ]
    });
  }
}

// Factory function for creating mock SSH service
export function createMockSSHService(): MockSSHService {
  return new MockSSHService();
}