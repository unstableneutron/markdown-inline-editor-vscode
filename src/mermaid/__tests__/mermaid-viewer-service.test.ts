import {
  Position,
  Selection,
  TextDocument,
  TextEditor,
  Uri,
  ViewColumn,
  window,
  registerMockTextDocument,
  clearRegisteredMockTextDocuments,
} from '../../test/__mocks__/vscode';
import type { MermaidBlock } from '../../parser';
import { MermaidViewerService } from '../mermaid-viewer-service';

const renderMermaidSvgNaturalMock = jest.fn<Promise<string>, unknown[]>();
const createErrorSvgMock = jest.fn<string, [string, number, number, boolean]>();

jest.mock('../mermaid-renderer', () => ({
  renderMermaidSvgNatural: (...args: unknown[]) => renderMermaidSvgNaturalMock(...args),
  createErrorSvg: (...args: [string, number, number, boolean]) => createErrorSvgMock(...args),
}));

describe('MermaidViewerService', () => {
  const markdown = '```mermaid\ngraph TD\nA-->B\n```';
  const mermaidBlock: MermaidBlock = {
    startPos: 0,
    endPos: markdown.length,
    source: 'graph TD\nA-->B',
    numLines: 2,
  };

  beforeEach(() => {
    renderMermaidSvgNaturalMock.mockReset();
    renderMermaidSvgNaturalMock.mockResolvedValue('<svg viewBox="0 0 100 100"></svg>');
    createErrorSvgMock.mockReset();
    createErrorSvgMock.mockImplementation((message) => `<svg data-error="${message}"></svg>`);
    clearRegisteredMockTextDocuments();
    window.activeTextEditor = undefined;
    window.visibleTextEditors = [];
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('opens the viewer in the current column when opening from a Mermaid block', async () => {
    const document = new TextDocument(Uri.file('/tmp/test.md'), 'markdown', 1, markdown);
    const editor = new TextEditor(document, [
      new Selection(new Position(1, 0), new Position(1, 0)),
    ]);
    editor.viewColumn = ViewColumn.Two;
    window.activeTextEditor = editor;

    const parseCache = {
      get: jest.fn(),
    } as any;

    const panel = {
      open: jest.fn(),
      dispose: jest.fn(),
    } as any;

    const service = new MermaidViewerService(parseCache, panel);

    await service.openFromBlock(document as any, mermaidBlock, false);

    expect(renderMermaidSvgNaturalMock).toHaveBeenCalledWith(
      mermaidBlock.source,
      expect.objectContaining({ theme: 'dark' }),
    );
    expect(panel.open).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Mermaid Preview',
        svg: '<svg viewBox="0 0 100 100"></svg>',
        source: mermaidBlock.source,
      }),
      ViewColumn.Two,
    );
  });

  it('opens the viewer beside when requested', async () => {
    const document = new TextDocument(Uri.file('/tmp/test.md'), 'markdown', 1, markdown);
    const parseCache = {
      get: jest.fn(),
    } as any;
    const panel = {
      open: jest.fn(),
      dispose: jest.fn(),
    } as any;

    const service = new MermaidViewerService(parseCache, panel);
    await service.openFromBlock(document as any, mermaidBlock, true);

    expect(panel.open).toHaveBeenCalledWith(
      expect.objectContaining({ source: mermaidBlock.source }),
      ViewColumn.Beside,
    );
  });

  it('falls back to an error SVG when rendering fails', async () => {
    const document = new TextDocument(Uri.file('/tmp/test.md'), 'markdown', 1, markdown);
    const panel = {
      open: jest.fn(),
      dispose: jest.fn(),
    } as any;

    renderMermaidSvgNaturalMock.mockRejectedValueOnce(new Error('render failed'));

    const service = new MermaidViewerService({ get: jest.fn() } as any, panel);
    await service.openFromBlock(document as any, mermaidBlock, false);

    expect(createErrorSvgMock).toHaveBeenCalledWith('render failed', 800, 600, true);
    expect(panel.open).toHaveBeenCalledWith(
      expect.objectContaining({
        svg: '<svg data-error="render failed"></svg>',
      }),
      ViewColumn.One,
    );
  });

  it('ignores stale render completions when a newer request finishes first', async () => {
    const firstBlock: MermaidBlock = {
      startPos: 0,
      endPos: markdown.length,
      source: 'graph TD\nA-->B',
      numLines: 2,
    };
    const secondBlock: MermaidBlock = {
      startPos: 0,
      endPos: markdown.length,
      source: 'graph LR\nC-->D',
      numLines: 2,
    };
    const document = new TextDocument(Uri.file('/tmp/test.md'), 'markdown', 1, markdown);
    const panel = {
      open: jest.fn(),
      dispose: jest.fn(),
    } as any;

    let resolveFirst!: (svg: string) => void;
    let resolveSecond!: (svg: string) => void;
    renderMermaidSvgNaturalMock
      .mockImplementationOnce(() => new Promise((resolve) => {
        resolveFirst = resolve;
      }))
      .mockImplementationOnce(() => new Promise((resolve) => {
        resolveSecond = resolve;
      }));

    const service = new MermaidViewerService({ get: jest.fn() } as any, panel);
    const firstRequest = service.openFromBlock(document as any, firstBlock, false);
    const secondRequest = service.openFromBlock(document as any, secondBlock, false);

    resolveSecond('<svg data-request="second"></svg>');
    await secondRequest;

    expect(panel.open).toHaveBeenCalledTimes(1);
    expect(panel.open).toHaveBeenLastCalledWith(
      expect.objectContaining({
        svg: '<svg data-request="second"></svg>',
        source: secondBlock.source,
      }),
      ViewColumn.One,
    );

    resolveFirst('<svg data-request="first"></svg>');
    await firstRequest;

    expect(panel.open).toHaveBeenCalledTimes(1);
  });

  it('opens from command arguments using document URI + block start position', async () => {
    const commandMarkdown = [
      '```mermaid',
      'graph TD',
      'A-->B',
      '```',
      '',
      '```mermaid',
      'graph LR',
      'C-->D',
      '```',
    ].join('\n');

    const firstBlockStart = commandMarkdown.indexOf('```mermaid');
    const secondBlockStart = commandMarkdown.indexOf('```mermaid', firstBlockStart + 1);
    const secondBlockEnd = commandMarkdown.length;

    const commandUri = Uri.file('/tmp/command.md');
    const commandDocument = registerMockTextDocument(commandUri, {
      language: 'markdown',
      content: commandMarkdown,
    });

    const parseCache = {
      get: jest.fn().mockReturnValue({
        text: commandMarkdown,
        decorations: [],
        mermaidBlocks: [
          {
            startPos: firstBlockStart,
            endPos: secondBlockStart - 2,
            source: 'graph TD\nA-->B',
            numLines: 2,
          },
          {
            startPos: secondBlockStart,
            endPos: secondBlockEnd,
            source: 'graph LR\nC-->D',
            numLines: 2,
          },
        ],
      }),
    } as any;

    const panel = {
      open: jest.fn(),
      dispose: jest.fn(),
    } as any;

    const service = new MermaidViewerService(parseCache, panel);
    await service.openFromCommand(commandUri.toString(), secondBlockStart, false);

    expect(parseCache.get).toHaveBeenCalledWith(commandDocument);
    expect(panel.open).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'graph LR\nC-->D' }),
      ViewColumn.One,
    );
  });
});
