import { CommandGuard } from './command-guard';
import type { CommandGuardResult } from '../types';

export class CommandGuardService {
  checkCommand(command: string): CommandGuardResult {
    return CommandGuard.checkCommand(command);
  }
}
