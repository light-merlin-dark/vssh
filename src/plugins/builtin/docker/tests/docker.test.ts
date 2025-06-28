import { describe, it, expect } from 'vitest';
import dockerPlugin from '../index';

describe('Docker Plugin', () => {
  it('should have correct plugin metadata', () => {
    expect(dockerPlugin.name).toBe('docker');
    expect(dockerPlugin.version).toBe('2.0.0');
    expect(dockerPlugin.description).toBe('Docker container management commands with enhanced MCP support');
  });
  
  it('should export 6 commands', () => {
    expect(dockerPlugin.commands).toHaveLength(6);
    
    const commandNames = dockerPlugin.commands.map(cmd => cmd.name);
    expect(commandNames).toContain('list-docker-containers');
    expect(commandNames).toContain('get-docker-container');
    expect(commandNames).toContain('show-docker-logs');
    expect(commandNames).toContain('list-docker-ports');
    expect(commandNames).toContain('list-docker-networks');
    expect(commandNames).toContain('show-docker-info');
  });
  
  it('should have proper aliases for all commands', () => {
    const aliasMap = new Map<string, string>();
    
    dockerPlugin.commands.forEach(cmd => {
      if (cmd.aliases) {
        cmd.aliases.forEach(alias => {
          aliasMap.set(alias, cmd.name);
        });
      }
    });
    
    expect(aliasMap.get('ldc')).toBe('list-docker-containers');
    expect(aliasMap.get('gdc')).toBe('get-docker-container');
    expect(aliasMap.get('sdl')).toBe('show-docker-logs');
    expect(aliasMap.get('ldp')).toBe('list-docker-ports');
    expect(aliasMap.get('ldn')).toBe('list-docker-networks');
    expect(aliasMap.get('sdi')).toBe('show-docker-info');
  });
  
  it('should have MCP names for all commands', () => {
    const mcpNames = dockerPlugin.commands
      .filter(cmd => cmd.mcpName)
      .map(cmd => cmd.mcpName);
    
    expect(mcpNames).toContain('list_docker_containers');
    expect(mcpNames).toContain('get_docker_container');
    expect(mcpNames).toContain('show_docker_logs');
    expect(mcpNames).toContain('list_docker_ports');
    expect(mcpNames).toContain('list_docker_networks');
    expect(mcpNames).toContain('show_docker_info');
  });
  
  it('should not have dependencies', () => {
    expect(dockerPlugin.dependencies).toBeUndefined();
  });
});