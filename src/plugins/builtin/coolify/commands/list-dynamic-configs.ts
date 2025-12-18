import { PluginContext, ParsedArgs } from '../../../types';
import * as path from 'path';

const DYNAMIC_CONFIG_PATH = '/data/coolify/proxy/dynamic';

export async function listDynamicConfigsCommand(
  context: PluginContext,
  args: ParsedArgs
): Promise<void> {
  const { logger, proxyService } = context;
  const configName = args._[1] as string | undefined;

  try {
    // List all files in the dynamic directory
    const result = await proxyService.executeCommand(
      `find ${DYNAMIC_CONFIG_PATH} -type f \\( -name "*.yml" -o -name "*.yaml" -o -name "*.toml" -o -name "*.json" \\) 2>/dev/null | sort`,
      { skipLogging: true }
    );
    const files = result.output;

    if (!files.trim()) {
      console.log('No dynamic configurations found');
      return;
    }

    const fileList = files.trim().split('\n');

    // If a config name was provided, show its contents
    if (configName) {
      await showConfigContent(proxyService, logger, fileList, configName);
      return;
    }

    // Otherwise, just list filenames
    console.log(`📂 Found ${fileList.length} dynamic configuration(s):\n`);

    for (const file of fileList) {
      const filename = path.basename(file);
      console.log(`  ${filename}`);
    }

    console.log(`\nTo view a config: vssh lcd <config-name>`);
    console.log(`Example: vssh lcd ${path.basename(fileList[0])}`);

  } catch (error: any) {
    logger.error(`Failed to list dynamic configurations: ${error.message}`);
    console.error('\nMake sure Coolify is installed and the dynamic configurations directory exists.');
    process.exit(1);
  }
}

async function showConfigContent(
  proxyService: PluginContext['proxyService'],
  logger: PluginContext['logger'],
  fileList: string[],
  configName: string
): Promise<void> {
  // Normalize config name - add .yaml if not present
  let searchName = configName;
  if (!searchName.endsWith('.yaml') && !searchName.endsWith('.yml')) {
    searchName = `${configName}.yaml`;
  }

  // Find matching file
  const exactMatch = fileList.find(f => {
    const base = path.basename(f);
    return base === searchName || base === `${configName}.yml` || base === configName;
  });

  // Fuzzy match if no exact match
  const fuzzyMatches = fileList.filter(f =>
    path.basename(f).toLowerCase().includes(configName.toLowerCase())
  );

  const targetFile = exactMatch || fuzzyMatches[0];

  if (!targetFile) {
    logger.error(`❌ No config found matching: ${configName}`);
    console.log('\nAvailable configs:');
    for (const f of fileList) {
      console.log(`  ${path.basename(f)}`);
    }
    return;
  }

  // Warn if multiple fuzzy matches
  if (!exactMatch && fuzzyMatches.length > 1) {
    logger.warn(`Multiple configs found matching "${configName}":`);
    for (const m of fuzzyMatches) {
      logger.warn(`  - ${path.basename(m)}`);
    }
    logger.warn(`Showing: ${path.basename(targetFile)}\n`);
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
}