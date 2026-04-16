import { commands, extensions, languages, window } from '../test/__mocks__/vscode';

const preflightMmdrAvailabilityMock = jest.fn().mockResolvedValue(true);

jest.mock('../mermaid/mermaid-renderer', () => ({
  initMermaidRenderer: jest.fn(),
  disposeMermaidRenderer: jest.fn(),
  clearMermaidRenderCaches: jest.fn(),
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

describe('extension Mermaid viewer wiring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    preflightMmdrAvailabilityMock.mockReset();
    preflightMmdrAvailabilityMock.mockResolvedValue(true);
    (extensions.getExtension as jest.Mock).mockReturnValue({ isActive: true });
  });

  it('registers Mermaid viewer commands and wires the indicator click-selection path', () => {
    const selectionChangeSpy = jest
      .spyOn(window, 'onDidChangeTextEditorSelection')
      .mockImplementation(() => ({ dispose: jest.fn() }) as any);

    activate({
      subscriptions: [],
      extensionUri: { toString: () => 'file:///extension' },
      workspaceState: { get: jest.fn(), update: jest.fn() },
      globalState: { get: jest.fn(), update: jest.fn() },
    } as any);

    expect(commands.registerCommand).toHaveBeenCalledWith(
      'markdown-inline-editor.openMermaidViewer',
      expect.any(Function),
    );
    expect(commands.registerCommand).toHaveBeenCalledWith(
      'markdown-inline-editor.openMermaidViewerBeside',
      expect.any(Function),
    );
    expect(languages.registerHoverProvider).toHaveBeenCalled();

    const codeBlockHoverSelector = (languages.registerHoverProvider as jest.Mock).mock.calls.find(
      ([, provider]) => provider?.constructor?.name === 'CodeBlockHoverProvider',
    )?.[0];

    expect(codeBlockHoverSelector).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ language: 'markdown', scheme: 'file' }),
        expect.objectContaining({ language: 'mdx', scheme: 'file' }),
      ]),
    );

    // One listener is the decorator path; the second listener should come from
    // MermaidViewerClickHandler wiring for interactive-viewer indicator clicks.
    expect(selectionChangeSpy).toHaveBeenCalledTimes(2);
  });
});
