import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { Uri, window, workspace, ViewColumn } from '../../test/__mocks__/vscode';
import {
  MermaidViewerPanel,
  sanitizeMermaidViewerSvg,
} from '../mermaid-viewer-panel';

const REALISTIC_MERMAID_SVG_FIXTURE_PATH = resolve(
  process.cwd(),
  'src/mermaid/__tests__/fixtures/mermaid-like.svg',
);
const REALISTIC_MERMAID_SVG = readFileSync(REALISTIC_MERMAID_SVG_FIXTURE_PATH, 'utf8');

describe('sanitizeMermaidViewerSvg', () => {
  it('removes scriptable elements, event handlers, and non-local links', () => {
    const maliciousSvg = [
      '<svg xmlns:xlink="http://www.w3.org/1999/xlink" onload="alert(1)">',
      '  <script>alert(1)</script>',
      '  <foreignObject><div>bad</div></foreignObject>',
      '  <g onclick="alert(2)">',
      '    <a href="https://example.com/diagram">external</a>',
      '    <use href="#local-node" />',
      '    <image xlink:href="javascript:alert(3)" />',
      '    <use xlink:href="#local-marker" />',
      '  </g>',
      '</svg>',
    ].join('');

    const sanitizedSvg = sanitizeMermaidViewerSvg(maliciousSvg);

    expect(sanitizedSvg).toBeDefined();
    expect(sanitizedSvg).not.toContain('<script');
    expect(sanitizedSvg).not.toContain('foreignObject');
    expect(sanitizedSvg).not.toContain('onload=');
    expect(sanitizedSvg).not.toContain('onclick=');
    expect(sanitizedSvg).not.toContain('href="https://example.com/diagram"');
    expect(sanitizedSvg).not.toContain('xlink:href="javascript:alert(3)"');
    expect(sanitizedSvg).toContain('href="#local-node"');
    expect(sanitizedSvg).toContain('xlink:href="#local-marker"');
  });

  it('retains safe Mermaid style blocks and inline styles from a realistic fixture', () => {
    const sanitizedSvg = sanitizeMermaidViewerSvg(REALISTIC_MERMAID_SVG);

    expect(sanitizedSvg).toBeDefined();
    expect(sanitizedSvg).toContain('<style>');
    expect(sanitizedSvg).toContain('#my-svg');
    expect(sanitizedSvg).toMatch(/style="[^"]*max-width:[^"]*background-color:[^"]*"/);
  });

  it('preserves safe data:image href content while stripping unsafe targets', () => {
    const safePngHref = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO1f9s8AAAAASUVORK5CYII=';
    const safeGifHref = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
    const mixedSvg = [
      '<svg xmlns:xlink="http://www.w3.org/1999/xlink">',
      '  <defs><circle id="local-node" cx="4" cy="4" r="4" /></defs>',
      '  <use href="#local-node" />',
      `  <image href="${safePngHref}" />`,
      `  <image xlink:href="${safeGifHref}" />`,
      '  <image href="data:text/html;base64,PGgxPm5vcGU8L2gxPg==" />',
      '  <image href="https://example.com/remote.png" />',
      '  <image xlink:href="javascript:alert(1)" />',
      '</svg>',
    ].join('');

    const sanitizedSvg = sanitizeMermaidViewerSvg(mixedSvg);

    expect(sanitizedSvg).toContain('href="#local-node"');
    expect(sanitizedSvg).toContain(`href="${safePngHref}"`);
    expect(sanitizedSvg).toContain(`xlink:href="${safeGifHref}"`);
    expect(sanitizedSvg).not.toContain('data:text/html');
    expect(sanitizedSvg).not.toContain('https://example.com/remote.png');
    expect(sanitizedSvg).not.toContain('javascript:alert(1)');
  });
});

