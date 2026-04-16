jest.mock('../../mermaid/mermaid-renderer', () => ({
  initMermaidRenderer: jest.fn(),
  renderMermaidSvg: jest.fn(),
  svgToDataUri: jest.fn((svg: string) => `data:${svg}`),
  createErrorSvg: jest.fn(() => '<svg></svg>'),
  saveSvgToHtml: jest.fn(),
  disposeMermaidRenderer: jest.fn(),
}));

import { Decorator } from '../../decorator';
import { MarkdownParseCache } from '../../markdown-parse-cache';
import { TextDocument, TextEditor, Selection, Uri } from '../../test/__mocks__/vscode';
import { renderMermaidSvg } from '../../mermaid/mermaid-renderer';

const mockRenderMermaidSvg = renderMermaidSvg as jest.MockedFunction<typeof renderMermaidSvg>;

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

  it('places the Mermaid indicator on the first content line in CRLF documents', async () => {
    const normalizedBlockText = [
      '```mermaid',
      'graph TD',
      '  A --> B',
      '```',
    ].join('\n');
    const normalizedText = ['Intro', normalizedBlockText, 'After'].join('\n');
    const originalText = normalizedText.replace(/\n/g, '\r\n');
    const blockStart = normalizedText.indexOf(normalizedBlockText);
    const blockEnd = blockStart + normalizedBlockText.length;
    const document = new TextDocument(Uri.file('test.md'), 'markdown', 1, originalText);
    const outsidePosition = document.positionAt(originalText.indexOf('After'));
    const editor = new TextEditor(document, [new Selection(outsidePosition, outsidePosition)]);
    editor.setDecorations = jest.fn();
    const decorator = new Decorator(new MarkdownParseCache({} as any));

    (decorator as any).activeEditor = editor;
    (decorator as any).isSelectionOrCursorInsideOffsets = jest.fn().mockReturnValue(false);
    (decorator as any).mermaidDecorations = {
      apply: jest.fn(),
      clear: jest.fn(),
    };

    await (decorator as any).updateMermaidDiagrams(
      [
        {
          startPos: blockStart,
          endPos: blockEnd,
          source: 'graph TD\n  A --> B',
          numLines: 2,
        },
      ],
      normalizedText,
      document.version,
    );

    expect(editor.setDecorations).toHaveBeenCalledWith(
      expect.anything(),
      [
        expect.objectContaining({
          start: expect.objectContaining({ line: 2, character: 0 }),
          end: expect.objectContaining({ line: 2, character: 1 }),
        }),
      ],
    );
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
});
