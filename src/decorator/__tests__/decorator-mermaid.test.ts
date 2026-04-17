jest.mock('../../mermaid/mermaid-renderer', () => ({
  initMermaidRenderer: jest.fn(),
  renderMermaidSvg: jest.fn(),
  getMermaidRendererFingerprint: jest.fn(() => 'fingerprint-a'),
  svgToDataUri: jest.fn((svg: string) => `data:${svg}`),
  createErrorSvg: jest.fn(() => '<svg></svg>'),
  saveSvgToHtml: jest.fn(),
  disposeMermaidRenderer: jest.fn(),
}));

jest.mock('../../vim-mode', () => ({
  resolveEditorInteractionMode: jest.fn().mockResolvedValue('interactiveEdit'),
}));

import { Decorator } from '../../decorator';
import { MarkdownParseCache } from '../../markdown-parse-cache';
import { TextDocument, TextEditor, Selection, TextEditorSelectionChangeKind, Uri, window } from '../../test/__mocks__/vscode';
import { getMermaidRendererFingerprint, renderMermaidSvg } from '../../mermaid/mermaid-renderer';
import { resolveEditorInteractionMode } from '../../vim-mode';

const mockRenderMermaidSvg = renderMermaidSvg as jest.MockedFunction<typeof renderMermaidSvg>;
const mockGetMermaidRendererFingerprint = getMermaidRendererFingerprint as jest.MockedFunction<typeof getMermaidRendererFingerprint>;
const mockResolveEditorInteractionMode = resolveEditorInteractionMode as jest.MockedFunction<typeof resolveEditorInteractionMode>;

function createDecoratorWithMermaidCache(
  customText: string,
  customBlocks: Array<{ startPos: number; endPos: number; source: string; numLines: number }>,
) {
  const parseCache = {
    get: () => ({
      version: 1,
      text: customText,
      decorations: [],
      scopes: [],
      mermaidBlocks: customBlocks,
      mathRegions: [],
    }),
    invalidate: () => {},
    clear: () => {},
  };

  const decorator = new Decorator(parseCache as any) as any;
  decorator.mermaidDecorations = {
    apply: jest.fn(),
    clear: jest.fn(),
  };
  return decorator;
}

