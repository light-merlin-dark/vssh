import { VsshPlugin, PluginContext, PluginCommand, McpToolDefinition, CommandGuardExtension, VsshConfig, Logger } from './types';
import { SSHService } from '../services/ssh';
import { CommandGuardService } from '../services/command-guard-service';
import { ProxyService } from '../services/proxy-service';

export class PluginRegistry {
  private plugins: Map<string, VsshPlugin> = new Map();
  private enabled: Set<string> = new Set();
  private _context: PluginContext;
  private commandMap: Map<string, { plugin: VsshPlugin; command: PluginCommand }> = new Map();
  
  get context(): PluginContext {
    return this._context;
  }
  
  constructor(
    sshService: SSHService,
    commandGuard: CommandGuardService,
    config: VsshConfig,
    logger: Logger,
    proxyService: ProxyService,
    isLocalExecution: boolean = false
  ) {
    this._context = {
      sshService,
      commandGuard,
      config,
      logger,
      proxyService,
      isLocalExecution,
      getPlugin: (name: string) => this.plugins.get(name),
    };
    
    // Load enabled plugins from config
    if (config.plugins?.enabled) {
      config.plugins.enabled.forEach(name => this.enabled.add(name));
    }
    
    // Always enable the proxy plugin
    this.enabled.add('proxy');
  }
  
  async loadPlugin(plugin: VsshPlugin): Promise<void> {
    const { name } = plugin;
    
    if (this.plugins.has(name)) {
      throw new Error(`Plugin ${name} is already loaded`);
    }
    
    // Check for circular dependencies
    if (this.hasCircularDependency(plugin)) {
      throw new Error(`Circular dependency detected for plugin ${name}`);
    }
    
    // Validate dependencies exist
    if (plugin.dependencies) {
      for (const dep of plugin.dependencies) {
        if (!this.plugins.has(dep)) {
          throw new Error(`Plugin ${name} depends on ${dep}, which is not loaded`);
        }
      }
    }
    
    this.plugins.set(name, plugin);
    
    // Call onLoad hook if plugin is enabled
    if (this.enabled.has(name)) {
      await this.activatePlugin(plugin);
    }
  }
  
  async unloadPlugin(name: string): Promise<void> {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      throw new Error(`Plugin ${name} is not loaded`);
    }
    
    // Check if other plugins depend on this one
    const dependents = this.getDependentPlugins(name);
    if (dependents.length > 0) {
      throw new Error(
        `Cannot unload plugin ${name}: ${dependents.join(', ')} depend on it`
      );
    }
    
    // Call onUnload hook if plugin is enabled
    if (this.enabled.has(name)) {
      await this.deactivatePlugin(plugin);
    }
    
