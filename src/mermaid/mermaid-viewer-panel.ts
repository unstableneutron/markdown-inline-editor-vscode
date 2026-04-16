import * as vscode from 'vscode';

export interface MermaidViewerPayload {
  title: string;
  svg: string;
  source: string;
}

const VIEWER_PANEL_TYPE = 'markdownInlineEditor.mermaidViewer';
const VIEWER_DEFAULT_TITLE = 'Mermaid Preview';

export class MermaidViewerPanel {
  private panel: vscode.WebviewPanel | undefined;
  private messageDisposable: vscode.Disposable | undefined;
  private panelDisposeDisposable: vscode.Disposable | undefined;
  private lastPayload: MermaidViewerPayload | undefined;

  open(payload: MermaidViewerPayload, column: vscode.ViewColumn): void {
    this.lastPayload = payload;
    const panel = this.ensurePanel(payload.title, column);
    panel.title = payload.title;
    void panel.webview.postMessage({
      type: 'render',
      svg: payload.svg,
      source: payload.source,
      title: payload.title,
    });
  }

  private ensurePanel(title: string, column: vscode.ViewColumn): vscode.WebviewPanel {
    if (this.panel) {
      this.panel.reveal(column);
      return this.panel;
    }

    const panel = vscode.window.createWebviewPanel(
      VIEWER_PANEL_TYPE,
      title || VIEWER_DEFAULT_TITLE,
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      },
    );

    panel.webview.html = this.getHtml();
    this.messageDisposable = panel.webview.onDidReceiveMessage((message) => {
      this.handleWebviewMessage(message);
    });
    this.panelDisposeDisposable = panel.onDidDispose(() => {
      this.clearPanel();
    });
    this.panel = panel;

    return panel;
  }

  private handleWebviewMessage(message: unknown): void {
    if (!message || typeof message !== 'object') {
      return;
    }

    const { type } = message as { type?: unknown };
    if (type === 'close') {
      this.panel?.dispose();
      return;
    }

    if (type === 'openBeside' && this.lastPayload) {
      this.open(this.lastPayload, vscode.ViewColumn.Beside);
    }
  }

  private clearPanel(): void {
    this.messageDisposable?.dispose();
    this.messageDisposable = undefined;

    this.panelDisposeDisposable?.dispose();
    this.panelDisposeDisposable = undefined;

    this.panel = undefined;
    this.lastPayload = undefined;
  }

  private getHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${VIEWER_DEFAULT_TITLE}</title>
  <style>
    :root {
      color-scheme: light dark;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      background: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      font-family: var(--vscode-font-family);
      overflow: hidden;
    }

    #toolbar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      border-bottom: 1px solid var(--vscode-panel-border);
      background: var(--vscode-sideBar-background);
      position: sticky;
      top: 0;
      z-index: 2;
    }

    #toolbar button {
      appearance: none;
      border: 1px solid var(--vscode-button-border, transparent);
      background: var(--vscode-button-secondaryBackground, var(--vscode-button-background));
      color: var(--vscode-button-secondaryForeground, var(--vscode-button-foreground));
      border-radius: 6px;
      padding: 4px 10px;
      cursor: pointer;
      font: inherit;
    }

    #toolbar button:hover {
      background: var(--vscode-button-secondaryHoverBackground, var(--vscode-button-hoverBackground));
    }

    #title {
      margin-left: auto;
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 40%;
    }

    #viewport {
      position: relative;
      flex: 1;
      overflow: hidden;
      cursor: grab;
      background-color: var(--vscode-editor-background);
      background-image: radial-gradient(circle at 1px 1px, rgba(127, 127, 127, 0.16) 1px, transparent 0);
      background-size: 24px 24px;
    }

    #viewport.dragging {
      cursor: grabbing;
    }

    #canvas {
      position: absolute;
      left: 0;
      top: 0;
      transform-origin: 0 0;
      will-change: transform;
      user-select: none;
    }

    #canvas svg {
      display: block;
      overflow: visible;
      max-width: none;
      height: auto;
    }

    #status {
      min-width: 54px;
      text-align: center;
      color: var(--vscode-descriptionForeground);
      font-variant-numeric: tabular-nums;
    }

    #source {
      display: none;
    }
  </style>
