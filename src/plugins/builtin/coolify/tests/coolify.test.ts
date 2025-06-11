import { describe, it, expect } from 'vitest';
import coolifyPlugin from '../index';

describe('Coolify Plugin', () => {
  it('should have correct plugin metadata', () => {
    expect(coolifyPlugin.name).toBe('coolify');
    expect(coolifyPlugin.version).toBe('1.0.0');
    expect(coolifyPlugin.description).toBe('Coolify-specific management commands');
  });
  
  it('should depend on docker plugin', () => {
    expect(coolifyPlugin.dependencies).toContain('docker');
  });
  
  it('should export 2 commands', () => {
    expect(coolifyPlugin.commands).toHaveLength(2);
    
    const commandNames = coolifyPlugin.commands.map(cmd => cmd.name);
    expect(commandNames).toContain('get-coolify-proxy-config');
    expect(commandNames).toContain('list-coolify-dynamic-configs');
  });
  
  it('should have command guards for Coolify protection', () => {
    expect(coolifyPlugin.commandGuards).toBeDefined();
    expect(coolifyPlugin.commandGuards!.length).toBeGreaterThan(0);
    
    const coolifyGuard = coolifyPlugin.commandGuards!.find(g => g.category === 'coolify');
    expect(coolifyGuard).toBeDefined();
    expect(coolifyGuard!.patterns.length).toBeGreaterThan(0);
  });
});