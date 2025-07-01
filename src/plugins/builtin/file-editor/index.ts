import { VsshPlugin, McpToolDefinition } from '../../types';
import { editFileCommand } from './commands/edit-file';

const fileEditorPlugin: VsshPlugin = {
  name: 'file-editor',
  version: '1.0.0',
  description: 'Advanced file editing capabilities for vssh',
  author: 'vssh',
  
  helpSummary: {
    shortSummary: 'Advanced file editing - ef (edit-file) with search/replace, regex, insert, delete operations',
    longSummary: 'Powerful file editing tool supporting multiple operations: simple search/replace, regex patterns, line insertion, deletion, and batch edits via JSON. Includes backup and dry-run modes for safety.',
    category: 'File Management',
    keyCommands: ['ef', 'edit-file'],
    examples: [
      'vssh ef config.yml --search "localhost" --replace "example.com"',
      'vssh ef script.sh --regex "console\\.log" --with "// console.log" --flags "g"',
      'vssh ef app.conf --insert-at 0 --content "# Config file"'
    ]
  },
  
  mcpContext: {
    section: 'FILE EDITOR COMMANDS',
    commands: [
      { command: 'vssh edit-file /path/to/file --search "old" --replace "new"', description: 'Simple search and replace' },
      { command: 'vssh edit-file /path/to/file --regex "\\d+" --with "NUM" --flags "g"', description: 'Regex replace' },
      { command: 'vssh edit-file /path/to/file --insert-at 5 --content "new line"', description: 'Insert line at position' },
      { command: 'vssh edit-file /path/to/file --delete-line 10', description: 'Delete specific line' },
      { command: 'vssh ef /path/to/file --edits \'[{"type":"replace","search":"foo","replace":"bar"}]\'', description: 'Advanced edits via JSON' }
    ]
  },
  
  commands: [
    {
      name: 'edit-file',
      aliases: ['ef'],
      description: 'Edit files with advanced operations (search/replace, regex, insert, delete)',
      usage: 'vssh edit-file <path> [options]',
      examples: [
        'vssh edit-file /etc/app.conf --search "localhost" --replace "example.com"',
        'vssh edit-file config.yml --regex "version:\\s*(\\d+)" --with "version: 2" --flags "g"',
        'vssh edit-file script.sh --insert-at 0 --content "#!/bin/bash"',
        'vssh edit-file log.txt --delete-line 100',
        'vssh ef app.js --edits \'[{"type":"regex","pattern":"console\\\\.log","replace":"// console.log","flags":"g"}]\''
      ],
      handler: editFileCommand,
      mcpName: 'edit_file'
    }
  ],
  
  mcpTools: [
    {
      name: 'edit_file',
      description: 'Edit a file with advanced operations like search/replace, regex, insert, or delete',
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path to the file to edit'
          },
          edits: {
            type: 'array',
            description: 'Array of edit operations to apply',
            items: {
              type: 'object',
              properties: {
                type: {
                  type: 'string',
                  enum: ['replace', 'insert', 'delete', 'regex'],
                  description: 'Type of edit operation'
                },
                search: {
                  type: 'string',
                  description: 'Text to search for (for replace operations)'
                },
                replace: {
                  type: 'string',
                  description: 'Replacement text'
                },
                pattern: {
                  type: 'string',
                  description: 'Regular expression pattern (for regex operations)'
                },
                flags: {
                  type: 'string',
                  description: 'Regex flags (e.g., "g", "i", "m")'
                },
                line: {
                  type: 'number',
                  description: 'Line number for insert/delete operations'
                },
                startLine: {
                  type: 'number',
                  description: 'Start line for range delete'
                },
                endLine: {
                  type: 'number',
                  description: 'End line for range delete'
                },
                content: {
                  type: 'string',
                  description: 'Content to insert'
                },
                after: {
                  type: 'string',
                  description: 'Insert content after line containing this text'
                },
                before: {
                  type: 'string',
                  description: 'Insert content before line containing this text'
                }
              }
            }
          },
          backup: {
            type: 'boolean',
            description: 'Create backup before editing (default: true)',
            default: true
          },
          dryRun: {
            type: 'boolean',
            description: 'Show what would be changed without making changes',
            default: false
          },
          encoding: {
            type: 'string',
            description: 'File encoding (default: utf8)',
            default: 'utf8'
          }
        },
        required: ['path', 'edits']
      }
    } as McpToolDefinition
  ],
  
  commandGuards: [
    {
      category: 'file-editor',
      patterns: [
        /edit-file\s+\/etc\/passwd/,
        /edit-file\s+\/etc\/shadow/,
        /edit-file\s+\/etc\/sudoers(?!\.d)/,
        /edit-file\s+\/boot\//
      ],
      message: 'Editing critical system files is not allowed',
      suggestion: 'Create a backup and edit carefully with proper permissions'
    }
  ]
};

export default fileEditorPlugin;