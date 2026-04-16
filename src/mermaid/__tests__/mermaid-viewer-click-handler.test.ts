import { MermaidViewerClickHandler } from '../mermaid-viewer-click-handler';
import {
  Position,
  Selection,
  TextDocument,
  TextEditor,
  TextEditorSelectionChangeKind,
  Uri,
  window,
} from '../../test/__mocks__/vscode';
import type { MermaidBlock } from '../../parser';

describe('MermaidViewerClickHandler', () => {
  const markdown = '```mermaid\ngraph TD\nA-->B\n```';
  const block: MermaidBlock = {
    startPos: 0,
    endPos: markdown.length,
    source: 'graph TD\nA-->B',
    numLines: 2,
  };

  beforeEach(() => {
    window.activeTextEditor = undefined;
    window.visibleTextEditors = [];
  });

  it('registers a selection listener when enabled', () => {
    const selectionListenerSpy = jest
      .spyOn(window, 'onDidChangeTextEditorSelection')
      .mockImplementation(() => ({ dispose: jest.fn() }) as any);

    const handler = new MermaidViewerClickHandler(
      { get: jest.fn() } as any,
      { openFromBlock: jest.fn() } as any,
      () => 'interactive-viewer',
    );

    handler.enable();

    expect(selectionListenerSpy).toHaveBeenCalledTimes(1);

    handler.dispose();
    selectionListenerSpy.mockRestore();
  });

  it('opens the viewer only for mouse clicks on the Mermaid indicator in interactive-viewer mode', async () => {
    const document = new TextDocument(Uri.file('/tmp/test.md'), 'markdown', 1, markdown);
    const editor = new TextEditor(document, [
      new Selection(new Position(1, 0), new Position(1, 0)),
    ]);
    const parseCache = {
      get: jest.fn().mockReturnValue({
        text: markdown,
        mermaidBlocks: [block],
      }),
    } as any;
    const service = { openFromBlock: jest.fn().mockResolvedValue(undefined) } as any;
    const handler = new MermaidViewerClickHandler(parseCache, service, () => 'interactive-viewer');

    await handler.handleSelectionChange({
      textEditor: editor,
      selections: [new Selection(new Position(1, 0), new Position(1, 0))],
      kind: TextEditorSelectionChangeKind.Mouse,
    } as any);

    expect(service.openFromBlock).toHaveBeenCalledWith(document, block, false);
  });

  it('ignores non-interactive preview modes', async () => {
    const document = new TextDocument(Uri.file('/tmp/test.md'), 'markdown', 1, markdown);
    const editor = new TextEditor(document, [
      new Selection(new Position(1, 0), new Position(1, 0)),
    ]);
    const parseCache = { get: jest.fn() } as any;
    const service = { openFromBlock: jest.fn() } as any;
    const handler = new MermaidViewerClickHandler(parseCache, service, () => 'hover');

    await handler.handleSelectionChange({
      textEditor: editor,
      selections: [new Selection(new Position(1, 0), new Position(1, 0))],
      kind: TextEditorSelectionChangeKind.Mouse,
    } as any);

    expect(parseCache.get).not.toHaveBeenCalled();
    expect(service.openFromBlock).not.toHaveBeenCalled();
  });

  it('ignores non-markdown editors', async () => {
    const document = new TextDocument(Uri.file('/tmp/test.txt'), 'plaintext', 1, markdown);
    const editor = new TextEditor(document, [
      new Selection(new Position(1, 0), new Position(1, 0)),
    ]);
    const parseCache = { get: jest.fn() } as any;
    const service = { openFromBlock: jest.fn() } as any;
    const handler = new MermaidViewerClickHandler(parseCache, service, () => 'interactive-viewer');

    await handler.handleSelectionChange({
      textEditor: editor,
      selections: [new Selection(new Position(1, 0), new Position(1, 0))],
      kind: TextEditorSelectionChangeKind.Mouse,
    } as any);

    expect(parseCache.get).not.toHaveBeenCalled();
    expect(service.openFromBlock).not.toHaveBeenCalled();
  });

  it('ignores keyboard selection changes', async () => {
    const parseCache = { get: jest.fn() } as any;
    const service = { openFromBlock: jest.fn() } as any;
    const handler = new MermaidViewerClickHandler(parseCache, service, () => 'interactive-viewer');

    await handler.handleSelectionChange({
      kind: TextEditorSelectionChangeKind.Keyboard,
      selections: [],
    } as any);

    expect(parseCache.get).not.toHaveBeenCalled();
    expect(service.openFromBlock).not.toHaveBeenCalled();
  });

  it('ignores non-empty or multi-cursor selections', async () => {
    const document = new TextDocument(Uri.file('/tmp/test.md'), 'markdown', 1, markdown);
    const editor = new TextEditor(document, [
      new Selection(new Position(1, 0), new Position(1, 1)),
    ]);
    const parseCache = { get: jest.fn() } as any;
    const service = { openFromBlock: jest.fn() } as any;
    const handler = new MermaidViewerClickHandler(parseCache, service, () => 'interactive-viewer');

    await handler.handleSelectionChange({
      textEditor: editor,
      selections: [new Selection(new Position(1, 0), new Position(1, 1))],
      kind: TextEditorSelectionChangeKind.Mouse,
    } as any);

    await handler.handleSelectionChange({
      textEditor: editor,
      selections: [
        new Selection(new Position(1, 0), new Position(1, 0)),
        new Selection(new Position(1, 0), new Position(1, 0)),
      ],
      kind: TextEditorSelectionChangeKind.Mouse,
    } as any);

    expect(parseCache.get).not.toHaveBeenCalled();
    expect(service.openFromBlock).not.toHaveBeenCalled();
  });

  it('ignores clicks outside the indicator character', async () => {
    const document = new TextDocument(Uri.file('/tmp/test.md'), 'markdown', 1, markdown);
    const editor = new TextEditor(document, [
      new Selection(new Position(1, 1), new Position(1, 1)),
    ]);
    const parseCache = {
      get: jest.fn().mockReturnValue({
        text: markdown,
        mermaidBlocks: [block],
      }),
    } as any;
    const service = { openFromBlock: jest.fn() } as any;
    const handler = new MermaidViewerClickHandler(parseCache, service, () => 'interactive-viewer');

    await handler.handleSelectionChange({
      textEditor: editor,
      selections: [new Selection(new Position(1, 1), new Position(1, 1))],
      kind: TextEditorSelectionChangeKind.Mouse,
    } as any);

    expect(service.openFromBlock).not.toHaveBeenCalled();
  });
});
