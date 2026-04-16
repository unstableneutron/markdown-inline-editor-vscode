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
