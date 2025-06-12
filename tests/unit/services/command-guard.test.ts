import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CommandGuardService } from '../../../src/services/command-guard-service';
import { CommandGuard } from '../../../src/services/command-guard';
import { CommandGuardExtension } from '../../../src/plugins/types';
import * as fs from 'fs';

// Mock fs module
vi.mock('fs');

describe('CommandGuardService', () => {
  let guardService: CommandGuardService;
  
  beforeEach(() => {
    guardService = new CommandGuardService();
    vi.clearAllMocks();
  });
  
  afterEach(() => {
    guardService.clearExtensions();
  });
  
  describe('Built-in Guards', () => {
    it('should block root filesystem deletion commands', () => {
      const dangerousCommands = [
        'rm -rf /',
        'sudo rm -rf /',
        'rm -rf /*',
        'rm --no-preserve-root -rf /',
        'sudo rm -rf / --no-preserve-root'
      ];
      
      dangerousCommands.forEach(cmd => {
        const result = guardService.checkCommand(cmd);
        expect(result.isBlocked).toBe(true);
        expect(result.reasons[0]).toMatch(/root|filesystem/i);
      });
    });
    
    it('should block critical system directory deletion', () => {
      const criticalDirs = ['etc', 'var', 'usr', 'bin', 'sbin', 'lib', 'boot'];
      
      criticalDirs.forEach(dir => {
        const result = guardService.checkCommand(`rm -rf /${dir}`);
        expect(result.isBlocked).toBe(true);
        expect(result.reasons[0]).toMatch(/critical system directory/i);
      });
    });
    
    it('should block direct disk write operations', () => {
      const diskOps = [
        'dd if=/dev/zero of=/dev/sda',
        'dd of=/dev/hda',
        'echo test > /dev/sdb',
        'mkfs.ext4 /dev/sda1',
        'fdisk /dev/sda',
        'parted /dev/sda'
      ];
      
      diskOps.forEach(cmd => {
        const result = guardService.checkCommand(cmd);
        expect(result.isBlocked).toBe(true);
        expect(result.reasons[0]).toMatch(/disk|filesystem/i);
      });
    });
    
    it('should block dangerous Docker operations', () => {
      const dockerOps = [
        'docker system prune -a --volumes',
        'docker system prune --volumes -a',
        'docker volume prune -f',
        'docker compose down --volumes',
        'docker-compose down --volumes'
      ];
      
      dockerOps.forEach(cmd => {
        const result = guardService.checkCommand(cmd);
        expect(result.isBlocked).toBe(true);
        expect(result.reasons[0]).toMatch(/docker.*dangerous/i);
      });
    });
    
    it('should block critical service disruption', () => {
      const serviceOps = [
        'systemctl stop docker',
        'sudo systemctl disable ssh',
        'service sshd stop',
        'systemctl mask docker'
      ];
      
      serviceOps.forEach(cmd => {
        const result = guardService.checkCommand(cmd);
        expect(result.isBlocked).toBe(true);
        expect(result.reasons[0]).toMatch(/critical service/i);
      });
    });
    
    it('should block system shutdown/reboot commands', () => {
      const shutdownOps = [
        'shutdown -h now',
        'sudo poweroff',
        'reboot',
        'init 0',
        'halt'
      ];
      
      shutdownOps.forEach(cmd => {
        const result = guardService.checkCommand(cmd);
        expect(result.isBlocked).toBe(true);
        expect(result.reasons[0]).toMatch(/shutdown|reboot/i);
      });
    });
    
    it('should allow safe commands', () => {
      const safeCommands = [
        'ls -la',
        'docker ps',
        'cat /etc/hosts',
        'grep error /var/log/syslog',
        'systemctl status docker',
        'df -h',
        'free -m'
      ];
      
      safeCommands.forEach(cmd => {
        const result = guardService.checkCommand(cmd);
        expect(result.isBlocked).toBe(false);
        expect(result.reasons).toHaveLength(0);
      });
    });
    
    it('should handle commands with complex patterns', () => {
      // Should block
      expect(guardService.checkCommand('find / -name "*.log" -exec rm -rf {} \\;').isBlocked).toBe(false);
      expect(guardService.checkCommand('tar -czf backup.tar.gz / && rm -rf /').isBlocked).toBe(true);
      
      // Should allow
      expect(guardService.checkCommand('rm -rf ./temp-dir').isBlocked).toBe(false);
      expect(guardService.checkCommand('docker rm container-name').isBlocked).toBe(false);
    });
  });
  
  describe('Plugin Extensions', () => {
    it('should check plugin extensions after built-in guards', () => {
      const extension: CommandGuardExtension = {
        category: 'test-plugin',
        patterns: [/test-dangerous-command/],
        message: 'Test plugin blocked this command'
      };
      
      guardService.addExtensions([extension]);
      
      const result = guardService.checkCommand('test-dangerous-command --force');
      expect(result.isBlocked).toBe(true);
      expect(result.reasons[0]).toBe('Test plugin blocked this command');
      expect(result.rule).toBe('test-plugin');
    });
    
    it('should support multiple extensions', () => {
      const extensions: CommandGuardExtension[] = [
        {
          category: 'plugin1',
          patterns: [/plugin1-block/],
          message: 'Plugin 1 blocked'
        },
        {
          category: 'plugin2',
          patterns: [/plugin2-block/],
          message: 'Plugin 2 blocked'
        }
      ];
      
      guardService.addExtensions(extensions);
      
      expect(guardService.checkCommand('plugin1-block').isBlocked).toBe(true);
      expect(guardService.checkCommand('plugin2-block').isBlocked).toBe(true);
      expect(guardService.checkCommand('safe-command').isBlocked).toBe(false);
    });
    
    it('should clear extensions', () => {
      const extension: CommandGuardExtension = {
        category: 'test',
        patterns: [/test-block/],
        message: 'Blocked'
      };
      
      guardService.addExtensions([extension]);
      expect(guardService.checkCommand('test-block').isBlocked).toBe(true);
      
      guardService.clearExtensions();
      expect(guardService.checkCommand('test-block').isBlocked).toBe(false);
    });
    
    it('should prioritize built-in guards over extensions', () => {
      const extension: CommandGuardExtension = {
        category: 'custom',
        patterns: [/rm -rf \//],
        message: 'Custom message for rm -rf /'
      };
      
      guardService.addExtensions([extension]);
      
      const result = guardService.checkCommand('rm -rf /');
      expect(result.isBlocked).toBe(true);
      // Should use built-in message, not extension message
      expect(result.reasons[0]).toMatch(/root filesystem/i);
    });
  });
  
  describe('Logging and Display', () => {
    it('should delegate display to CommandGuard', () => {
      // Mock console.error to prevent output during tests
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const displaySpy = vi.spyOn(CommandGuard, 'displayBlockedMessage');
      const command = 'rm -rf /';
      const result = guardService.checkCommand(command);
      
      guardService.displayBlockedMessage(command, result);
      
      expect(displaySpy).toHaveBeenCalledWith(command, result);
      
      // Restore console.error
      consoleErrorSpy.mockRestore();
    });
    
    it('should delegate logging to CommandGuard', () => {
      const logSpy = vi.spyOn(CommandGuard, 'logBlockedCommand');
      const command = 'rm -rf /';
      const result = guardService.checkCommand(command);
      
      guardService.logBlockedCommand(command, result);
      
      expect(logSpy).toHaveBeenCalledWith(command, result);
    });
  });
  
  describe('Edge Cases', () => {
    it('should handle empty commands', () => {
      const result = guardService.checkCommand('');
      expect(result.isBlocked).toBe(false);
      expect(result.reasons).toHaveLength(0);
    });
    
    it('should handle whitespace-only commands', () => {
      const result = guardService.checkCommand('   \n\t  ');
      expect(result.isBlocked).toBe(false);
      expect(result.reasons).toHaveLength(0);
    });
    
    it('should handle commands with special characters', () => {
      const commands = [
        'echo "hello world" > script.sh',  // Should not block - safe echo
        'cat << EOF\nsome content\nEOF',   // Should not block - safe heredoc
        '# this is a comment',             // Should not block - comment
        'history | grep "docker"'          // Should not block - safe history search
      ];
      
      commands.forEach(cmd => {
        const result = guardService.checkCommand(cmd);
        expect(result.isBlocked).toBe(false);
      });
    });
    
    it('should detect dangerous patterns regardless of position', () => {
      const commands = [
        'echo test && rm -rf /',
        'ls -la; sudo rm -rf /',
        'cd /tmp || rm -rf /'
      ];
      
      commands.forEach(cmd => {
        const result = guardService.checkCommand(cmd);
        expect(result.isBlocked).toBe(true);
      });
    });
  });
});