describe('MermaidViewerPanel', () => {
  beforeEach(() => {
    (window.createWebviewPanel as jest.Mock).mockClear();
    (workspace.openTextDocument as jest.Mock).mockClear();
    (window.showTextDocument as jest.Mock).mockClear();
    window.activeTextEditor = undefined;
    window.visibleTextEditors = [];
  });

  it('creates a webview panel in the requested column and posts render payloads', () => {
    const panel = new MermaidViewerPanel();

    panel.open(
      {
        title: 'Mermaid Preview',
        svg: '<svg viewBox="0 0 10 10"></svg>',
        source: 'graph TD\nA-->B',
      },
      ViewColumn.One,
    );

    expect(window.createWebviewPanel).toHaveBeenCalledWith(
      'markdownInlineEditor.mermaidViewer',
      'Mermaid Preview',
      ViewColumn.One,
      expect.objectContaining({ enableScripts: true }),
    );

    const createdPanel = (window.createWebviewPanel as jest.Mock).mock.results[0].value;
    expect(createdPanel.webview.html).toContain('id="toolbar"');
    expect(createdPanel.webview.html).toContain('data-action="fit"');
    expect(createdPanel.webview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'render',
        svg: sanitizeMermaidViewerSvg('<svg viewBox="0 0 10 10"></svg>'),
        source: 'graph TD\nA-->B',
        title: 'Mermaid Preview',
      }),
    );
  });

  it('sanitizes malicious svg payloads before posting them to the webview', () => {
    const panel = new MermaidViewerPanel();
    const maliciousSvg = [
      '<svg xmlns:xlink="http://www.w3.org/1999/xlink" onload="alert(1)">',
      '  <script>alert(1)</script>',
      '  <foreignObject><div>bad</div></foreignObject>',
      '  <g onclick="alert(2)">',
      '    <a href="https://example.com/diagram">external</a>',
      '    <use href="#local-node" />',
      '    <image xlink:href="javascript:alert(3)" />',
      '    <use xlink:href="#local-marker" />',
      '  </g>',
      '</svg>',
    ].join('');

    panel.open(
      {
        title: 'Mermaid Preview',
        svg: maliciousSvg,
        source: 'graph TD\nA-->B',
      },
      ViewColumn.One,
    );

    const createdPanel = (window.createWebviewPanel as jest.Mock).mock.results[0].value;
    expect(createdPanel.webview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'render',
        svg: sanitizeMermaidViewerSvg(maliciousSvg),
      }),
    );

    const renderMessage = createdPanel.webview.postMessage.mock.calls[0][0];
    expect(renderMessage.svg).not.toContain('<script');
    expect(renderMessage.svg).not.toContain('foreignObject');
    expect(renderMessage.svg).not.toContain('onload=');
    expect(renderMessage.svg).not.toContain('onclick=');
    expect(renderMessage.svg).not.toContain('href="https://example.com/diagram"');
    expect(renderMessage.svg).not.toContain('xlink:href="javascript:alert(3)"');
    expect(renderMessage.svg).toContain('href="#local-node"');
    expect(renderMessage.svg).toContain('xlink:href="#local-marker"');
  });

  it('reuses the existing panel and reveals it instead of creating another one', () => {
    const panel = new MermaidViewerPanel();
    panel.open(
      { title: 'One', svg: '<svg></svg>', source: 'graph TD\nA-->B' },
      ViewColumn.One,
    );
    panel.open(
      {
        title: 'Two',
        svg: '<svg data-next="true"></svg>',
        source: 'graph TD\nB-->C',
      },
      ViewColumn.Beside,
    );

    expect(window.createWebviewPanel).toHaveBeenCalledTimes(1);
    const createdPanel = (window.createWebviewPanel as jest.Mock).mock.results[0].value;
    expect(createdPanel.reveal).toHaveBeenCalledWith(ViewColumn.Beside);
    expect(createdPanel.webview.postMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: 'render',
        svg: sanitizeMermaidViewerSvg('<svg data-next="true"></svg>'),
        source: 'graph TD\nB-->C',
        title: 'Two',
      }),
    );
  });

  it('renders webview html with a nonce-based CSP, svg styling support, and host-side svg sanitization', () => {
    const panel = new MermaidViewerPanel();

    panel.open(
      {
        title: 'Mermaid Preview',
        svg: '<svg viewBox="0 0 10 10"></svg>',
        source: 'graph TD\nA-->B',
      },
      ViewColumn.One,
    );

    const createdPanel = (window.createWebviewPanel as jest.Mock).mock.results[0].value;
    const html = createdPanel.webview.html as string;
    const nonceMatch = html.match(/<script nonce="([^"]+)"/);

    expect(nonceMatch?.[1]).toBeTruthy();
    expect(html).toContain('Content-Security-Policy');
    expect(html).toContain(`script-src 'nonce-${nonceMatch?.[1]}'`);
    expect(html).toContain(`style-src vscode-test-webview 'nonce-${nonceMatch?.[1]}' 'unsafe-inline'`);
    expect(html).toContain(`style-src-elem vscode-test-webview 'nonce-${nonceMatch?.[1]}' 'unsafe-inline'`);
    expect(html).toContain("style-src-attr 'unsafe-inline'");
    expect(html).toContain("img-src vscode-test-webview data:");
    expect(html).not.toContain('https:');
    expect(html).not.toContain('function sanitizeSvgMarkup(svgMarkup)');
    expect(html).toContain('function parseSvgMarkup(svgMarkup)');
    expect(html).toContain('centerAtScale(clampScale(Math.min(widthScale, heightScale)));');
    expect(html).not.toContain('Math.min(widthScale, heightScale, 1)');
  });

  it('isolates rendered svg markup inside a shadow-rooted render surface', () => {
    const panel = new MermaidViewerPanel();

    panel.open(
      {
        title: 'Mermaid Preview',
        svg: '<svg viewBox="0 0 10 10"><style>body{display:none}#toolbar{display:none}</style></svg>',
        source: 'graph TD\nA-->B',
      },
      ViewColumn.One,
    );

    const createdPanel = (window.createWebviewPanel as jest.Mock).mock.results[0].value;
    const html = createdPanel.webview.html as string;

    expect(html).toContain("const renderRoot = canvas.attachShadow({ mode: 'open' });");
    expect(html).toContain("const renderSurface = document.createElement('div');");
    expect(html).toContain("renderSurface.setAttribute('part', 'svg-root');");
    expect(html).toContain('renderRoot.append(renderStyles, renderSurface);');
    expect(html).toContain('return renderSurface.querySelector(\'svg\');');
    expect(html).toContain('renderSurface.replaceChildren();');
    expect(html).toContain('renderSurface.appendChild(svg);');
    expect(html).toContain(':host {');
    expect(html).not.toContain('#canvas svg {');
  });

  it('supports opening a mock text document and showing it in an editor', async () => {
    const document = await workspace.openTextDocument({
      language: 'markdown',
      content: '# Mermaid fixture',
    });
    const editor = await window.showTextDocument(document, { viewColumn: ViewColumn.Two });

    expect(document.getText()).toBe('# Mermaid fixture');
    expect(editor.document).toBe(document);
    expect(editor.viewColumn).toBe(ViewColumn.Two);
    expect(window.activeTextEditor).toBe(editor);
    expect(window.visibleTextEditors).toContain(editor);
  });

  it('opens URI-based markdown documents with a minimal Mermaid fixture and shows them in an editor', async () => {
    const document = await workspace.openTextDocument(Uri.parse('untitled:/mock-mermaid.md'));
    const editor = await window.showTextDocument(document, { viewColumn: ViewColumn.Two });

    expect(document.languageId).toBe('markdown');
    expect(document.getText()).toContain('# Mermaid fixture');
    expect(document.getText()).toContain('```mermaid');
    expect(document.getText()).toContain('graph TD');
    expect(editor.document).toBe(document);
    expect(editor.viewColumn).toBe(ViewColumn.Two);
    expect(window.activeTextEditor).toBe(editor);
    expect(window.visibleTextEditors).toContain(editor);
  });

  it('resolves ViewColumn.Active to a concrete editor column in the mock vscode API', async () => {
    const firstDocument = await workspace.openTextDocument({
      language: 'markdown',
      content: '# First',
    });
    const firstEditor = await window.showTextDocument(firstDocument, { viewColumn: ViewColumn.Three });

    const secondDocument = await workspace.openTextDocument({
      language: 'markdown',
      content: '# Second',
    });
    const secondEditor = await window.showTextDocument(secondDocument, ViewColumn.Active);

    expect(firstEditor.viewColumn).toBe(ViewColumn.Three);
    expect(secondEditor.viewColumn).toBe(ViewColumn.Three);
    expect(secondEditor.viewColumn).toBeGreaterThan(0);
  });

  it('mirrors the webview panel disposal event signature closely enough for tests', () => {
    const createdPanel = window.createWebviewPanel('test.panel', 'Test Panel', ViewColumn.One, {});
    const thisArg = { disposeCount: 0 };
    const disposables: Array<{ dispose: () => void }> = [];

    const disposable = createdPanel.onDidDispose(function (this: { disposeCount: number }) {
      this.disposeCount += 1;
    }, thisArg, disposables);

    expect(disposables).toContain(disposable);

    createdPanel.dispose();

    expect(thisArg.disposeCount).toBe(1);
  });

  it('reveals the existing panel beside when the webview requests open beside', () => {
    const panel = new MermaidViewerPanel();
    panel.open({ title: 'One', svg: '<svg></svg>', source: 'graph TD\nA-->B' }, ViewColumn.One);

    const createdPanel = (window.createWebviewPanel as jest.Mock).mock.results[0].value;
    createdPanel.webview.__fireMessage({ type: 'openBeside' });

    expect(createdPanel.reveal).toHaveBeenLastCalledWith(ViewColumn.Beside);
    expect(createdPanel.webview.postMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: 'render',
        svg: sanitizeMermaidViewerSvg('<svg></svg>'),
        source: 'graph TD\nA-->B',
        title: 'One',
      }),
    );
  });

  it('disposes the current panel via the public wrapper and allows reuse', () => {
    const panel = new MermaidViewerPanel();
    panel.open({ title: 'One', svg: '<svg></svg>', source: 'graph TD\nA-->B' }, ViewColumn.One);

    const firstPanel = (window.createWebviewPanel as jest.Mock).mock.results[0].value;
    const dispose = (panel as MermaidViewerPanel & { dispose?: () => void }).dispose;

    expect(typeof dispose).toBe('function');
    dispose?.call(panel);
    expect(firstPanel.dispose).toHaveBeenCalledTimes(1);

    panel.open({ title: 'Two', svg: '<svg></svg>', source: 'graph TD\nB-->C' }, ViewColumn.Two);

    expect(window.createWebviewPanel).toHaveBeenCalledTimes(2);
    const secondPanel = (window.createWebviewPanel as jest.Mock).mock.results[1].value;
    expect(secondPanel).not.toBe(firstPanel);
  });

  it('disposes and clears the panel when the webview requests close', () => {
    const panel = new MermaidViewerPanel();
    panel.open({ title: 'One', svg: '<svg></svg>', source: 'graph TD\nA-->B' }, ViewColumn.One);

    const firstPanel = (window.createWebviewPanel as jest.Mock).mock.results[0].value;
    firstPanel.webview.__fireMessage({ type: 'close' });
    expect(firstPanel.dispose).toHaveBeenCalled();

    panel.open({ title: 'Two', svg: '<svg></svg>', source: 'graph TD\nB-->C' }, ViewColumn.Two);

    expect(window.createWebviewPanel).toHaveBeenCalledTimes(2);
  });
});
