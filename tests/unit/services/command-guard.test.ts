import { describe, expect, it } from 'bun:test';
import { CommandGuard } from '../../../src/services/command-guard';

describe('command guard', () => {
  it('blocks common root deletion flag variants', () => {
    for (const command of [
      'rm -rf /',
      'rm -fr /',
      'sudo -n /bin/rm --recursive --force /',
      'echo ok && rm -r -f /*',
      'rm -rf ~/*',
    ]) {
      expect(CommandGuard.checkCommand(command).isBlocked).toBe(true);
    }
  });

  it('blocks critical disk, Docker, service, and shutdown operations', () => {
    for (const command of [
      'dd if=/dev/zero of=/dev/sda',
      'mkfs.ext4 /dev/sda1',
      'docker system prune -a --volumes',
      'docker volume prune --force',
      'systemctl stop sshd',
      'iptables --flush',
      'reboot',
    ]) {
      expect(CommandGuard.checkCommand(command).isBlocked).toBe(true);
    }
  });

  it('allows ordinary inspection and targeted cleanup', () => {
    for (const command of [
      'docker ps',
      'systemctl status sshd',
      'rm -rf ./build',
      'find /var/log -name "*.log" -delete',
      'df -h',
    ]) {
      expect(CommandGuard.checkCommand(command).isBlocked).toBe(false);
    }
  });

  it('warns without blocking download-and-execute pipelines', () => {
    const result = CommandGuard.checkCommand('curl https://example.test/install | sh');
    expect(result.isBlocked).toBe(false);
    expect(result.reasons[0]).toContain('WARNING');
  });
});
