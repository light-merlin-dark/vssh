import type { VsshPlugin } from '../../types';
import { uploadCommand } from './commands/upload';
import { downloadCommand } from './commands/download';
import { z } from 'zod';

const UploadArgsSchema = z.object({
  localPath: z.string().describe('Local file path to upload'),
  remotePath: z.string().describe('Remote destination path')
});

const DownloadArgsSchema = z.object({
  remotePath: z.string().describe('Remote file path to download'),
  localPath: z.string().describe('Local destination path')
});

export const fileTransferPlugin: VsshPlugin = {
  name: 'file-transfer',
  version: '1.0.0',
  description: 'File transfer operations (upload/download) via SFTP with automatic zip/unzip for directories',

  helpSummary: {
    category: 'File Management',
    shortSummary: 'File transfers - upload (push files to server), download (pull files from server)',
    longSummary: 'Transfer files between local and remote systems using SFTP. Upload files to the server or download files from the server with automatic directory creation and progress feedback.',
    examples: [
      'vssh upload ./config.yml /etc/app/config.yml  # Upload local file to server',
      'vssh download /var/log/app.log ./app.log  # Download remote file to local'
    ]
  },

  commands: [
    {
      name: 'upload',
      aliases: ['push', 'put'],
      description: 'Upload a file to the remote server',
      usage: 'vssh upload <local-file> <remote-path>',
      examples: [
        'vssh upload ./config.yml /etc/app/config.yml',
        'vssh upload ./build.tar.gz /tmp/build.tar.gz'
      ],
      handler: uploadCommand,
      mcpName: 'upload_file',
      inputSchema: UploadArgsSchema
    },
    {
      name: 'download',
      aliases: ['pull', 'get'],
      description: 'Download a file from the remote server',
      usage: 'vssh download <remote-file> <local-path>',
      examples: [
        'vssh download /etc/app/config.yml ./config.yml',
        'vssh download /var/log/app.log ./logs/app.log'
      ],
      handler: downloadCommand,
      mcpName: 'download_file',
      inputSchema: DownloadArgsSchema
    }
  ],

  mcpTools: [
    {
      name: 'upload_file',
      description: 'Upload a file from local system to remote server via SFTP',
      inputSchema: {
        type: 'object',
        properties: {
          localPath: {
            type: 'string',
            description: 'Local file path to upload'
          },
          remotePath: {
            type: 'string',
            description: 'Remote destination path on the server'
          }
        },
        required: ['localPath', 'remotePath']
      }
    },
    {
      name: 'download_file',
      description: 'Download a file from remote server to local system via SFTP',
      inputSchema: {
        type: 'object',
        properties: {
          remotePath: {
            type: 'string',
            description: 'Remote file path on the server'
          },
          localPath: {
            type: 'string',
            description: 'Local destination path'
          }
        },
        required: ['remotePath', 'localPath']
      }
    }
  ]
};

export default fileTransferPlugin;
