import { PluginContext, VsshConfig } from '../../src/plugins/types';
import { MockSSHService, createMockSSHService } from './mock-ssh-service';
import { CommandGuardService } from '../../src/services/command-guard-service';
import { ProxyService } from '../../src/services/proxy-service';
import { Config } from '../../src/config';

export interface PluginTestContext {
  context: PluginContext;
  mockSSH: MockSSHService;
  logger: {
    info: (...args: any[]) => void;
    warn: (...args: any[]) => void;
    error: (...args: any[]) => void;
    debug: (...args: any[]) => void;
  };
  config: VsshConfig;
}

/**
 * Creates a mock plugin context for testing
 * 
 * @param config - Optional config overrides
 * @returns Object containing the context and helper utilities
 */
export function createMockContext(configOverrides: Partial<VsshConfig> = {}): PluginTestContext {
  const mockSSH = createMockSSHService();
  const commandGuard = new CommandGuardService();
  
  const config: VsshConfig = {
    host: 'test.example.com',
    user: 'testuser',
    keyPath: '/home/testuser/.ssh/test_rsa',
    localMode: false,
    plugins: {
      enabled: ['test-plugin'],
      disabled: [],
      config: {}
    },
    ...configOverrides
  };
  
  // Create ProxyService with mock SSH
  const proxyService = new ProxyService(config as Config, mockSSH as any, commandGuard);
  
  // Create simple spy functions for logging
  const logs: { [key: string]: any[] } = {
    info: [],
    warn: [],
    error: [],
    debug: []
  };
  
  const logger = {
    info: (...args: any[]) => { logs.info.push(args); },
    warn: (...args: any[]) => { logs.warn.push(args); },
    error: (...args: any[]) => { logs.error.push(args); },
    debug: (...args: any[]) => { logs.debug.push(args); }
  };
  
  // Add helper to access logs
  (logger as any).getLogs = () => logs;
  
  // Create a map to store loaded plugins
  const plugins = new Map<string, any>();
  
  const context: PluginContext = {
    sshService: mockSSH as any,
    commandGuard,
    config,
    logger,
    proxyService,
    isLocalExecution: config.localMode || false,
    getPlugin: (name: string) => plugins.get(name)
  };
  
  // Add helper to register plugins for testing dependencies
  (context as any).registerPlugin = (name: string, plugin: any) => {
    plugins.set(name, plugin);
  };
  
  return {
    context,
    mockSSH,
    logger,
    config
  };
}