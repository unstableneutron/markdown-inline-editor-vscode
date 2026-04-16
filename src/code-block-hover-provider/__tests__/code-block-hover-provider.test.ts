import { CodeBlockHoverProvider } from '../../code-block-hover-provider';
import * as mermaidIndicator from '../../mermaid/indicator';
import {
  CancellationToken,
  MarkdownString,
  Position,
  TextDocument,
  Uri,
  workspace,
} from '../../test/__mocks__/vscode';

const renderMermaidSvgNaturalMock = jest.fn<Promise<string>, unknown[]>();

jest.mock('../../mermaid/mermaid-renderer', () => ({
  renderMermaidSvgNatural: (...args: unknown[]) => renderMermaidSvgNaturalMock(...args),
  createErrorSvg: jest.fn((message: string) => `<svg data-error="${message}" viewBox="0 0 800 200"></svg>`),
  svgToDataUri: jest.fn((svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`),
}));

describe('CodeBlockHoverProvider (Mermaid preview modes)', () => {
  let previewMode: 'hover' | 'interactive-viewer';

  beforeEach(() => {
    previewMode = 'interactive-viewer';
    renderMermaidSvgNaturalMock.mockReset();
    renderMermaidSvgNaturalMock.mockResolvedValue(
      '<svg width="200" height="100" viewBox="0 0 200 100"></svg>',
    );

    jest.spyOn(workspace, 'getConfiguration').mockImplementation((_section?: string) => ({
      get: <T>(key: string, defaultValue?: T): T | undefined => {
        if (key === 'mermaid.previewMode') {
          return previewMode as T;
        }
        return defaultValue;
      },
    }) as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function createParseCache(text: string): any {
    return {
      get: jest.fn().mockReturnValue({
        text,
        decorations: [],
        mermaidBlocks: [
          {
            startPos: text.indexOf('```mermaid'),
            endPos: text.length,
            source: 'graph TD\nA-->B',
            numLines: 2,
          },
        ],
      }),
    };
  }

  it('returns command links instead of embedded image previews in interactive-viewer mode', async () => {
    const text = '```mermaid\ngraph TD\nA-->B\n```';
    const parseCache = createParseCache(text);
    const provider = new CodeBlockHoverProvider(parseCache);
    const document = new TextDocument(Uri.file('/tmp/test.md'), 'markdown', 1, text);

    const hover = await provider.provideHover(
      document as any,
      new Position(1, 0) as any,
      new CancellationToken(false) as any,
    );

    expect(hover).toBeDefined();
    const markdown = hover?.contents as MarkdownString;
    expect(markdown.value).toContain('Open viewer');
    expect(markdown.value).toContain('Open beside');
    expect(markdown.value).toContain('command:markdown-inline-editor.openMermaidViewer');
    expect(markdown.value).toContain('command:markdown-inline-editor.openMermaidViewerBeside');
    expect(markdown.value).not.toContain('<img');
  });

  it('keeps image preview behavior in hover mode', async () => {
    previewMode = 'hover';

    const text = '```mermaid\ngraph TD\nA-->B\n```';
    const parseCache = createParseCache(text);
    const provider = new CodeBlockHoverProvider(parseCache);
    const document = new TextDocument(Uri.file('/tmp/test.md'), 'markdown', 1, text);

    const hover = await provider.provideHover(
      document as any,
      new Position(1, 0) as any,
      new CancellationToken(false) as any,
    );

    expect(hover).toBeDefined();
    const markdown = hover?.contents as MarkdownString;
    expect(markdown.value).toContain('<img');
    expect(markdown.value).toContain('mermaid diagram preview');
    expect(markdown.value).not.toContain('Open viewer');
  });

  it('uses the shared Mermaid indicator helper for indicator hit-testing', async () => {
    previewMode = 'interactive-viewer';

    const text = '```mermaid\ngraph TD\nA-->B\n```';
    const parseCache = createParseCache(text);
    const provider = new CodeBlockHoverProvider(parseCache);
    const document = new TextDocument(Uri.file('/tmp/test.md'), 'markdown', 1, text);
    const indicatorSpy = jest.spyOn(mermaidIndicator, 'getMermaidIndicatorOffsets');

    const hover = await provider.provideHover(
      document as any,
      new Position(1, 0) as any,
      new CancellationToken(false) as any,
    );

    expect(indicatorSpy).toHaveBeenCalled();
    expect(hover).toBeDefined();
    const markdown = hover?.contents as MarkdownString;
    expect(markdown.value).toContain('Open viewer');
  });
});
