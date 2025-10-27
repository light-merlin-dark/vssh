import { describe, it, expect, spyOn } from 'bun:test';
import { PluginLoader } from '../../../src/plugins/loader';
import * as fs from 'fs/promises';

describe('PluginLoader', () => {
  it('should handle missing plugin directory gracefully', async () => {
    const loader = new PluginLoader('/test/plugins');

    spyOn(fs, 'readdir').mockRejectedValue(new Error('ENOENT'));

    const plugins = await loader.loadBuiltinPlugins();

    expect(plugins).toEqual([]);
  });
});
