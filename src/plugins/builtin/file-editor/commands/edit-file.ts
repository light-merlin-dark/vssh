import { CommandHandler } from '../../../types';
import { FileEditorService, EditOperation } from '../services/file-editor-service';

export const editFileCommand: CommandHandler = async (context, args) => {
  const filePath = args._[1];
  
  if (!filePath) {
    throw new Error('File path is required. Usage: vssh edit-file <path> [options]');
  }

  // Parse edit operations from args
  const edits: EditOperation[] = [];
  
  // Support for JSON-formatted edits
  if (args.edits) {
    try {
      const parsedEdits = typeof args.edits === 'string' ? JSON.parse(args.edits) : args.edits;
      if (Array.isArray(parsedEdits)) {
        edits.push(...parsedEdits);
      } else {
        edits.push(parsedEdits);
      }
    } catch (error) {
      throw new Error('Invalid edits format. Must be valid JSON array of edit operations');
    }
  }
  
  // Support for simple search/replace via flags
  if (args.search && args.replace !== undefined) {
    edits.push({
      type: 'replace',
      search: args.search,
      replace: args.replace
    });
  }
  
  // Support for regex replace
  if (args.regex && args.with !== undefined) {
    edits.push({
      type: 'regex',
      pattern: args.regex,
      replace: args.with,
      flags: args.flags
    });
  }
  
  // Support for line insertion
  if (args['insert-at'] !== undefined && args.content !== undefined) {
    edits.push({
      type: 'insert',
      line: parseInt(args['insert-at']),
      content: args.content
    });
  }
  
  // Support for line deletion
  if (args['delete-line'] !== undefined) {
    edits.push({
      type: 'delete',
      line: parseInt(args['delete-line'])
    });
  }
  
  if (edits.length === 0) {
    throw new Error('No edit operations specified. Use --search/--replace, --regex/--with, --edits, etc.');
  }

  const service = new FileEditorService(context);
  
  try {
    const result = await service.editFile({
      path: filePath,
      edits,
      backup: args.backup !== false, // Default to true
      dryRun: args['dry-run'] === true,
      encoding: args.encoding as BufferEncoding || 'utf8'
    });
    
    console.log(result);
  } catch (error: any) {
    throw new Error(`File edit failed: ${error.message}`);
  }
};