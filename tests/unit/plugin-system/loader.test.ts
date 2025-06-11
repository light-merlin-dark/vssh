import { describe, it, expect, vi } from 'vitest';
import { PluginLoader } from '../../../src/plugins/loader';
import * as fs from 'fs/promises';

vi.mock('fs/promises');

describe('PluginLoader', () => {
  it('should handle missing plugin directory gracefully', async () => {
    const loader = new PluginLoader('/test/plugins');
    
    vi.mocked(fs.readdir).mockRejectedValue(new Error('ENOENT'));
    
    const plugins = await loader.loadBuiltinPlugins();
    
    expect(plugins).toEqual([]);
  });
});