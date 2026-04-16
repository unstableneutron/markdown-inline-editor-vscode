import * as vscode from 'vscode';
import type { MarkdownParseCache } from '../markdown-parse-cache';
import { findMermaidBlockAtIndicatorOffset } from './indicator';
import type { MermaidViewerService } from './mermaid-viewer-service';

export class MermaidViewerClickHandler implements vscode.Disposable {
  private disposables: vscode.Disposable[] = [];

  constructor(
    private readonly parseCache: MarkdownParseCache,
    private readonly mermaidViewerService: MermaidViewerService,
    private readonly getPreviewMode: () => 'hover' | 'interactive-viewer',
    private readonly isInteractiveViewerAvailableForDocument: (document: vscode.TextDocument) => boolean = () => true,
  ) {}

  enable(): void {
    const selectionDisposable = vscode.window.onDidChangeTextEditorSelection((event) => {
      void this.handleSelectionChange(event);
    });

    this.disposables.push(selectionDisposable);
  }

  async handleSelectionChange(event: vscode.TextEditorSelectionChangeEvent): Promise<void> {
    if (this.getPreviewMode() !== 'interactive-viewer') {
      return;
    }

    if (event.kind !== vscode.TextEditorSelectionChangeKind.Mouse) {
      return;
    }

    if (event.textEditor.document.languageId !== 'markdown') {
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
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables = [];
  }
}
