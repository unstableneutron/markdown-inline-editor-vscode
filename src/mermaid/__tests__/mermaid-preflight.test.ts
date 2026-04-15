import { Uri, window, workspace } from '../../test/__mocks__/vscode';

const isMmdrAvailableMock = jest.fn();
const renderMmdrSvgMock = jest.fn();
const requestSvgMock = jest.fn();

jest.mock('../mmdr-renderer', () => ({
  isMmdrAvailable: (...args: unknown[]) => isMmdrAvailableMock(...args),
  renderMmdrSvg: (...args: unknown[]) => renderMmdrSvgMock(...args),
}));

jest.mock('../webview-manager', () => ({
  MermaidWebviewManager: jest.fn().mockImplementation(() => ({
    initialize: jest.fn(),
    waitForWebview: jest.fn().mockResolvedValue(undefined),
    requestSvg: requestSvgMock,
    dispose: jest.fn(),
  })),
}));

import {
  clearMermaidRenderCaches,
  disposeMermaidRenderer,
  initMermaidRenderer,
  preflightMmdrAvailability,
  renderMermaidSvgNatural,
} from '../mermaid-renderer';

describe('Mermaid mmdr preflight', () => {
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.restoreAllMocks();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    isMmdrAvailableMock.mockReset();
    renderMmdrSvgMock.mockReset();
    requestSvgMock.mockReset();
    requestSvgMock.mockResolvedValue('<svg data-official="true"></svg>');

    jest.spyOn(workspace, 'getConfiguration').mockReturnValue({
      get: <T>(key: string, defaultValue?: T): T | undefined => {
        if (key === 'mermaid.renderer') return 'mermaid-rs-renderer' as T;
        if (key === 'mermaid.mmdr.command') return 'mmdr' as T;
        return defaultValue;
      },
    } as any);

    clearMermaidRenderCaches();
    disposeMermaidRenderer();
    initMermaidRenderer({ subscriptions: [], extensionUri: Uri.file('/extension') } as any);
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    clearMermaidRenderCaches();
    disposeMermaidRenderer();
  });

  it('warns once and returns false when mmdr is unavailable', async () => {
    isMmdrAvailableMock.mockResolvedValue(false);

    await expect(preflightMmdrAvailability()).resolves.toBe(false);
    await expect(preflightMmdrAvailability()).resolves.toBe(false);

    expect(window.showWarningMessage).toHaveBeenCalledTimes(1);
    expect(window.showWarningMessage).toHaveBeenCalledWith(
      expect.stringContaining('mmdr')
    );
  });

  it('falls back without retrying mmdr after preflight marks it unavailable', async () => {
    isMmdrAvailableMock.mockResolvedValue(false);
    renderMmdrSvgMock.mockRejectedValue(new Error('should not retry'));

    await preflightMmdrAvailability();

    await expect(renderMermaidSvgNatural('graph TD\nA-->B', { theme: 'default' })).resolves.toContain('data-official="true"');

    expect(renderMmdrSvgMock).not.toHaveBeenCalled();
    expect(requestSvgMock).toHaveBeenCalled();
  });
});
