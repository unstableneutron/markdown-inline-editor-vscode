import { EventEmitter } from 'node:events';
import { CancellationToken, Uri, workspace } from '../../test/__mocks__/vscode';

const spawnMock = jest.fn();
const requestSvgMock = jest.fn();

jest.mock('node:child_process', () => ({
  spawn: (...args: unknown[]) => spawnMock(...args),
}));

jest.mock('../webview-manager', () => ({
  MermaidWebviewManager: jest.fn().mockImplementation(() => ({
    initialize: jest.fn(),
    waitForWebview: jest.fn().mockResolvedValue(undefined),
    requestSvg: requestSvgMock,
    dispose: jest.fn(),
  })),
}));

import { renderMmdrSvg } from '../mmdr-renderer';
import { disposeMermaidRenderer, initMermaidRenderer, renderMermaidSvgNatural } from '../mermaid-renderer';

function createSpawnProcess(): EventEmitter & {
  stdout: EventEmitter;
  stderr: EventEmitter;
  stdin: { write: jest.Mock; end: jest.Mock };
  kill: jest.Mock;
} {
  const child = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
    stdin: { write: jest.Mock; end: jest.Mock };
    kill: jest.Mock;
  };

  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.stdin = { write: jest.fn(), end: jest.fn() };
  child.kill = jest.fn();

  return child;
}

