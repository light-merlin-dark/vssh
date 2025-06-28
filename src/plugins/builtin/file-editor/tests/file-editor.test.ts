import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FileEditorService, EditOperation } from '../services/file-editor-service';
import { createMockContext } from '../../../../../tests/test-utils';
import * as fs from 'fs/promises';

vi.mock('fs/promises');

describe('FileEditorService', () => {
  let service: FileEditorService;
  let mockContext: any;

  beforeEach(() => {
    const testContext = createMockContext();
    mockContext = testContext.context;
    service = new FileEditorService(mockContext);
    vi.clearAllMocks();
  });

  describe('Local file editing', () => {
    beforeEach(() => {
      mockContext.isLocalExecution = true;
    });

    it('should perform simple search and replace', async () => {
      const originalContent = 'Hello world\nThis is a test\nHello again';
      const expectedContent = 'Hi world\nThis is a test\nHi again';
      
      vi.mocked(fs.readFile).mockResolvedValue(originalContent);
      vi.mocked(fs.writeFile).mockResolvedValue();

      const result = await service.editFile({
        path: '/home/user/file.txt',
        edits: [{
          type: 'replace',
          search: 'Hello',
          replace: 'Hi'
        }],
        backup: false
      });

      expect(fs.writeFile).toHaveBeenCalledWith('/home/user/file.txt', expectedContent, 'utf8');
      expect(result).toContain('Successfully applied 1 edit');
    });

    it('should perform regex replacement', async () => {
      const originalContent = 'version: 1.0.0\nname: test\nversion: 2.0.0';
      const expectedContent = 'version: 3.0.0\nname: test\nversion: 3.0.0';
      
      vi.mocked(fs.readFile).mockResolvedValue(originalContent);
      vi.mocked(fs.writeFile).mockResolvedValue();

      const result = await service.editFile({
        path: '/home/user/config.yml',
        edits: [{
          type: 'regex',
          pattern: 'version:\\s*\\d+\\.\\d+\\.\\d+',
          replace: 'version: 3.0.0',
          flags: 'g'
        }]
      });

      expect(fs.writeFile).toHaveBeenCalledWith('/home/user/config.yml', expectedContent, 'utf8');
    });

    it('should insert content at specific line', async () => {
      const originalContent = 'line1\nline2\nline3';
      const expectedContent = 'line1\ninserted line\nline2\nline3';
      
      vi.mocked(fs.readFile).mockResolvedValue(originalContent);
      vi.mocked(fs.writeFile).mockResolvedValue();

      await service.editFile({
        path: '/home/user/file.txt',
        edits: [{
          type: 'insert',
          line: 1,
          content: 'inserted line'
        }],
        backup: false
      });

      expect(fs.writeFile).toHaveBeenCalledWith('/home/user/file.txt', expectedContent, 'utf8');
    });

    it('should delete specific line', async () => {
      const originalContent = 'line1\nline2\nline3';
      const expectedContent = 'line1\nline3';
      
      vi.mocked(fs.readFile).mockResolvedValue(originalContent);
      vi.mocked(fs.writeFile).mockResolvedValue();

      await service.editFile({
        path: '/home/user/file.txt',
        edits: [{
          type: 'delete',
          line: 1
        }],
        backup: false
      });

      expect(fs.writeFile).toHaveBeenCalledWith('/home/user/file.txt', expectedContent, 'utf8');
    });

    it('should create backup when requested', async () => {
      const originalContent = 'original content';
      
      vi.mocked(fs.readFile).mockResolvedValue(originalContent);
      vi.mocked(fs.writeFile).mockResolvedValue();

      await service.editFile({
        path: '/home/user/file.txt',
        edits: [{
          type: 'replace',
          search: 'original',
          replace: 'modified'
        }],
        backup: true
      });

      expect(fs.writeFile).toHaveBeenCalledWith('/home/user/file.txt.vssh.backup', originalContent, 'utf8');
    });

    it('should perform dry run without modifying file', async () => {
      const originalContent = 'Hello world';
      
      vi.mocked(fs.readFile).mockResolvedValue(originalContent);

      const result = await service.editFile({
        path: '/home/user/file.txt',
        edits: [{
          type: 'replace',
          search: 'Hello',
          replace: 'Hi'
        }],
        dryRun: true
      });

      expect(fs.writeFile).not.toHaveBeenCalled();
      expect(result).toContain('Dry run - changes that would be made');
      expect(result).toContain('- Hello world');
      expect(result).toContain('+ Hi world');
    });

    it('should reject editing system files', async () => {
      await expect(service.editFile({
        path: '/etc/passwd',
        edits: [{
          type: 'replace',
          search: 'root',
          replace: 'admin'
        }]
      })).rejects.toThrow('Cannot edit system file');
    });

    it('should handle multiple edits in sequence', async () => {
      const originalContent = 'Hello world\nFoo bar\nTest line';
      const expectedContent = 'Hi world\nBaz bar\nTest line\nNew line';
      
      vi.mocked(fs.readFile).mockResolvedValue(originalContent);
      vi.mocked(fs.writeFile).mockResolvedValue();

      await service.editFile({
        path: '/home/user/file.txt',
        edits: [
          { type: 'replace', search: 'Hello', replace: 'Hi' },
          { type: 'replace', search: 'Foo', replace: 'Baz' },
          { type: 'insert', line: 3, content: 'New line' }
        ],
        backup: false
      });

      expect(fs.writeFile).toHaveBeenCalledWith('/home/user/file.txt', expectedContent, 'utf8');
    });
  });

  describe('Remote file editing', () => {
    beforeEach(() => {
      mockContext.isLocalExecution = false;
      // Reset mocks for remote tests
      vi.clearAllMocks();
    });

    it('should edit remote files via SSH', async () => {
      const originalContent = 'remote content';
      
      mockContext.proxyService.executeCommand = vi.fn()
        .mockResolvedValueOnce({ 
          output: originalContent,
          duration: 100,
          timestamp: new Date().toISOString(),
          command: `cat "/remote/file.txt"`
        })
        .mockResolvedValueOnce({ 
          output: '',
          duration: 100,
          timestamp: new Date().toISOString(),
          command: `cat > "/remote/file.txt"`
        });

      await service.editFile({
        path: '/remote/file.txt',
        edits: [{
          type: 'replace',
          search: 'remote',
          replace: 'modified'
        }],
        backup: false
      });

      expect(mockContext.proxyService.executeCommand).toHaveBeenCalledWith('cat "/remote/file.txt"');
      expect(mockContext.proxyService.executeCommand).toHaveBeenCalledWith(expect.stringContaining('cat > "/remote/file.txt"'));
    });
  });
});

describe('editFileCommand', () => {
  it('should parse command line arguments correctly', async () => {
    const { editFileCommand } = await import('../commands/edit-file');
    const testContext = createMockContext();
    const mockContext = testContext.context;
    
    // Mock console.log to capture output
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    // Mock the FileEditorService
    vi.mock('../services/file-editor-service', () => ({
      FileEditorService: vi.fn().mockImplementation(() => ({
        editFile: vi.fn().mockResolvedValue('Successfully applied 1 edit')
      }))
    }));

    await editFileCommand(mockContext, {
      _: ['edit-file', '/test/file.txt'],
      search: 'old',
      replace: 'new'
    });

    expect(consoleSpy).toHaveBeenCalledWith('Successfully applied 1 edit');
    consoleSpy.mockRestore();
  });
});