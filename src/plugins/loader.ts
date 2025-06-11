import { VsshPlugin } from './types';
import * as path from 'path';
import * as fs from 'fs/promises';

export class PluginLoader {
  private builtinDir: string;
  
  constructor(builtinDir: string = path.join(__dirname, 'builtin')) {
    this.builtinDir = builtinDir;
  }
  
  async loadBuiltinPlugins(): Promise<VsshPlugin[]> {
    const plugins: VsshPlugin[] = [];
    
    try {
      const entries = await fs.readdir(this.builtinDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const pluginPath = path.join(this.builtinDir, entry.name);
          const plugin = await this.loadPlugin(pluginPath);
          if (plugin) {
            plugins.push(plugin);
          }
        }
      }
    } catch (error: any) {
      // Built-in directory might not exist yet
      console.debug('No built-in plugins directory found');
    }
    
    return plugins;
  }
  
  async loadPlugin(pluginPath: string): Promise<VsshPlugin | null> {
    try {
      const indexPath = path.join(pluginPath, 'index.ts');
      const indexJsPath = path.join(pluginPath, 'index.js');
      
      // Check if plugin exists
      const hasTs = await this.fileExists(indexPath);
      const hasJs = await this.fileExists(indexJsPath);
      
      if (!hasTs && !hasJs) {
        console.warn(`Plugin at ${pluginPath} has no index file`);
        return null;
      }
      
      // Import the plugin
      const module = await import(pluginPath);
      const plugin = module.default || module.plugin;
      
      if (!plugin) {
        console.warn(`Plugin at ${pluginPath} has no default export`);
        return null;
      }
      
      // Validate plugin structure
      if (!this.isValidPlugin(plugin)) {
        console.warn(`Plugin at ${pluginPath} has invalid structure`);
        return null;
      }
      
      return plugin;
    } catch (error: any) {
      console.error(`Failed to load plugin from ${pluginPath}:`, error);
      return null;
    }
  }
  
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
  
  private isValidPlugin(plugin: any): plugin is VsshPlugin {
    return (
      typeof plugin === 'object' &&
      typeof plugin.name === 'string' &&
      typeof plugin.version === 'string' &&
      typeof plugin.description === 'string' &&
      Array.isArray(plugin.commands) &&
      plugin.commands.every((cmd: any) => 
        typeof cmd === 'object' &&
        typeof cmd.name === 'string' &&
        typeof cmd.description === 'string' &&
        typeof cmd.handler === 'function'
      )
    );
  }
}