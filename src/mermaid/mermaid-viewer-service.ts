import * as vscode from 'vscode';
import type { MarkdownParseCache } from '../markdown-parse-cache';
import type { MermaidBlock } from '../parser';
import { createErrorSvg, renderMermaidSvgNatural } from './mermaid-renderer';
import { MermaidViewerPanel } from './mermaid-viewer-panel';

const VIEWER_TITLE = 'Mermaid Preview';
const ERROR_SVG_WIDTH = 800;
const ERROR_SVG_HEIGHT = 600;

function isDarkTheme(): boolean {
  const themeKind = vscode.window.activeColorTheme.kind;
  return (
    themeKind === vscode.ColorThemeKind.Dark ||
    themeKind === vscode.ColorThemeKind.HighContrast
  );
}

function resolveEditorColumn(): vscode.ViewColumn {
  const viewColumn = vscode.window.activeTextEditor?.viewColumn;
  return typeof viewColumn === 'number' && viewColumn > 0
    ? viewColumn
    : vscode.ViewColumn.One;
}

function normalizeBlockStartPos(blockStartPos?: number | string): number | undefined {
  if (typeof blockStartPos === 'number') {
    return Number.isFinite(blockStartPos) ? blockStartPos : undefined;
  }

  if (typeof blockStartPos === 'string') {
    const trimmed = blockStartPos.trim();
    if (!trimmed) {
      return undefined;
    }

    const parsed = Number.parseInt(trimmed, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

export class MermaidViewerService implements vscode.Disposable {
  private latestOpenRequestId = 0;

  constructor(
    private readonly parseCache: MarkdownParseCache,
    private readonly panel: MermaidViewerPanel = new MermaidViewerPanel(),
  ) {}

  async openFromBlock(
    document: vscode.TextDocument,
    block: MermaidBlock,
    openBeside: boolean,
  ): Promise<void> {
    const requestId = ++this.latestOpenRequestId;
    const targetColumn = openBeside ? vscode.ViewColumn.Beside : resolveEditorColumn();
    const darkTheme = isDarkTheme();

    try {
      const fontFamily = vscode.workspace
        .getConfiguration('editor')
        .get<string>('fontFamily');
      const svg = await renderMermaidSvgNatural(block.source, {
        theme: darkTheme ? 'dark' : 'default',
        fontFamily,
      });

      if (requestId !== this.latestOpenRequestId) {
        return;
      }

      this.panel.open(
        {
          title: VIEWER_TITLE,
          svg,
          source: block.source,
        },
        targetColumn,
      );
    } catch (error) {
      if (requestId !== this.latestOpenRequestId) {
        return;
      }

      const message = error instanceof Error ? error.message : String(error);
      this.panel.open(
        {
          title: VIEWER_TITLE,
          svg: createErrorSvg(message, ERROR_SVG_WIDTH, ERROR_SVG_HEIGHT, darkTheme),
          source: block.source,
        },
        targetColumn,
      );
    }
  }

  async openFromCommand(
    documentUri?: string,
    blockStartPos?: number | string,
    openBeside: boolean = false,
  ): Promise<void> {
    const document = await this.resolveDocument(documentUri);
    if (!document) {
      return;
    }

    const parseEntry = this.parseCache.get(document);
    const normalizedBlockStartPos = normalizeBlockStartPos(blockStartPos);
    const block =
      normalizedBlockStartPos !== undefined
        ? parseEntry.mermaidBlocks.find((candidate) => candidate.startPos === normalizedBlockStartPos)
        : parseEntry.mermaidBlocks[0];

    if (!block) {
      return;
    }

    await this.openFromBlock(document, block, openBeside);
  }

  dispose(): void {
    this.panel.dispose();
  }

  private async resolveDocument(documentUri?: string): Promise<vscode.TextDocument | undefined> {
    if (documentUri) {
      try {
        return await vscode.workspace.openTextDocument(vscode.Uri.parse(documentUri));
      } catch {
        return undefined;
      }
    }

    return vscode.window.activeTextEditor?.document;
  }
}
