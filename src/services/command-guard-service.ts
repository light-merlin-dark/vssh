import { CommandGuard } from './command-guard';
import { CommandGuardResult } from '../types';
import { CommandGuardExtension } from '../plugins/types';

export class CommandGuardService {
  private extensions: CommandGuardExtension[] = [];
  
  addExtensions(extensions: CommandGuardExtension[]): void {
    this.extensions.push(...extensions);
  }
  
  clearExtensions(): void {
    this.extensions = [];
  }
  
  checkCommand(command: string): CommandGuardResult {
    // First check built-in guards
    const builtinResult = CommandGuard.checkCommand(command);
    if (builtinResult.isBlocked) {
      return builtinResult;
    }
    
    // Then check plugin extensions
    for (const extension of this.extensions) {
      for (const pattern of extension.patterns) {
        if (pattern.test(command)) {
          return {
            isBlocked: true,
            reasons: [extension.message],
            rule: extension.category
          };
        }
      }
    }
    
    return builtinResult;
  }
  
  displayBlockedMessage(command: string, result: CommandGuardResult): void {
    CommandGuard.displayBlockedMessage(command, result);
  }
  
  logBlockedCommand(command: string, result: CommandGuardResult): void {
    CommandGuard.logBlockedCommand(command, result);
  }
}