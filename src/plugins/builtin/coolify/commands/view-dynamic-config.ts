import type { PluginContext, ParsedArgs } from '../../../types';
import * as path from 'path';

const DYNAMIC_CONFIG_PATH = '/data/coolify/proxy/dynamic';

export async function viewDynamicConfigCommand(
  context: PluginContext,
  args: ParsedArgs
): Promise<void> {
  const { logger, proxyService } = context;

  const configName = args._[1] as string;

  if (!configName) {
    logger.error('Usage: vssh view-dynamic-config <config-name>');
    logger.error('');
    logger.error('Examples:');
    logger.error('  vssh vdc my-service          # View my-service.yaml');
    logger.error('  vssh vdc my-service.yaml     # Same as above');
    logger.error('  vssh vdc analytics           # View analytics.yaml');
    logger.error('');
    logger.error('Use "vssh ldc" or "vssh lcd" to list all available configs.');
    return;
  }

  try {
    // Normalize config name - add .yaml if not present
    let searchName = configName;
    if (!searchName.endsWith('.yaml') && !searchName.endsWith('.yml')) {
      searchName = `${configName}.yaml`;
    }

    // Try to find the config file (exact match or fuzzy)
    const findResult = await proxyService.executeCommand(
      `find ${DYNAMIC_CONFIG_PATH} -type f \\( -name "${searchName}" -o -name "${configName}.yml" -o -iname "*${configName}*" \\) 2>/dev/null | head -5`,
      { skipLogging: true }
    );

    const matches = findResult.output.trim().split('\n').filter(Boolean);

    if (matches.length === 0) {
      logger.error(`❌ No config found matching: ${configName}`);
      logger.error('');
      logger.error('Use "vssh ldc" to list all available configs.');
      return;
    }

    // If multiple matches, prefer exact match
    let targetFile = matches[0];
    const exactMatch = matches.find(m => {
      const base = path.basename(m);
      return base === searchName || base === `${configName}.yml`;
    });
    if (exactMatch) {
      targetFile = exactMatch;
    } else if (matches.length > 1) {
      logger.warn(`Multiple configs found matching "${configName}":`);
      for (const m of matches) {
        logger.warn(`  - ${path.basename(m)}`);
      }
      logger.warn(`Showing: ${path.basename(targetFile)}`);
      logger.warn('');
    }

    // Read and display the config
    const filename = path.basename(targetFile);
    console.log(`📄 ${filename}`);
    console.log('='.repeat(80));

    const contentResult = await proxyService.executeCommand(
      `cat ${targetFile}`,
      { skipLogging: true }
    );

    console.log(contentResult.output);
    console.log('='.repeat(80));
    console.log(`📁 Path: ${targetFile}`);

  } catch (error: any) {
    logger.error(`Failed to view dynamic config: ${error.message}`);
    throw error;
  }
}
