import { stdin, stderr, stdout } from 'node:process';
import type { Readable, Writable } from 'node:stream';
import { getCredentialStorePath } from './config.js';
import { CredentialStore, CredentialStoreError, isProjectUuid } from './credential-store.js';

export interface CredentialCliIO {
  input?: Readable;
  output?: Writable;
  error?: Writable;
  readSecret?: () => Promise<string>;
}

function writeLine(output: Writable, text: string): void {
  output.write(`${text}\n`);
}

export async function readSecret(input: Readable, error: Writable): Promise<string> {
  error.write('Token (hidden): ');
  const terminalInput = input as Readable & {
    isTTY?: boolean;
    setRawMode?: (mode: boolean) => void;
  };

  if (terminalInput.isTTY && terminalInput.setRawMode) {
    let value = '';
    const onData = (chunk: Buffer | string, resolve: (value: string) => void, reject: (reason: Error) => void) => {
      for (const character of chunk.toString()) {
        if (character === '\u0003') {
          reject(new CredentialStoreError('Credential setup cancelled.'));
          return;
        }
        if (character === '\r' || character === '\n') {
          resolve(value);
          return;
        }
        if (character === '\u007f' || character === '\b') {
          value = value.slice(0, -1);
        } else {
          value += character;
        }
      }
    };
    const onError = () => new CredentialStoreError('Credential input failed.');
    let handleData: ((chunk: Buffer | string) => void) | undefined;
    let handleError: (() => void) | undefined;

    try {
      // Keep the method call bound to the TTY stream. Detaching setRawMode loses
      // its receiver on Node's ReadStream implementation.
      terminalInput.setRawMode(true);
      return await new Promise<string>((resolve, reject) => {
        handleData = (chunk: Buffer | string) => onData(chunk, resolve, reject);
        handleError = () => reject(onError());
        terminalInput.on('data', handleData);
        terminalInput.once('error', handleError);
        terminalInput.resume();
      });
    } finally {
      if (handleData) terminalInput.off('data', handleData);
      if (handleError) terminalInput.off('error', handleError);
      try {
        // Always restore canonical terminal input, including rejected reads.
        terminalInput.setRawMode(false);
      } catch {
        // Do not replace the safe CLI error with a raw TTY implementation error.
      } finally {
        error.write('\n');
      }
    }
  }

  const chunks: Buffer[] = [];
  for await (const chunk of input) chunks.push(Buffer.from(chunk));
  error.write('\n');
  return Buffer.concat(chunks).toString('utf8').trim();
}

function usage(): string {
  return [
    'TaskHub credential profiles (tokens are entered through hidden stdin only):',
    '  taskhub-mcp credentials add --project-id <project-uuid> [--label <label>]',
    '  taskhub-mcp credentials update --project-id <project-uuid> [--label <label>]',
    '  taskhub-mcp credentials remove --project-id <project-uuid>',
    '  taskhub-mcp credentials list',
    '  taskhub-mcp credentials path',
    '',
    'The credential store is outside the repository and is never printed with token values.',
  ].join('\n');
}

function rejectUnexpectedInput(): never {
  throw new CredentialStoreError('Unexpected credential command input. Use --help for supported commands.');
}

function parseOptions(command: string, args: string[]): { projectId?: string; label?: string } {
  const allowed = command === 'remove'
    ? new Set(['--project-id'])
    : new Set(['--project-id', '--label']);
  const parsed: { projectId?: string; label?: string } = {};

  for (let index = 0; index < args.length; index += 1) {
    const option = args[index];
    if (!option.startsWith('--') || option.includes('=') || !allowed.has(option)) {
      rejectUnexpectedInput();
    }

    const value = args[index + 1];
    if (!value || value.startsWith('-')) rejectUnexpectedInput();
    if (option === '--project-id') {
      if (parsed.projectId) rejectUnexpectedInput();
      parsed.projectId = value;
    } else {
      if (parsed.label) rejectUnexpectedInput();
      parsed.label = value;
    }
    index += 1;
  }

  return parsed;
}

export async function runCredentialCli(args: string[], io: CredentialCliIO = {}): Promise<void> {
  const output = io.output || stdout;
  const error = io.error || stderr;
  const input = io.input || stdin;
  const command = args[0] || 'help';

  if (command === 'help' || command === '--help' || command === '-h') {
    if (args.length > 1) rejectUnexpectedInput();
    writeLine(output, usage());
    return;
  }

  const store = new CredentialStore(getCredentialStorePath());

  if (command === 'list') {
    if (args.length > 1) rejectUnexpectedInput();
    const profiles = store.listMetadata();
    if (!profiles.length) {
      writeLine(output, 'No TaskHub credential profiles are configured.');
      return;
    }
    writeLine(output, 'TaskHub credential profiles:');
    for (const profile of profiles) {
      const label = profile.label ? ` — ${profile.label}` : '';
      writeLine(output, `- ${profile.projectId}${label} (updated ${profile.updatedAt})`);
    }
    return;
  }

  if (command === 'path') {
    if (args.length > 1) rejectUnexpectedInput();
    writeLine(output, `Credential store: ${store.filePath}`);
    return;
  }

  if (!['add', 'update', 'remove'].includes(command)) {
    throw new CredentialStoreError('Unknown credentials command. Use --help for usage.');
  }

  const options = parseOptions(command, args.slice(1));
  const projectId = options.projectId;
  if (!projectId || !isProjectUuid(projectId)) {
    throw new CredentialStoreError('A valid project UUID is required via --project-id. Do not use a display code or slug.');
  }

  if (command === 'remove') {
    const removed = store.remove(projectId);
    writeLine(output, removed
      ? `Credential profile removed for project ${projectId}.`
      : `No credential profile exists for project ${projectId}.`);
    return;
  }

  const label = options.label;
  const token = io.readSecret ? await io.readSecret() : await readSecret(input, error);
  store.setToken(projectId, token, label);
  writeLine(output, `Credential profile ${command === 'add' ? 'registered' : 'updated'} for project ${projectId}.`);
}
