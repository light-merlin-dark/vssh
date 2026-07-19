import { describe, expect, it } from 'bun:test';
import { commandFromArgs, shellQuote } from '../../src/shell';

describe('shell argument reconstruction', () => {
  it('leaves safe arguments readable', () => {
    expect(shellQuote('/var/log/app.log')).toBe('/var/log/app.log');
  });

  it('quotes spaces and embedded single quotes', () => {
    expect(shellQuote('hello world')).toBe("'hello world'");
    expect(shellQuote("it's ready")).toBe("'it'\"'\"'s ready'");
  });

  it('preserves a single literal shell command', () => {
    expect(commandFromArgs(['ps aux | grep node'])).toBe('ps aux | grep node');
  });

  it('safely reconstructs multiple argv values', () => {
    expect(commandFromArgs(['printf', '%s', 'hello world'])).toBe("printf %s 'hello world'");
  });
});
