import type { PluginContext, ParsedArgs } from '../../../types';
import { stat, unlink } from 'fs/promises';
import { resolve, basename } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function uploadCommand(
  context: PluginContext,
  args: ParsedArgs
): Promise<void> {
  const { sshService, logger, proxyService } = context;

  const localPath = args._[1] as string;
  const remotePath = args._[2] as string;

  if (!localPath || !remotePath) {
    logger.error('Usage: vssh upload <local-path> <remote-path>');
    logger.error('Example: vssh upload ./config.yml /etc/app/config.yml');
    logger.error('         vssh upload ./my-folder /var/www/  # Auto-zips directories');
    return;
  }

  try {
    // Resolve local path to absolute
    const absoluteLocalPath = resolve(localPath);

    // Check if local path exists
    const fileStats = await stat(absoluteLocalPath);

    // Handle directory upload with automatic zip
    if (fileStats.isDirectory()) {
      const dirName = basename(absoluteLocalPath);
      const tempZip = `/tmp/${dirName}-${Date.now()}.tar.gz`;
      const remoteZip = `/tmp/${dirName}-${Date.now()}.tar.gz`;

      logger.info(`📦 Detected directory, creating archive...`);

      // Create tar.gz locally (fastest compression)
      await execAsync(`tar -czf ${tempZip} -C ${resolve(absoluteLocalPath, '..')} ${dirName}`);
      const zipStats = await stat(tempZip);
      logger.info(`   Compressed: ${(zipStats.size / 1024 / 1024).toFixed(2)} MB`);

      logger.info(`📤 Uploading archive...`);
      await sshService.uploadFile(tempZip, remoteZip);

      logger.info(`📂 Extracting on server...`);
      const extractCmd = `tar -xzf ${remoteZip} -C ${remotePath} && rm ${remoteZip}`;
      await proxyService.executeCommand(extractCmd);

      // Cleanup local temp file
      await unlink(tempZip);

      logger.info(`✅ Successfully uploaded directory ${localPath} to ${remotePath}`);
      return;
    }

    // Handle regular file upload
    logger.info(`Uploading ${localPath} to ${remotePath}...`);
    logger.info(`File size: ${(fileStats.size / 1024).toFixed(2)} KB`);

    await sshService.uploadFile(absoluteLocalPath, remotePath);

    logger.info(`✅ Successfully uploaded ${localPath} to ${remotePath}`);
  } catch (error: any) {
    logger.error(`Failed to upload: ${error.message}`);
    throw error;
  }
}
