import { extensions, fireDidChangeConfiguration } from '../test/__mocks__/vscode';

const clearMermaidRenderCachesMock = jest.fn();
const preflightMmdrAvailabilityMock = jest.fn().mockResolvedValue(true);

jest.mock('../mermaid/mermaid-renderer', () => ({
  initMermaidRenderer: jest.fn(),
  disposeMermaidRenderer: jest.fn(),
  clearMermaidRenderCaches: () => clearMermaidRenderCachesMock(),
  preflightMmdrAvailability: () => preflightMmdrAvailabilityMock(),
  renderMermaidSvg: jest.fn(),
  renderMermaidSvgNatural: jest.fn(),
  svgToDataUri: jest.fn((svg: string) => `data:${svg}`),
  svgToDataUriBase64: jest.fn((svg: string) => `data64:${svg}`),
  createErrorSvg: jest.fn(() => '<svg></svg>'),
  ensureSvgDimensions: jest.fn((svg: string) => svg),
}));

jest.mock('../parser', () => ({
  MarkdownParser: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../markdown-parse-cache', () => ({
  MarkdownParseCache: jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    invalidate: jest.fn(),
  })),
}));

import { activate } from '../extension';
import { Decorator } from '../decorator';

describe('extension Mermaid configuration changes', () => {
  beforeEach(() => {
    clearMermaidRenderCachesMock.mockReset();
    preflightMmdrAvailabilityMock.mockReset();
    preflightMmdrAvailabilityMock.mockResolvedValue(true);
    (extensions.getExtension as jest.Mock).mockReturnValue({ isActive: true });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('clears Mermaid caches, rerenders, and reruns preflight when Mermaid settings change', () => {
    const updateSpy = jest.spyOn(Decorator.prototype, 'updateDecorationsForSelection').mockImplementation(() => {});

    activate({
      subscriptions: [],
      extensionUri: { toString: () => 'file:///extension' },
      workspaceState: { get: jest.fn(), update: jest.fn() },
      globalState: { get: jest.fn(), update: jest.fn() },
    } as any);

    clearMermaidRenderCachesMock.mockClear();
    preflightMmdrAvailabilityMock.mockClear();
    updateSpy.mockClear();

    fireDidChangeConfiguration({
      affectsConfiguration: (section: string) => section === 'markdownInlineEditor.mermaid',
    });

    expect(clearMermaidRenderCachesMock).toHaveBeenCalledTimes(1);
    expect(preflightMmdrAvailabilityMock).toHaveBeenCalledTimes(1);
    expect(updateSpy).toHaveBeenCalled();
  });
});
