import type { PluginContext, ParsedArgs } from '../../../types';
import { stat, unlink } from 'fs/promises';
import { resolve, dirname, basename } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function downloadCommand(
  context: PluginContext,
  args: ParsedArgs
): Promise<void> {
  const { sshService, logger, proxyService } = context;

  const remotePath = args._[1] as string;
  const localPath = args._[2] as string;

  if (!remotePath || !localPath) {
    logger.error('Usage: vssh download <remote-path> <local-path>');
    logger.error('Example: vssh download /etc/app/config.yml ./config.yml');
    logger.error('         vssh download /var/www/myapp ./  # Auto-zips directories');
    return;
  }

  try {
    // Check if remote path is a directory
    const checkDirCmd = `[ -d "${remotePath}" ] && echo "directory" || echo "file"`;
    const result = await proxyService.executeCommand(checkDirCmd);
    const isDirectory = result.output.trim() === 'directory';

    // Resolve local path to absolute
    const absoluteLocalPath = resolve(localPath);

    // Ensure local directory exists
    const localDir = dirname(absoluteLocalPath);
    if (!existsSync(localDir)) {
      mkdirSync(localDir, { recursive: true });
    }

    // Handle directory download with automatic zip
    if (isDirectory) {
      const dirName = basename(remotePath);
      const remoteZip = `/tmp/${dirName}-${Date.now()}.tar.gz`;
      const tempZip = `/tmp/${dirName}-${Date.now()}.tar.gz`;

      logger.info(`📦 Detected directory, creating archive on server...`);

      // Create tar.gz on server
      const parentDir = dirname(remotePath);
      const createZipCmd = `tar -czf ${remoteZip} -C ${parentDir} ${dirName}`;
      await proxyService.executeCommand(createZipCmd);

      logger.info(`📥 Downloading archive...`);
      await sshService.downloadFile(remoteZip, tempZip);

      const zipStats = await stat(tempZip);
      logger.info(`   Downloaded: ${(zipStats.size / 1024 / 1024).toFixed(2)} MB`);

      logger.info(`📂 Extracting locally...`);
      await execAsync(`tar -xzf ${tempZip} -C ${absoluteLocalPath}`);

      // Cleanup
      await unlink(tempZip);
      await proxyService.executeCommand(`rm ${remoteZip}`);

      logger.info(`✅ Successfully downloaded directory ${remotePath} to ${localPath}`);
      return;
    }

    // Handle regular file download
    logger.info(`Downloading ${remotePath} to ${localPath}...`);

    try {
      const fileInfo = await sshService.getFileInfo(remotePath);
      logger.info(`File size: ${(fileInfo.size / 1024).toFixed(2)} KB`);
    } catch (err) {
      // File info is optional, continue if it fails
    }

    await sshService.downloadFile(remotePath, absoluteLocalPath);

    // Get local file size after download
    const localStats = await stat(absoluteLocalPath);
    logger.info(`✅ Successfully downloaded ${remotePath} to ${localPath}`);
    logger.info(`Downloaded: ${(localStats.size / 1024).toFixed(2)} KB`);
  } catch (error: any) {
    logger.error(`Failed to download: ${error.message}`);
    throw error;
  }
}