</head>
<body>
  <div id="toolbar">
    <button type="button" data-action="zoom-in" aria-label="Zoom in">+</button>
    <button type="button" data-action="zoom-out" aria-label="Zoom out">-</button>
    <button type="button" data-action="fit">Fit</button>
    <button type="button" data-action="reset">100%</button>
    <button type="button" data-action="open-beside">Open beside</button>
    <div id="status">100%</div>
    <div id="title"></div>
  </div>
  <div id="viewport">
    <div id="canvas"></div>
  </div>
  <pre id="source"></pre>
  <script>
    const vscode = acquireVsCodeApi();
    const toolbar = document.getElementById('toolbar');
    const viewport = document.getElementById('viewport');
    const canvas = document.getElementById('canvas');
    const status = document.getElementById('status');
    const titleElement = document.getElementById('title');
    const sourceElement = document.getElementById('source');

    let scale = 1;
    let panX = 0;
    let panY = 0;
    let isDragging = false;
    let lastPointerX = 0;
    let lastPointerY = 0;

    function clampScale(nextScale) {
      return Math.min(8, Math.max(0.05, nextScale));
    }

    function getSvg() {
      return canvas.querySelector('svg');
    }

    function getSvgSize() {
      const svg = getSvg();
      if (!svg) {
        return { width: 1, height: 1 };
      }

      const viewBox = svg.viewBox && svg.viewBox.baseVal;
      if (viewBox && viewBox.width > 0 && viewBox.height > 0) {
        return { width: viewBox.width, height: viewBox.height };
      }

      const width = Number(svg.getAttribute('width')) || svg.getBoundingClientRect().width || 1;
      const height = Number(svg.getAttribute('height')) || svg.getBoundingClientRect().height || 1;
      return { width, height };
    }

    function updateTransform() {
      canvas.style.transform = 'translate(' + panX + 'px, ' + panY + 'px) scale(' + scale + ')';
      status.textContent = Math.round(scale * 100) + '%';
    }

    function centerAtScale(nextScale) {
      const bounds = viewport.getBoundingClientRect();
      const svgSize = getSvgSize();
      panX = (bounds.width - svgSize.width * nextScale) / 2;
      panY = (bounds.height - svgSize.height * nextScale) / 2;
      scale = nextScale;
      updateTransform();
    }

    function fitToViewport() {
      const bounds = viewport.getBoundingClientRect();
      const svgSize = getSvgSize();
      const widthScale = (bounds.width * 0.8) / svgSize.width;
      const heightScale = (bounds.height * 0.8) / svgSize.height;
      centerAtScale(clampScale(Math.min(widthScale, heightScale, 1)));
    }

    function resetZoom() {
      centerAtScale(1);
    }

    function zoomBy(factor, originX, originY) {
      const nextScale = clampScale(scale * factor);
      const localX = originX - panX;
      const localY = originY - panY;
      const worldX = localX / scale;
      const worldY = localY / scale;
      scale = nextScale;
      panX = originX - worldX * scale;
      panY = originY - worldY * scale;
      updateTransform();
    }

    function render(payload) {
      document.title = payload.title || '${VIEWER_DEFAULT_TITLE}';
      titleElement.textContent = payload.title || '${VIEWER_DEFAULT_TITLE}';
      sourceElement.textContent = payload.source || '';
      canvas.innerHTML = payload.svg || '';
      requestAnimationFrame(() => fitToViewport());
    }

    toolbar.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button) {
        return;
      }

      const action = button.dataset.action;
      const bounds = viewport.getBoundingClientRect();
      const centerX = bounds.width / 2;
      const centerY = bounds.height / 2;

      if (action === 'zoom-in') {
        zoomBy(1.15, centerX, centerY);
        return;
      }

      if (action === 'zoom-out') {
        zoomBy(1 / 1.15, centerX, centerY);
        return;
      }

      if (action === 'fit') {
        fitToViewport();
        return;
      }

      if (action === 'reset') {
        resetZoom();
        return;
      }

      if (action === 'open-beside') {
        vscode.postMessage({ type: 'openBeside' });
      }
    });

    viewport.addEventListener('wheel', (event) => {
      if (!getSvg()) {
        return;
      }

      event.preventDefault();
      const bounds = viewport.getBoundingClientRect();
      const originX = event.clientX - bounds.left;
      const originY = event.clientY - bounds.top;
      const factor = event.deltaY < 0 ? 1.1 : 1 / 1.1;
      zoomBy(factor, originX, originY);
    }, { passive: false });

    viewport.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) {
        return;
      }

      isDragging = true;
      lastPointerX = event.clientX;
      lastPointerY = event.clientY;
      viewport.classList.add('dragging');
    });

    window.addEventListener('pointermove', (event) => {
      if (!isDragging) {
        return;
      }

      panX += event.clientX - lastPointerX;
      panY += event.clientY - lastPointerY;
      lastPointerX = event.clientX;
      lastPointerY = event.clientY;
      updateTransform();
    });

    function stopDragging() {
      isDragging = false;
      viewport.classList.remove('dragging');
    }

    window.addEventListener('pointerup', stopDragging);
    window.addEventListener('pointercancel', stopDragging);
    window.addEventListener('blur', stopDragging);

    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        vscode.postMessage({ type: 'close' });
      }
    });

    window.addEventListener('message', (event) => {
      const message = event.data;
      if (message && message.type === 'render') {
        render(message);
      }
    });
  </script>
</body>
</html>`;
  }
}
