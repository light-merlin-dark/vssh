import { RuntimeDependency, VsshPlugin } from '../plugins/types';
import { ProxyService } from './proxy-service';
import { SSHService } from './ssh';

interface DependencyCheckResult {
  dependency: RuntimeDependency;
  isAvailable: boolean;
  error?: string;
}

interface CachedResult {
  result: DependencyCheckResult;
  timestamp: number;
}

export class DependencyChecker {
  private cache = new Map<string, CachedResult>();
  private readonly cacheTTL = 5 * 60 * 1000; // 5 minutes
  
  constructor(
    private sshService: SSHService,
    private proxyService: ProxyService,
    private isLocalExecution: boolean
  ) {}
  
  async checkPluginDependencies(plugin: VsshPlugin): Promise<DependencyCheckResult[]> {
    if (!plugin.runtimeDependencies || plugin.runtimeDependencies.length === 0) {
      return [];
    }
    
    const results = await Promise.all(
      plugin.runtimeDependencies.map(dep => this.checkDependency(dep))
    );
    
    return results;
  }
  
  async checkDependency(dependency: RuntimeDependency): Promise<DependencyCheckResult> {
    const cacheKey = `${dependency.command}-${this.isLocalExecution ? 'local' : 'remote'}`;
    
    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.result;
    }
    
    // Perform check
    const result = await this.performCheck(dependency);
    
    // Cache result
    this.cache.set(cacheKey, {
      result,
      timestamp: Date.now()
    });
    
    return result;
  }
  
  private async performCheck(dependency: RuntimeDependency): Promise<DependencyCheckResult> {
    try {
      // Use the checkCommand if provided, otherwise default to 'which'
      const checkCommand = dependency.checkCommand || `which ${dependency.command}`;
      
      const output = await this.executeCommand(checkCommand);
      
      // If command executed successfully and has output, dependency is available
      const isAvailable = output.trim().length > 0;
      
      return {
        dependency,
        isAvailable,
        error: isAvailable ? undefined : this.getErrorMessage(dependency)
      };
    } catch (error) {
      return {
        dependency,
        isAvailable: false,
        error: this.getErrorMessage(dependency)
      };
    }
  }
  
  private async executeCommand(command: string): Promise<string> {
    if (this.isLocalExecution) {
      // Execute locally
      return await this.sshService.executeCommand(command);
    } else {
      // Execute on remote server via proxy
      const result = await this.proxyService.executeCommand(command, { skipLogging: true });
      return result.output;
    }
  }
  
  private getErrorMessage(dependency: RuntimeDependency): string {
    const location = this.isLocalExecution ? 'locally' : 'on the server';
    const baseMessage = `${dependency.displayName} is not installed ${location}.`;
    
    if (dependency.installHint) {
      return `${baseMessage} ${dependency.installHint}`;
    }
    
    return `${baseMessage} Please install ${dependency.displayName} to use this functionality.`;
  }
  
  clearCache(): void {
    this.cache.clear();
  }
  
  assertAllDependenciesAvailable(results: DependencyCheckResult[]): void {
    const missing = results.filter(r => !r.isAvailable && !r.dependency.optional);
    
    if (missing.length > 0) {
      const errors = missing.map(r => `• ${r.error}`).join('\n');
      throw new Error(`Missing required dependencies:\n${errors}`);
    }
  }
}