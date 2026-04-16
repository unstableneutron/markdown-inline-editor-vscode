import * as vscode from 'vscode';
import type { MarkdownParseCache } from '../markdown-parse-cache';
import { isMarkdownLikeLanguageId } from '../markdown-language-ids';
import { findMermaidBlockAtIndicatorOffset } from './indicator';
import type { MermaidViewerService } from './mermaid-viewer-service';

export class MermaidViewerClickHandler implements vscode.Disposable {
  private selectionDisposable: vscode.Disposable | undefined;

  constructor(
    private readonly parseCache: MarkdownParseCache,
    private readonly mermaidViewerService: MermaidViewerService,
    private readonly getPreviewMode: () => 'hover' | 'interactive-viewer',
    private readonly isInteractiveViewerAvailableForDocument: (document: vscode.TextDocument) => boolean = () => true,
  ) {}

  enable(): void {
    if (this.selectionDisposable) {
      return;
    }

    this.selectionDisposable = vscode.window.onDidChangeTextEditorSelection((event) => {
      void this.handleSelectionChange(event);
    });
  }

  async handleSelectionChange(event: vscode.TextEditorSelectionChangeEvent): Promise<void> {
    if (this.getPreviewMode() !== 'interactive-viewer') {
      return;
    }

    if (event.kind !== vscode.TextEditorSelectionChangeKind.Mouse) {
      return;
    }

    if (!isMarkdownLikeLanguageId(event.textEditor.document.languageId)) {
      return;
    }

    if (event.selections.length !== 1 || !event.selections[0].isEmpty) {
      return;
    }

    const document = event.textEditor.document;
    if (!this.isInteractiveViewerAvailableForDocument(document)) {
      return;
    }

    const parseEntry = this.parseCache.get(document);
    const clickOffset = document.offsetAt(event.selections[0].active);
    const block = findMermaidBlockAtIndicatorOffset(
      parseEntry.mermaidBlocks,
      parseEntry.text,
      document.getText(),
      clickOffset,
    );

    if (!block) {
      return;
    }

    await this.mermaidViewerService.openFromBlock(document, block, false);
  }

  dispose(): void {
    this.selectionDisposable?.dispose();
    this.selectionDisposable = undefined;
  }
}
