import { VsshPlugin, PluginContext, PluginCommand, McpToolDefinition, CommandGuardExtension, VsshConfig, Logger, ParsedArgs } from './types';
import { SSHService } from '../services/ssh';
import { CommandGuardService } from '../services/command-guard-service';
import { ProxyService } from '../services/proxy-service';
import { DependencyChecker } from '../services/dependency-checker';
import { saveConfig } from '../config';

export class PluginRegistry {
  private plugins: Map<string, VsshPlugin> = new Map();
  private enabled: Set<string> = new Set();
  private _context: PluginContext;
  private commandMap: Map<string, { plugin: VsshPlugin; command: PluginCommand }> = new Map();
  private dependencyChecker: DependencyChecker;
  
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
    
    this.dependencyChecker = new DependencyChecker(
      sshService,
      proxyService,
      isLocalExecution
    );
    
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
    
    // Validate dependencies exist (only in local mode)
    // In proxy mode, dependencies will be checked on the server at runtime
    if (this._context.isLocalExecution && plugin.dependencies) {
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
    
    // Enable dependencies first (only if they exist locally)
    // In proxy mode, dependencies will be checked on the server at runtime
    if (plugin.dependencies) {
      for (const dep of plugin.dependencies) {
        // Only try to enable if the dependency is loaded
        if (this.plugins.has(dep)) {
          await this.enablePlugin(dep);
        } else if (this._context.isLocalExecution) {
          // In local mode, missing dependencies are an error
          throw new Error(`Cannot enable plugin ${name}: dependency ${dep} is not loaded`);
        }
        // In proxy mode, we allow enabling even if dependencies aren't loaded locally
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
    
    // Save config to disk
    saveConfig(this._context.config);
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
    
    // Save config to disk
    saveConfig(this._context.config);
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
  
  async executeCommand(commandName: string, args: ParsedArgs): Promise<void> {
    const command = this.getCommand(commandName);
    if (!command) {
      throw new Error(`Command ${commandName} not found`);
    }
    
    const plugin = this.getCommandPlugin(commandName);
    if (!plugin) {
      throw new Error(`Plugin for command ${commandName} not found`);
    }
    
    if (!this.isEnabled(plugin.name)) {
      throw new Error(`Plugin '${plugin.name}' is not enabled`);
    }
    
    // Check runtime dependencies
    if (plugin.runtimeDependencies && plugin.runtimeDependencies.length > 0) {
      const results = await this.dependencyChecker.checkPluginDependencies(plugin);
      
      // Check for missing required dependencies
      try {
        this.dependencyChecker.assertAllDependenciesAvailable(results);
      } catch (error: any) {
        // If there are missing dependencies, show them and exit
        console.error(`\n❌ ${error.message}`);
        process.exit(1);
      }
      
      // Show warnings for optional dependencies
      const missingOptional = results.filter(r => !r.isAvailable && r.dependency.optional);
      for (const result of missingOptional) {
        this._context.logger.warn(`Optional dependency missing: ${result.error}`);
      }
    }
    
    // Execute the command
    await command.handler(this._context, args);
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
    
    // Plugin activated
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
    
    // Plugin deactivated
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