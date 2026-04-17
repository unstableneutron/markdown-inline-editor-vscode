import { startVimModeWatcher } from '../../vim-mode-watcher';

describe('startVimModeWatcher', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('refreshes decorations when the resolved interaction mode changes', async () => {
    const refresh = jest.fn();
    const resolveInteractionMode = jest
      .fn<Promise<'viewOnly' | 'interactiveEdit'>, []>()
      .mockResolvedValueOnce('viewOnly')
      .mockResolvedValueOnce('interactiveEdit');

    const watcher = startVimModeWatcher({
      isEnabled: () => true,
      hasActiveEditor: () => true,
      resolveInteractionMode,
      onInteractionModeChanged: refresh,
      intervalMs: 50,
    });

    await jest.advanceTimersByTimeAsync(50);
    expect(refresh).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(50);
    expect(refresh).toHaveBeenCalledTimes(1);

    watcher.dispose();
  });

  it('does not poll when Vim mode gating is disabled', async () => {
    const resolveInteractionMode = jest.fn();

    const watcher = startVimModeWatcher({
      isEnabled: () => false,
      hasActiveEditor: () => true,
      resolveInteractionMode,
      onInteractionModeChanged: jest.fn(),
      intervalMs: 50,
    });

    await jest.advanceTimersByTimeAsync(100);

    expect(resolveInteractionMode).not.toHaveBeenCalled();

    watcher.dispose();
  });
});
