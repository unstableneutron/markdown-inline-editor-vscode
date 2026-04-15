import { workspace } from '../../test/__mocks__/vscode';
import { config } from '../../config';

describe('config.mermaid', () => {
  let mockGetConfiguration: jest.SpyInstance;

  beforeEach(() => {
    mockGetConfiguration = jest.spyOn(workspace, 'getConfiguration');
  });

  afterEach(() => {
    mockGetConfiguration.mockRestore();
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
