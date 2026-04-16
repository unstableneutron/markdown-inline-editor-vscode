import { window, ViewColumn } from '../../test/__mocks__/vscode';
import { MermaidViewerPanel } from '../mermaid-viewer-panel';

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
        svg: '<svg viewBox="0 0 10 10"></svg>',
        source: 'graph TD\nA-->B',
        title: 'Mermaid Preview',
      }),
    );
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
        svg: '<svg data-next="true"></svg>',
        source: 'graph TD\nB-->C',
        title: 'Two',
      }),
    );
  });

  it('renders webview html with a nonce-based CSP and SVG sanitization script', () => {
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
    expect(html).toContain("Content-Security-Policy");
    expect(html).toContain(`script-src 'nonce-${nonceMatch?.[1]}'`);
    expect(html).toContain('function sanitizeSvgMarkup(svgMarkup)');
    expect(html).toContain("['script', 'foreignobject']");
    expect(html).toContain("attributeName.startsWith('on')");
    expect(html).toContain("startsWith('javascript:')");
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
        svg: '<svg></svg>',
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
