import * as fs from 'fs/promises';
import * as path from 'path';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { PluginContext } from '../../../types';

export interface EditOperation {
  type: 'replace' | 'insert' | 'delete' | 'regex';
  search?: string;
  replace?: string;
  line?: number;
  startLine?: number;
  endLine?: number;
  pattern?: string;
  flags?: string;
  content?: string;
  after?: string;
  before?: string;
}

export interface EditFileOptions {
  path: string;
  edits: EditOperation[];
  backup?: boolean;
  dryRun?: boolean;
  encoding?: BufferEncoding;
}

export class FileEditorService {
  constructor(private context: PluginContext) {}

  async editFile(options: EditFileOptions): Promise<string> {
    const { path: filePath, edits, backup = true, dryRun = false, encoding = 'utf8' } = options;
    
    // Validate file path
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(filePath);
    
    // Safety check: prevent editing system files
    if (this.isSystemFile(absolutePath)) {
      throw new Error(`Cannot edit system file: ${absolutePath}`);
    }

    let content: string;
    let originalContent: string;
    
    if (this.context.isLocalExecution) {
      // Local file editing
      try {
        content = await fs.readFile(absolutePath, encoding);
        originalContent = content;
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          throw new Error(`File not found: ${absolutePath}`);
        }
        throw error;
      }
    } else {
      // Remote file editing via SSH
      try {
        const result = await this.context.proxyService.executeCommand(`cat "${absolutePath}"`);
        content = result.output;
        originalContent = content;
      } catch (error) {
        throw new Error(`Failed to read remote file: ${absolutePath}`);
      }
    }

    // Apply edits
    for (const edit of edits) {
      content = await this.applyEdit(content, edit);
    }

    // Check if content changed
    if (content === originalContent) {
      return 'No changes made to file';
    }

    if (dryRun) {
      return this.generateDiff(originalContent, content);
    }

    // Create backup if requested
    if (backup) {
      const backupPath = `${absolutePath}.vssh.backup`;
      if (this.context.isLocalExecution) {
        await fs.writeFile(backupPath, originalContent, encoding);
      } else {
        await this.context.proxyService.executeCommand(`cp "${absolutePath}" "${backupPath}"`);
      }
    }

    // Write the edited content
    if (this.context.isLocalExecution) {
      await fs.writeFile(absolutePath, content, encoding);
    } else {
      // For remote files, we need to use a safer approach
      const escapedContent = content.replace(/'/g, "'\"'\"'");
      await this.context.proxyService.executeCommand(`cat > "${absolutePath}" << 'VSSH_EOF'
${content}
VSSH_EOF`);
    }

    const changeCount = edits.length;
    return `Successfully applied ${changeCount} edit${changeCount > 1 ? 's' : ''} to ${absolutePath}`;
  }

  private async applyEdit(content: string, edit: EditOperation): Promise<string> {
    const lines = content.split('\n');
    
    switch (edit.type) {
      case 'replace':
        if (!edit.search || edit.replace === undefined) {
          throw new Error('Replace operation requires search and replace parameters');
        }
        return content.split(edit.search).join(edit.replace);
      
      case 'regex':
        if (!edit.pattern || edit.replace === undefined) {
          throw new Error('Regex operation requires pattern and replace parameters');
        }
        const regex = new RegExp(edit.pattern, edit.flags || 'g');
        return content.replace(regex, edit.replace);
      
      case 'insert':
        if (edit.line !== undefined) {
          if (edit.line < 0 || edit.line > lines.length) {
            throw new Error(`Line ${edit.line} out of range (0-${lines.length})`);
          }
          lines.splice(edit.line, 0, edit.content || '');
        } else if (edit.after) {
          const index = lines.findIndex(line => line.includes(edit.after!));
          if (index === -1) {
            throw new Error(`Pattern "${edit.after}" not found`);
          }
          lines.splice(index + 1, 0, edit.content || '');
        } else if (edit.before) {
          const index = lines.findIndex(line => line.includes(edit.before!));
          if (index === -1) {
            throw new Error(`Pattern "${edit.before}" not found`);
          }
          lines.splice(index, 0, edit.content || '');
        } else {
          throw new Error('Insert operation requires line, after, or before parameter');
        }
        return lines.join('\n');
      
      case 'delete':
        if (edit.line !== undefined) {
          if (edit.line < 0 || edit.line >= lines.length) {
            throw new Error(`Line ${edit.line} out of range (0-${lines.length - 1})`);
          }
          lines.splice(edit.line, 1);
        } else if (edit.startLine !== undefined && edit.endLine !== undefined) {
          if (edit.startLine < 0 || edit.endLine >= lines.length || edit.startLine > edit.endLine) {
            throw new Error(`Invalid line range: ${edit.startLine}-${edit.endLine}`);
          }
          lines.splice(edit.startLine, edit.endLine - edit.startLine + 1);
        } else if (edit.search) {
          return lines.filter(line => !line.includes(edit.search!)).join('\n');
        } else {
          throw new Error('Delete operation requires line, startLine/endLine, or search parameter');
        }
        return lines.join('\n');
      
      default:
        throw new Error(`Unknown edit type: ${edit.type}`);
    }
  }

  private isSystemFile(filePath: string): boolean {
    const systemPaths = [
      '/etc',
      '/sys',
      '/proc',
      '/boot',
      '/bin',
      '/sbin',
      '/usr/bin',
      '/usr/sbin',
      '/lib',
      '/lib64',
      '/usr/lib',
      '/usr/lib64'
    ];
    
    return systemPaths.some(sysPath => filePath.startsWith(sysPath));
  }

  private generateDiff(original: string, modified: string): string {
    const originalLines = original.split('\n');
    const modifiedLines = modified.split('\n');
    
    let diff = 'Dry run - changes that would be made:\n\n';
    let lineNum = 1;
    
    const maxLines = Math.max(originalLines.length, modifiedLines.length);
    
    for (let i = 0; i < maxLines; i++) {
      const origLine = originalLines[i];
      const modLine = modifiedLines[i];
      
      if (origLine !== modLine) {
        if (origLine !== undefined && modLine !== undefined) {
          diff += `${lineNum}: - ${origLine}\n`;
          diff += `${lineNum}: + ${modLine}\n`;
        } else if (origLine !== undefined) {
          diff += `${lineNum}: - ${origLine}\n`;
        } else {
          diff += `${lineNum}: + ${modLine}\n`;
        }
      }
      lineNum++;
    }
    
    return diff;
  }
}