describe('mmdr renderer', () => {
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    spawnMock.mockReset();
    requestSvgMock.mockReset();
    requestSvgMock.mockResolvedValue('<svg data-official="true"></svg>');
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    jest.spyOn(workspace, 'getConfiguration').mockReturnValue({
      get: <T>(key: string, defaultValue?: T): T | undefined => {
        if (key === 'mermaid.renderer') return 'mermaid-rs-renderer' as T;
        if (key === 'mermaid.mmdr.command') return 'mmdr' as T;
        if (key === 'mermaid.mmdr.preferredAspectRatio') return '16:9' as T;
        if (key === 'mermaid.mmdr.nodeSpacing') return 60 as T;
        if (key === 'mermaid.mmdr.rankSpacing') return 80 as T;
        if (key === 'mermaid.mmdr.fastText') return true as T;
        return defaultValue;
      },
    } as any);
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    jest.restoreAllMocks();
    disposeMermaidRenderer();
  });

  it('builds the configured CLI command and returns SVG from stdout', async () => {
    const child = createSpawnProcess();
    spawnMock.mockReturnValue(child);

    const promise = renderMmdrSvg('graph TD\nA-->B', {
      command: 'mmdr',
      preferredAspectRatio: '16:9',
      nodeSpacing: 60,
      rankSpacing: 80,
      fastText: true,
      timeoutMs: 5000,
    });

    child.stdout.emit('data', Buffer.from('<svg></svg>'));
    child.emit('close', 0);

    await expect(promise).resolves.toBe('<svg></svg>');
    expect(spawnMock).toHaveBeenCalledWith(
      'mmdr',
      ['-i', '-', '-e', 'svg', '--preferredAspectRatio', '16:9', '--nodeSpacing', '60', '--rankSpacing', '80', '--fastText'],
      { stdio: ['pipe', 'pipe', 'pipe'] },
    );
    expect(child.stdin.write).toHaveBeenCalledWith('graph TD\nA-->B');
    expect(child.stdin.end).toHaveBeenCalled();
  });

  it('falls back to the official renderer when the CLI fails', async () => {
    const child = createSpawnProcess();
    spawnMock.mockReturnValue(child);
    initMermaidRenderer({ subscriptions: [], extensionUri: Uri.file('/extension') } as any);

    const promise = renderMermaidSvgNatural('graph TD\nA-->B', { theme: 'default' });

    child.emit('error', Object.assign(new Error('spawn ENOENT'), { code: 'ENOENT' }));

    await expect(promise).resolves.toContain('data-official="true"');
    expect(spawnMock).toHaveBeenCalled();
    expect(requestSvgMock).toHaveBeenCalled();
  });

  it('rejects malformed stdout that is not real SVG', async () => {
    const child = createSpawnProcess();
    spawnMock.mockReturnValue(child);

    const promise = renderMmdrSvg('graph TD\nA-->B', {
      command: 'mmdr',
      preferredAspectRatio: undefined,
      nodeSpacing: undefined,
      rankSpacing: undefined,
      fastText: false,
      timeoutMs: 5000,
    });

    child.stdout.emit('data', Buffer.from('noise before <svg></svg> noise after'));
    child.emit('close', 0);

    await expect(promise).rejects.toThrow('mmdr did not return SVG output');
  });

  it('returns mmdr SVG through the hover path when the CLI succeeds', async () => {
    const child = createSpawnProcess();
    spawnMock.mockReturnValue(child);
    initMermaidRenderer({ subscriptions: [], extensionUri: Uri.file('/extension') } as any);

    const promise = renderMermaidSvgNatural('graph TD\nA-->B', { theme: 'default' });

    child.stdout.emit('data', Buffer.from('<svg data-mmdr="true"></svg>'));
    child.emit('close', 0);

    await expect(promise).resolves.toContain('data-mmdr="true"');
    expect(requestSvgMock).not.toHaveBeenCalled();
  });

  it('does not permanently disable mmdr after a non-availability render failure', async () => {
    const failingChild = createSpawnProcess();
    const succeedingChild = createSpawnProcess();
    spawnMock.mockReturnValueOnce(failingChild).mockReturnValueOnce(succeedingChild);
    initMermaidRenderer({ subscriptions: [], extensionUri: Uri.file('/extension') } as any);

    const firstPromise = renderMermaidSvgNatural('graph TD\nA-->B', { theme: 'default' });
    failingChild.stderr.emit('data', Buffer.from('bad diagram'));
    failingChild.emit('close', 1);

    await expect(firstPromise).resolves.toContain('data-official="true"');

    const secondPromise = renderMermaidSvgNatural('graph TD\nA-->B', { theme: 'default' });
    succeedingChild.stdout.emit('data', Buffer.from('<svg data-mmdr="retry"></svg>'));
    succeedingChild.emit('close', 0);

    await expect(secondPromise).resolves.toContain('data-mmdr="retry"');
    expect(spawnMock).toHaveBeenCalledTimes(2);
  });

  it('rejects when both mmdr and the official renderer fail', async () => {
    const child = createSpawnProcess();
    spawnMock.mockReturnValue(child);
    requestSvgMock.mockRejectedValueOnce(new Error('official failed'));
    initMermaidRenderer({ subscriptions: [], extensionUri: Uri.file('/extension') } as any);

    const promise = renderMermaidSvgNatural('graph TD\nA-->B', { theme: 'default' });
    child.stderr.emit('data', Buffer.from('bad diagram'));
    child.emit('close', 1);

    await expect(promise).rejects.toThrow('official failed');
  });

  it('propagates official renderer failures without treating them as mmdr failures', async () => {
    requestSvgMock.mockRejectedValueOnce(new Error('official failed'));
    jest.spyOn(workspace, 'getConfiguration').mockReturnValue({
      get: <T>(key: string, defaultValue?: T): T | undefined => {
        if (key === 'mermaid.renderer') return 'official-mermaid-js' as T;
        return defaultValue;
      },
    } as any);
    initMermaidRenderer({ subscriptions: [], extensionUri: Uri.file('/extension') } as any);

    await expect(renderMermaidSvgNatural('graph TD\nA-->B', { theme: 'default' })).rejects.toThrow('official failed');
    expect(spawnMock).not.toHaveBeenCalled();
    expect(consoleWarnSpy).not.toHaveBeenCalledWith(
      'Mermaid mmdr render failed, falling back to official renderer:',
      expect.anything(),
    );
  });

  it('cancels an in-flight mmdr hover render', async () => {
    const child = createSpawnProcess();
    spawnMock.mockReturnValue(child);
    initMermaidRenderer({ subscriptions: [], extensionUri: Uri.file('/extension') } as any);

    const token = new CancellationToken(false);
    const promise = renderMermaidSvgNatural('graph TD\nA-->B', { theme: 'default' }, token as any);

    token.cancel();

    await expect(promise).rejects.toThrow('Operation cancelled');
    expect(child.kill).toHaveBeenCalled();
  });
});