describe('Decorator - Mermaid diagrams', () => {
  const blockText = [
    '```mermaid',
    'graph TD',
    '  A --> B',
    '```',
  ].join('\n');
  const text = `Before\n${blockText}\nAfter`;

  const mermaidBlocks = [
    {
      startPos: 'Before\n'.length,
      endPos: 'Before\n'.length + blockText.length,
      source: 'graph TD\n  A --> B',
      numLines: 2,
    },
  ];

  beforeEach(() => {
    mockRenderMermaidSvg.mockReset();
    mockRenderMermaidSvg.mockResolvedValue('<svg></svg>');
    mockGetMermaidRendererFingerprint.mockReset();
    mockGetMermaidRendererFingerprint.mockReturnValue('fingerprint-a');
    mockResolveEditorInteractionMode.mockReset();
    mockResolveEditorInteractionMode.mockResolvedValue('interactiveEdit');
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

  it('keeps Mermaid rendered in viewOnly mode when cursor is inside the block', async () => {
    const document = new TextDocument(Uri.file('test.md'), 'markdown', 1, text);
    const selection = new Selection(
      document.positionAt(blockText.indexOf('A --> B')),
      document.positionAt(blockText.indexOf('A --> B'))
    );
    const editor = new TextEditor(document, [selection]);
    const decorator = new Decorator(new MarkdownParseCache({} as any));

    (decorator as any).activeEditor = editor;
    (decorator as any).isSelectionOrCursorInsideOffsets = jest.fn().mockReturnValue(true);
    const applyMock = jest.fn();
    (decorator as any).mermaidDecorations = {
      apply: applyMock,
      clear: jest.fn(),
    };

    await (decorator as any).updateMermaidDiagrams(
      mermaidBlocks,
      text,
      document.version,
      'viewOnly',
    );

    expect(mockRenderMermaidSvg).toHaveBeenCalledTimes(1);
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

  it('parks the cursor outside Mermaid blocks in viewOnly mode and restores it in interactiveEdit', async () => {
    const document = new TextDocument(Uri.file('test.md'), 'markdown', 1, text);
    const outsideOffset = text.indexOf('After') + 1;
    const outsidePosition = document.positionAt(outsideOffset);
    const insideOffset = text.indexOf('A --> B') + 1;
    const insidePosition = document.positionAt(insideOffset);
    const editor = new TextEditor(document, [new Selection(outsidePosition, outsidePosition)]);
    const decorator = createDecoratorWithMermaidCache(text, mermaidBlocks);

    (decorator as any).activeEditor = editor;
    mockResolveEditorInteractionMode
      .mockResolvedValueOnce('viewOnly')
      .mockResolvedValueOnce('viewOnly')
      .mockResolvedValueOnce('interactiveEdit');

    await (decorator as any).updateDecorationsInternal();

    editor.selections = [new Selection(insidePosition, insidePosition)];
    editor.selection = editor.selections[0];

    await (decorator as any).updateDecorationsInternal();

    expect(editor.selection.active).toEqual(outsidePosition);

    await (decorator as any).updateDecorationsInternal();

    expect(editor.selection.active).toEqual(insidePosition);
  });

  it('skips downward past Mermaid blocks on vertical viewOnly navigation', async () => {
    const document = new TextDocument(Uri.file('test.md'), 'markdown', 1, text);
    const beforePosition = document.positionAt(text.indexOf('Before'));
    const insidePosition = document.positionAt(text.indexOf('A --> B') + 1);
    const afterPosition = document.positionAt(text.indexOf('After'));
    const editor = new TextEditor(document, [new Selection(beforePosition, beforePosition)]);
    const decorator = createDecoratorWithMermaidCache(text, mermaidBlocks);

    (decorator as any).activeEditor = editor;
    mockResolveEditorInteractionMode
      .mockResolvedValueOnce('viewOnly')
      .mockResolvedValueOnce('viewOnly');

    await (decorator as any).updateDecorationsInternal();

    editor.selections = [new Selection(insidePosition, insidePosition)];
    editor.selection = editor.selections[0];
    (decorator as any).pendingSelectionChangeKind = TextEditorSelectionChangeKind.Keyboard;

    await (decorator as any).updateDecorationsInternal();

    expect(editor.selection.active).toEqual(afterPosition);
  });

  it('skips upward before Mermaid blocks on vertical viewOnly navigation', async () => {
    const document = new TextDocument(Uri.file('test.md'), 'markdown', 1, text);
    const afterPosition = document.positionAt(text.indexOf('After'));
    const insidePosition = document.positionAt(text.indexOf('A --> B') + 1);
    const beforeLinePosition = document.positionAt(text.indexOf('Before'));
    const editor = new TextEditor(document, [new Selection(afterPosition, afterPosition)]);
    const decorator = createDecoratorWithMermaidCache(text, mermaidBlocks);

    (decorator as any).activeEditor = editor;
    mockResolveEditorInteractionMode
      .mockResolvedValueOnce('viewOnly')
      .mockResolvedValueOnce('viewOnly');

    await (decorator as any).updateDecorationsInternal();

    editor.selections = [new Selection(insidePosition, insidePosition)];
    editor.selection = editor.selections[0];
    (decorator as any).pendingSelectionChangeKind = TextEditorSelectionChangeKind.Keyboard;

    await (decorator as any).updateDecorationsInternal();

    expect(editor.selection.active).toEqual(beforeLinePosition);
  });

  it('parks on normal-mode entry from inside Mermaid then skips out on the next vertical move', async () => {
    const document = new TextDocument(Uri.file('test.md'), 'markdown', 1, text);
    const insidePosition = document.positionAt(text.indexOf('A --> B') + 1);
    const afterPosition = document.positionAt(text.indexOf('After'));
    const editor = new TextEditor(document, [new Selection(insidePosition, insidePosition)]);
    const decorator = createDecoratorWithMermaidCache(text, mermaidBlocks);

    (decorator as any).activeEditor = editor;
    mockResolveEditorInteractionMode
      .mockResolvedValueOnce('interactiveEdit')
      .mockResolvedValueOnce('viewOnly')
      .mockResolvedValueOnce('viewOnly');

    await (decorator as any).updateDecorationsInternal();
    await (decorator as any).updateDecorationsInternal();

    expect(editor.selection.active.line).toBeLessThan(insidePosition.line);

    editor.selections = [new Selection(insidePosition, insidePosition)];
    editor.selection = editor.selections[0];
    (decorator as any).pendingSelectionChangeKind = TextEditorSelectionChangeKind.Keyboard;

    await (decorator as any).updateDecorationsInternal();

    expect(editor.selection.active).toEqual(afterPosition);
  });
});
