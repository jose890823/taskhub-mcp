import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { getRequestContext, withProjectContext } from '../src/context.js';

const context = {
  projectId: 'project-a',
  projectName: 'Project A',
  projectSlug: 'project-a',
  systemCode: 'PRJ-A',
  organizationId: null,
  organizationName: null,
};

let directory: string | undefined;

afterEach(() => {
  if (directory) rmSync(directory, { recursive: true, force: true });
  directory = undefined;
});

describe('project request context contract', () => {
  it('propagates exactly the linked effective project', () => {
    directory = mkdtempSync(join(tmpdir(), 'taskhub-context-'));
    writeFileSync(join(directory, '.taskhub.json'), JSON.stringify(context));

    const requestContext = getRequestContext(directory);

    expect(requestContext.projectId).toBe('project-a');
    expect(withProjectContext({ statusId: 'status-1' }, requestContext)).toEqual({
      statusId: 'status-1',
      projectId: 'project-a',
    });
  });

  it('rejects an explicit project that would override the linked context', () => {
    directory = mkdtempSync(join(tmpdir(), 'taskhub-context-'));
    writeFileSync(join(directory, '.taskhub.json'), JSON.stringify(context));

    expect(() => withProjectContext(
      { projectId: 'project-b' },
      getRequestContext(directory),
    )).toThrow('does not match the linked project context');
  });
});
