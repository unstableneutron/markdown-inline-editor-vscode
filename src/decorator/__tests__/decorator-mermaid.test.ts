jest.mock('../../mermaid/mermaid-renderer', () => ({
  initMermaidRenderer: jest.fn(),
  renderMermaidSvg: jest.fn(),
  getMermaidRendererFingerprint: jest.fn(() => 'fingerprint-a'),
  svgToDataUri: jest.fn((svg: string) => `data:${svg}`),
  createErrorSvg: jest.fn(() => '<svg></svg>'),
  saveSvgToHtml: jest.fn(),
  disposeMermaidRenderer: jest.fn(),
}));

import { Decorator } from '../../decorator';
import { MarkdownParseCache } from '../../markdown-parse-cache';
import { TextDocument, TextEditor, Selection, Uri, window } from '../../test/__mocks__/vscode';
import { getMermaidRendererFingerprint, renderMermaidSvg } from '../../mermaid/mermaid-renderer';

const mockRenderMermaidSvg = renderMermaidSvg as jest.MockedFunction<typeof renderMermaidSvg>;
const mockGetMermaidRendererFingerprint = getMermaidRendererFingerprint as jest.MockedFunction<typeof getMermaidRendererFingerprint>;

describe('Decorator - Mermaid diagrams', () => {
  const blockText = [
    '```mermaid',
    'graph TD',
    '  A --> B',
    '```',
  ].join('\n');
  const text = `${blockText}\nAfter`;

  const mermaidBlocks = [
    {
      startPos: 0,
      endPos: blockText.length,
      source: 'graph TD\n  A --> B',
      numLines: 2,
    },
  ];

  beforeEach(() => {
    mockRenderMermaidSvg.mockReset();
    mockRenderMermaidSvg.mockResolvedValue('<svg></svg>');
    mockGetMermaidRendererFingerprint.mockReset();
    mockGetMermaidRendererFingerprint.mockReturnValue('fingerprint-a');
    window.createTextEditorDecorationType.mockClear();
  });

  it('renders mermaid diagram when cursor is outside the block', async () => {
    const document = new TextDocument(Uri.file('test.md'), 'markdown', 1, text);
    const outsideOffset = text.indexOf('After') + 1;
    const outsidePosition = document.positionAt(outsideOffset);
    const selection = new Selection(outsidePosition, outsidePosition);
    const editor = new TextEditor(document, [selection]);
    const decorator = new Decorator(new MarkdownParseCache({} as any));

    (decorator as any).activeEditor = editor;
    // Return false = cursor is NOT inside the block, so rendering should happen
    (decorator as any).isSelectionOrCursorInsideOffsets = jest.fn().mockReturnValue(false);
    const applyMock = jest.fn();
    (decorator as any).mermaidDecorations = {
      apply: applyMock,
      clear: jest.fn(),
    };

    await (decorator as any).updateMermaidDiagrams(mermaidBlocks, text, document.version);

    expect(mockRenderMermaidSvg).toHaveBeenCalledTimes(1);
    expect(applyMock).toHaveBeenCalledTimes(1);
  });

  it('skips rendering when cursor is inside the block', async () => {
    const document = new TextDocument(Uri.file('test.md'), 'markdown', 1, text);
    const selection = new Selection(
      document.positionAt(0),
      document.positionAt(blockText.length)
    );
    const editor = new TextEditor(document, [selection]);
    const decorator = new Decorator(new MarkdownParseCache({} as any));

    (decorator as any).activeEditor = editor;
    // Return true = cursor IS inside the block, so rendering should be skipped
    (decorator as any).isSelectionOrCursorInsideOffsets = jest.fn().mockReturnValue(true);
    const applyMock = jest.fn();
    (decorator as any).mermaidDecorations = {
      apply: applyMock,
      clear: jest.fn(),
    };

    await (decorator as any).updateMermaidDiagrams(mermaidBlocks, text, document.version);

    expect(mockRenderMermaidSvg).not.toHaveBeenCalled();
    expect(applyMock).toHaveBeenCalledTimes(1);
  });

  it('deduplicates rendering for identical blocks during one update', async () => {
    const blockText2 = blockText;
    const text2 = `${blockText}\n\n${blockText2}\nAfter`;
    const document = new TextDocument(Uri.file('test.md'), 'markdown', 1, text2);
    const outsideOffset = text2.indexOf('After') + 1;
    const outsidePosition = document.positionAt(outsideOffset);
    const selection = new Selection(outsidePosition, outsidePosition);
    const editor = new TextEditor(document, [selection]);
    const decorator = new Decorator(new MarkdownParseCache({} as any));

    (decorator as any).activeEditor = editor;
    (decorator as any).isSelectionOrCursorInsideOffsets = jest.fn().mockReturnValue(false);
    const applyMock = jest.fn();
    (decorator as any).mermaidDecorations = {
      apply: applyMock,
      clear: jest.fn(),
    };

    const secondStart = blockText.length + 2; // "\n\n"
    const secondEnd = secondStart + blockText2.length;
    const blocks = [
      { startPos: 0, endPos: blockText.length, source: 'graph TD\n  A --> B', numLines: 2 },
      { startPos: secondStart, endPos: secondEnd, source: 'graph TD\n  A --> B', numLines: 2 },
    ];

    await (decorator as any).updateMermaidDiagrams(blocks, text2, document.version);

    expect(mockRenderMermaidSvg).toHaveBeenCalledTimes(1);
    expect(applyMock).toHaveBeenCalledTimes(1);
  });

  it('recreates Mermaid decoration entries when the renderer fingerprint changes', async () => {
    const document = new TextDocument(Uri.file('test.md'), 'markdown', 1, text);
    const outsideOffset = text.indexOf('After') + 1;
    const outsidePosition = document.positionAt(outsideOffset);
    const selection = new Selection(outsidePosition, outsidePosition);
    const editor = new TextEditor(document, [selection]);
    const decorator = new Decorator(new MarkdownParseCache({} as any));

    (decorator as any).activeEditor = editor;
    (decorator as any).isSelectionOrCursorInsideOffsets = jest.fn().mockReturnValue(false);

    await (decorator as any).updateMermaidDiagrams(mermaidBlocks, text, document.version);
    const callsAfterFirstRender = window.createTextEditorDecorationType.mock.calls.length;

    mockGetMermaidRendererFingerprint.mockReturnValue('fingerprint-b');
    mockRenderMermaidSvg.mockResolvedValueOnce('<svg data-variant="b"></svg>');

    await (decorator as any).updateMermaidDiagrams(mermaidBlocks, text, document.version);

    expect(window.createTextEditorDecorationType.mock.calls.length).toBe(callsAfterFirstRender + 1);
  });
});
