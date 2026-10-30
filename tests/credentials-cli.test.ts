import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readSecret, runCredentialCli } from '../src/credentials-cli.js';

const projectId = '33333333-3333-4333-8333-333333333333';
const replacementToken = 'test-only-cli-token';

let directory: string | undefined;

function outputBuffer() {
  let value = '';
  return {
    write(chunk: string | Uint8Array) {
      value += chunk.toString();
      return true;
    },
    text: () => value,
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
  if (directory) rmSync(directory, { recursive: true, force: true });
  directory = undefined;
});

describe('credential CLI', () => {
  it('adds, lists, updates, and removes profiles without rendering token values', async () => {
    directory = mkdtempSync(join(tmpdir(), 'taskhub-cli-'));
    vi.stubEnv('TASKHUB_CREDENTIALS_FILE', join(directory, 'credentials.json'));
    const output = outputBuffer();
    const error = outputBuffer();

    await runCredentialCli(['add', '--project-id', projectId, '--label', 'Demo'], {
      output: output as never,
      error: error as never,
      readSecret: async () => 'test-only-initial-token',
    });
    await runCredentialCli(['update', '--project-id', projectId], {
      output: output as never,
      error: error as never,
      readSecret: async () => replacementToken,
    });
    await runCredentialCli(['list'], { output: output as never, error: error as never });

    expect(output.text()).toContain(projectId);
    expect(output.text()).not.toContain('test-only-initial-token');
    expect(output.text()).not.toContain(replacementToken);
    expect(JSON.parse(readFileSync(join(directory, 'credentials.json'), 'utf8')).profiles[projectId].token)
      .toBe(replacementToken);

    await runCredentialCli(['remove', '--project-id', projectId], {
      output: output as never,
      error: error as never,
    });
    expect(output.text()).toContain(`Credential profile removed for project ${projectId}.`);
  });

  it('rejects raw token command-line arguments, positional values, and requires UUID project keys', async () => {
    directory = mkdtempSync(join(tmpdir(), 'taskhub-cli-'));
    vi.stubEnv('TASKHUB_CREDENTIALS_FILE', join(directory, 'credentials.json'));

    const sentinel = 'REDACTED_SENTINEL';
    const rejectedArguments = [
      ['add', '--project-id', projectId, `--token=${sentinel}`],
      ['add', '--project-id', projectId, `-t=${sentinel}`],
      ['add', '--project-id', projectId, sentinel],
      ['list', `--token=${sentinel}`],
      ['list', 'unexpected-positional'],
    ];

    for (const args of rejectedArguments) {
      const output = outputBuffer();
      await expect(runCredentialCli(args, {
        output: output as never,
        error: output as never,
        readSecret: async () => sentinel,
      })).rejects.toThrow('Unexpected credential command input');
      expect(output.text()).not.toContain(sentinel);
    }

    const output = outputBuffer();
    await expect(runCredentialCli(['add', '--project-id', 'PRJ-260919-ABCD'], {
      output: output as never,
      error: output as never,
      readSecret: async () => replacementToken,
    })).rejects.toThrow('project UUID');
    expect(output.text()).not.toContain(sentinel);
  });

  it('restores TTY raw mode after successful and failed hidden reads', async () => {
    const successInput = new PassThrough() as PassThrough & {
      isTTY?: boolean;
      setRawMode?: (mode: boolean) => void;
    };
    const successModes: boolean[] = [];
    successInput.isTTY = true;
    successInput.setRawMode = (mode) => successModes.push(mode);
    const successError = outputBuffer();
    const successRead = readSecret(successInput, successError as never);
    successInput.write('REDACTED_TTY_SENTINEL\n');

    await expect(successRead).resolves.toBe('REDACTED_TTY_SENTINEL');
    expect(successModes).toEqual([true, false]);
    expect(successError.text()).not.toContain('REDACTED_TTY_SENTINEL');

    const failedInput = new PassThrough() as PassThrough & {
      isTTY?: boolean;
      setRawMode?: (mode: boolean) => void;
    };
    const failedModes: boolean[] = [];
    failedInput.isTTY = true;
    failedInput.setRawMode = (mode) => failedModes.push(mode);
    const failedError = outputBuffer();
    const failedRead = readSecret(failedInput, failedError as never);
    failedInput.emit('error', new Error('REDACTED_TTY_FAILURE'));

    await expect(failedRead).rejects.toThrow('Credential input failed');
    expect(failedModes).toEqual([true, false]);
    expect(failedError.text()).not.toContain('REDACTED_TTY_FAILURE');
  });
});
