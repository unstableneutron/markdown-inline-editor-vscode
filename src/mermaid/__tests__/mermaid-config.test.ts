import { workspace } from '../../test/__mocks__/vscode';
import { config } from '../../config';
import { getMermaidRendererFingerprint } from '../mermaid-renderer';

describe('config.mermaid', () => {
  let mockGetConfiguration: jest.SpyInstance;

  beforeEach(() => {
    mockGetConfiguration = jest.spyOn(workspace, 'getConfiguration');
  });

  afterEach(() => {
    mockGetConfiguration.mockRestore();
  });

  it('defaults renderer to official-mermaid-js', () => {
    mockGetConfiguration.mockReturnValue({
      get: <T>(_key: string, defaultValue: T): T => defaultValue,
    } as any);

    expect(config.mermaid.renderer()).toBe('official-mermaid-js');
  });

  it('reads mmdr settings from the Mermaid namespace', () => {
    mockGetConfiguration.mockReturnValue({
      get: <T>(key: string, defaultValue?: T): T | undefined => {
        if (key === 'mermaid.renderer') return 'mermaid-rs-renderer' as T;
        if (key === 'mermaid.mmdr.command') return '/usr/local/bin/mmdr' as T;
        if (key === 'mermaid.mmdr.preferredAspectRatio') return '16:9' as T;
        if (key === 'mermaid.mmdr.nodeSpacing') return 60 as T;
        if (key === 'mermaid.mmdr.rankSpacing') return 80 as T;
        if (key === 'mermaid.mmdr.fastText') return true as T;
        if (key === 'mermaid.previewMode') return 'hover' as T;
        return defaultValue;
      },
    } as any);

    expect(config.mermaid.renderer()).toBe('mermaid-rs-renderer');
    expect(config.mermaid.mmdr.command()).toBe('/usr/local/bin/mmdr');
    expect(config.mermaid.mmdr.preferredAspectRatio()).toBe('16:9');
    expect(config.mermaid.mmdr.nodeSpacing()).toBe(60);
    expect(config.mermaid.mmdr.rankSpacing()).toBe(80);
    expect(config.mermaid.mmdr.fastText()).toBe(true);
  });

  it('includes renderer-specific settings in the fingerprint', () => {
    mockGetConfiguration.mockReturnValue({
      get: <T>(key: string, defaultValue?: T): T | undefined => {
        if (key === 'mermaid.renderer') return 'mermaid-rs-renderer' as T;
        if (key === 'mermaid.mmdr.command') return 'custom-mmdr' as T;
        if (key === 'mermaid.mmdr.preferredAspectRatio') return '4:3' as T;
        if (key === 'mermaid.mmdr.nodeSpacing') return 48 as T;
        if (key === 'mermaid.mmdr.rankSpacing') return 72 as T;
        if (key === 'mermaid.mmdr.fastText') return true as T;
        if (key === 'mermaid.previewMode') return 'hover' as T;
        return defaultValue;
      },
    } as any);

    expect(getMermaidRendererFingerprint()).toBe(
      'mermaid-rs-renderer\ncustom-mmdr\n4:3\n48\n72\ntrue'
    );
  });

  it('defaults previewMode to hover', () => {
    mockGetConfiguration.mockReturnValue({
      get: <T>(_key: string, defaultValue: T): T => defaultValue,
    } as any);

    expect(config.mermaid.previewMode()).toBe('hover');
  });

  it('reads interactive-viewer preview mode from the Mermaid namespace', () => {
    mockGetConfiguration.mockReturnValue({
      get: <T>(key: string, defaultValue?: T): T | undefined => {
        if (key === 'mermaid.previewMode') return 'interactive-viewer' as T;
        return defaultValue;
      },
    } as any);

    expect(config.mermaid.previewMode()).toBe('interactive-viewer');
  });
});
