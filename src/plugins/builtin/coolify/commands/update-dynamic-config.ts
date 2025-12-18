import type { PluginContext, ParsedArgs } from '../../../types';
import { stat, readFile } from 'fs/promises';
import { resolve, basename, extname } from 'path';
import * as yaml from 'yaml';

const DYNAMIC_CONFIG_PATH = '/data/coolify/proxy/dynamic';

export async function updateDynamicConfigCommand(
  context: PluginContext,
  args: ParsedArgs
): Promise<void> {
  const { sshService, logger, proxyService } = context;

  const localPath = args._[1] as string;
  const configName = args.name as string | undefined;

  if (!localPath) {
    logger.error('Usage: vssh update-dynamic-config <local-yaml-file> [--name <config-name>]');
    logger.error('');
    logger.error('Examples:');
    logger.error('  vssh udc ./my-service.yaml                    # Uses filename as config name');
    logger.error('  vssh udc ./config.yaml --name my-service      # Custom config name');
    logger.error('  vssh udc ./traefik/proxy.yaml --name proxy    # From subdirectory');
    logger.error('');
    logger.error('The config will be uploaded to: /data/coolify/proxy/dynamic/<name>.yaml');
    return;
  }

  try {
    // Resolve local path to absolute
    const absoluteLocalPath = resolve(localPath);

    // Check if local file exists
    const fileStats = await stat(absoluteLocalPath);

    if (fileStats.isDirectory()) {
      logger.error('Cannot upload a directory. Please specify a YAML config file.');
      return;
    }

    // Determine config name
    const ext = extname(absoluteLocalPath);
    if (!['.yaml', '.yml'].includes(ext.toLowerCase())) {
      logger.warn(`Warning: File extension is ${ext}, expected .yaml or .yml`);
    }

    // Get config name from --name flag or derive from filename
    let finalConfigName = configName;
    if (!finalConfigName) {
      finalConfigName = basename(absoluteLocalPath, ext);
    }

    // Ensure .yaml extension on remote
    const remoteFileName = finalConfigName.endsWith('.yaml') || finalConfigName.endsWith('.yml')
      ? finalConfigName
      : `${finalConfigName}.yaml`;
    const remotePath = `${DYNAMIC_CONFIG_PATH}/${remoteFileName}`;

    // Read and validate YAML
    logger.info(`📄 Reading ${localPath}...`);
    const content = await readFile(absoluteLocalPath, 'utf-8');

    try {
      yaml.parse(content);
      logger.info('✓ YAML syntax valid');
    } catch (parseError: any) {
      logger.error(`❌ Invalid YAML syntax: ${parseError.message}`);
      return;
    }

    // Check if config already exists
    const existsResult = await proxyService.executeCommand(
      `test -f ${remotePath} && echo "exists" || echo "new"`,
      { skipLogging: true }
    );
    const isUpdate = existsResult.output.trim() === 'exists';

    // Upload the file
    logger.info(`${isUpdate ? '🔄 Updating' : '📤 Creating'} ${remoteFileName}...`);
    logger.info(`   Size: ${(fileStats.size / 1024).toFixed(2)} KB`);

    await sshService.uploadFile(absoluteLocalPath, remotePath);

    // Verify the upload
    const verifyResult = await proxyService.executeCommand(
      `cat ${remotePath} | head -5`,
      { skipLogging: true }
    );

    if (verifyResult.output.trim()) {
      logger.info(`✅ Successfully ${isUpdate ? 'updated' : 'created'} dynamic config: ${remoteFileName}`);
      logger.info(`   Path: ${remotePath}`);
      logger.info('');
      logger.info('💡 Traefik will automatically detect and apply the new configuration.');
    } else {
      logger.error('❌ Upload verification failed. Config may not have been written correctly.');
    }

  } catch (error: any) {
    logger.error(`Failed to update dynamic config: ${error.message}`);
    throw error;
  }
}
