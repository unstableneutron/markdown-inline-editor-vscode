import { window, ViewColumn } from '../../test/__mocks__/vscode';
import {
  MermaidViewerPanel,
  sanitizeMermaidViewerSvg,
} from '../mermaid-viewer-panel';

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
});

describe('MermaidViewerPanel', () => {
  beforeEach(() => {
    (window.createWebviewPanel as jest.Mock).mockClear();
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

  it('renders webview html with a nonce-based CSP and host-side svg sanitization', () => {
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
    expect(html).toContain("img-src vscode-test-webview data:");
    expect(html).not.toContain('https:');
    expect(html).not.toContain('function sanitizeSvgMarkup(svgMarkup)');
    expect(html).toContain('function parseSvgMarkup(svgMarkup)');
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