    this.plugins.delete(name);
  }
  
  async enablePlugin(name: string): Promise<void> {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      throw new Error(`Plugin ${name} is not loaded`);
    }
    
    if (this.enabled.has(name)) {
      return; // Already enabled
    }
    
    // Enable dependencies first
    if (plugin.dependencies) {
      for (const dep of plugin.dependencies) {
        await this.enablePlugin(dep);
      }
    }
    
    this.enabled.add(name);
    await this.activatePlugin(plugin);
    
    // Update command guard extensions
    this._context.commandGuard.clearExtensions();
    this._context.commandGuard.addExtensions(this.getCommandGuardExtensions());
    
    // Update config
    if (!this._context.config.plugins) {
      this._context.config.plugins = {};
    }
    this._context.config.plugins.enabled = Array.from(this.enabled);
  }
  
  async disablePlugin(name: string): Promise<void> {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      throw new Error(`Plugin ${name} is not loaded`);
    }
    
    // Prevent disabling the proxy plugin
    if (name === 'proxy') {
      throw new Error('The proxy plugin cannot be disabled');
    }
    
    if (!this.enabled.has(name)) {
      return; // Already disabled
    }
    
    // Check if enabled plugins depend on this one
    const enabledDependents = this.getDependentPlugins(name).filter(p => 
      this.enabled.has(p)
    );
    if (enabledDependents.length > 0) {
      throw new Error(
        `Cannot disable plugin ${name}: ${enabledDependents.join(', ')} depend on it`
      );
    }
    
    await this.deactivatePlugin(plugin);
    this.enabled.delete(name);
    
    // Update command guard extensions
    this._context.commandGuard.clearExtensions();
    this._context.commandGuard.addExtensions(this.getCommandGuardExtensions());
    
    // Update config
    if (this._context.config.plugins) {
      this._context.config.plugins.enabled = Array.from(this.enabled);
    }
  }
  
  getEnabledPlugins(): VsshPlugin[] {
    return Array.from(this.enabled)
      .map(name => this.plugins.get(name))
      .filter((p): p is VsshPlugin => p !== undefined);
  }
  
  getAllPlugins(): VsshPlugin[] {
    return Array.from(this.plugins.values());
  }
  
  getPlugin(name: string): VsshPlugin | undefined {
    return this.plugins.get(name);
  }
  
  isEnabled(name: string): boolean {
    return this.enabled.has(name);
  }
  
  getCommand(nameOrAlias: string): PluginCommand | undefined {
    const entry = this.commandMap.get(nameOrAlias);
    return entry?.command;
  }
  
  getCommandPlugin(nameOrAlias: string): VsshPlugin | undefined {
    const entry = this.commandMap.get(nameOrAlias);
    return entry?.plugin;
  }
  
  getAllCommands(): PluginCommand[] {
    const commands: PluginCommand[] = [];
    const seen = new Set<string>();
    
    for (const [key, entry] of this.commandMap.entries()) {
      if (key === entry.command.name && !seen.has(key)) {
        commands.push(entry.command);
        seen.add(key);
      }
    }
    
    return commands;
  }
  
  getMcpTools(): McpToolDefinition[] {
    const tools: McpToolDefinition[] = [];
    
    for (const plugin of this.getEnabledPlugins()) {
      if (plugin.mcpTools) {
        tools.push(...plugin.mcpTools);
      }
      
      // Also generate tools from commands with mcpName
      for (const command of plugin.commands) {
        if (command.mcpName) {
          tools.push({
            name: command.mcpName,
            description: command.description,
            inputSchema: {
              type: 'object',
              properties: {
                args: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Command arguments',
                },
              },
            },
          });
        }
      }
    }
    
    return tools;
  }
  
  getCommandGuardExtensions(): CommandGuardExtension[] {
    const extensions: CommandGuardExtension[] = [];
    
    for (const plugin of this.getEnabledPlugins()) {
      if (plugin.commandGuards) {
        extensions.push(...plugin.commandGuards);
      }
    }
    
    return extensions;
  }
  
  private async activatePlugin(plugin: VsshPlugin): Promise<void> {
    // Register commands
    for (const command of plugin.commands) {
      this.registerCommand(plugin, command);
    }
    
    // Call onLoad hook
    if (plugin.onLoad) {
      await plugin.onLoad(this.context);
    }
    
    this._context.logger.info(`Plugin ${plugin.name} activated`);
  }
  
  private async deactivatePlugin(plugin: VsshPlugin): Promise<void> {
    // Call onUnload hook
    if (plugin.onUnload) {
      await plugin.onUnload();
    }
    
    // Unregister commands
    for (const command of plugin.commands) {
      this.unregisterCommand(command);
    }
    
    this._context.logger.info(`Plugin ${plugin.name} deactivated`);
  }
  
  private registerCommand(plugin: VsshPlugin, command: PluginCommand): void {
    // Register main command name
    this.commandMap.set(command.name, { plugin, command });
    
    // Register aliases
    if (command.aliases) {
      for (const alias of command.aliases) {
        if (this.commandMap.has(alias)) {
          this._context.logger.warn(
            `Alias ${alias} for command ${command.name} conflicts with existing command`
          );
        } else {
          this.commandMap.set(alias, { plugin, command });
        }
      }
    }
  }
  
  private unregisterCommand(command: PluginCommand): void {
    this.commandMap.delete(command.name);
    
    if (command.aliases) {
      for (const alias of command.aliases) {
        this.commandMap.delete(alias);
      }
    }
  }
  
  private hasCircularDependency(plugin: VsshPlugin, visited = new Set<string>()): boolean {
    if (visited.has(plugin.name)) {
      return true;
    }
    
    visited.add(plugin.name);
    
    if (plugin.dependencies) {
      for (const dep of plugin.dependencies) {
        const depPlugin = this.plugins.get(dep);
        if (depPlugin && this.hasCircularDependency(depPlugin, new Set(visited))) {
          return true;
        }
      }
    }
    
    return false;
  }
  
  private getDependentPlugins(pluginName: string): string[] {
    const dependents: string[] = [];
    
    for (const [name, plugin] of this.plugins) {
      if (plugin.dependencies && plugin.dependencies.includes(pluginName)) {
        dependents.push(name);
      }
    }
    
    return dependents;
  }
  
  private resolveDependencies(plugin: VsshPlugin): string[] {
    const resolved: string[] = [];
    const visited = new Set<string>();
    
    const resolve = (p: VsshPlugin) => {
      if (visited.has(p.name)) return;
      visited.add(p.name);
      
      if (p.dependencies) {
        for (const dep of p.dependencies) {
          const depPlugin = this.plugins.get(dep);
          if (depPlugin) {
            resolve(depPlugin);
          }
        }
      }
      
      resolved.push(p.name);
    };
    
    resolve(plugin);
    return resolved;
  }
}