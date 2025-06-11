import { PluginContext, ParsedArgs } from '../../../types';
import * as path from 'path';

export async function listDynamicConfigsCommand(
  context: PluginContext,
  args: ParsedArgs
): Promise<void> {
  const dynamicPath = '/data/coolify/proxy/dynamic';
  
  try {
    // List all files in the dynamic directory
    const files = await context.sshService.executeCommand(
      `find ${dynamicPath} -type f \\( -name "*.yml" -o -name "*.yaml" -o -name "*.toml" -o -name "*.json" \\) 2>/dev/null | sort`
    );
    
    if (!files.trim()) {
      console.log('No dynamic configurations found');
      return;
    }
    
    const fileList = files.trim().split('\n');
    console.log(`📂 Found ${fileList.length} dynamic configuration(s)`);
    console.log('=' .repeat(80));
    
    for (const file of fileList) {
      const filename = path.basename(file);
      console.log(`\n📄 ${filename}`);
      console.log('-'.repeat(80));
      
      try {
        const content = await context.sshService.executeCommand(`cat ${file}`);
        console.log(content);
      } catch (error: any) {
        console.error(`Failed to read ${file}: ${error.message}`);
      }
    }
    
    console.log('\n' + '='.repeat(80));
  } catch (error: any) {
    context.logger.error(`Failed to list dynamic configurations: ${error.message}`);
    console.error('\nMake sure Coolify is installed and the dynamic configurations directory exists.');
    process.exit(1);
  }
}