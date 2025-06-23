import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function handleInstallCommand(): Promise<void> {
  console.log('Installing vssh as MCP server in Claude Code...\n');
  
  try {
    // Check if vssh-mcp command is available
    try {
      await execAsync('which vssh-mcp');
    } catch (error) {
      console.error('❌ vssh-mcp command not found.');
      console.error('Please make sure vssh is installed globally:');
      console.error('  npm install -g @light-merlin-dark/vssh\n');
      process.exit(1);
    }
    
    // First, try to remove any existing vssh MCP server
    try {
      await execAsync('claude mcp remove vssh 2>/dev/null || true');
    } catch (error) {
      // Ignore errors from remove command
    }
    
    // Add vssh as MCP server
    const mcpConfig = JSON.stringify({
      type: "stdio",
      command: "vssh-mcp",
      env: { NODE_NO_WARNINGS: "1" }
    });
    
    const command = `claude mcp add-json vssh '${mcpConfig}'`;
    
    await execAsync(command);
    
    console.log('✅ vssh successfully installed as MCP server!\n');
    console.log('You can now use vssh tools in Claude Code:');
    console.log('  • run_command - Execute SSH commands with safety checks');
    console.log('  • get_local_mode - Check if commands execute locally or remotely');
    console.log('  • set_local_mode - Toggle between local and remote execution');
    console.log('  • list_docker_containers - List Docker containers');
    console.log('  • show_docker_logs - View container logs');
    console.log('  • get_coolify_proxy_config - Get Coolify proxy configuration');
    console.log('  • list_grafana_dashboards - List Grafana dashboards');
    console.log('  • And more...\n');
    console.log('For more details, see: https://github.com/light-merlin-dark/vssh#model-context-protocol-mcp-setup');
    
  } catch (error: any) {
    console.error('❌ Failed to install vssh as MCP server');
    console.error('');
    
    if (error.message.includes('claude: command not found')) {
      console.error('Claude Code CLI is not installed or not in PATH.');
      console.error('Please install Claude Code first: https://docs.anthropic.com/en/docs/claude-code');
    } else if (error.message.includes('permission') || error.message.includes('EACCES')) {
      console.error('Permission denied. Try running with sudo or check your Claude Code permissions.');
    } else {
      console.error(`Error: ${error.message}`);
      console.error('');
      console.error('You can also install manually:');
      console.error('');
      console.error('claude mcp add-json vssh \'{\n  "type":"stdio",\n  "command":"vssh-mcp",\n  "env":{"NODE_NO_WARNINGS":"1"}\n}\'');
    }
    
    process.exit(1);
  }
}