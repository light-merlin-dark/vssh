/**
 * @vssh/test-utils
 * 
 * Shared testing utilities for vssh plugins.
 * These utilities help plugin developers write consistent, 
 * efficient tests without duplicating mock implementations.
 */

export { createMockContext } from './mock-context';
export { MockSSHService, createMockSSHService } from './mock-ssh-service';
export { captureOutput } from './capture-output';
export { loadFixture } from './fixtures';
export type { MockResponse, MockScenario } from './mock-ssh-service';
export type { PluginTestContext } from './mock-context';