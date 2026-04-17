import type { Disposable } from 'vscode';
import type { EditorInteractionMode } from './vim-mode';

const DEFAULT_POLL_INTERVAL_MS = 150;

type VimModeWatcherOptions = {
  isEnabled: () => boolean;
  hasActiveEditor: () => boolean;
  resolveInteractionMode: () => Promise<EditorInteractionMode>;
  onInteractionModeChanged: () => void;
  intervalMs?: number;
};

export function startVimModeWatcher({
  isEnabled,
  hasActiveEditor,
  resolveInteractionMode,
  onInteractionModeChanged,
  intervalMs = DEFAULT_POLL_INTERVAL_MS,
}: VimModeWatcherOptions): Disposable {
  let disposed = false;
  let pollInFlight = false;
  let lastMode: EditorInteractionMode | undefined;

  const poll = async (): Promise<void> => {
    if (disposed || pollInFlight) {
      return;
    }

    if (!isEnabled() || !hasActiveEditor()) {
      lastMode = undefined;
      return;
    }

    pollInFlight = true;
    try {
      const mode = await resolveInteractionMode();
      if (disposed) {
        return;
      }

      if (lastMode !== undefined && lastMode !== mode) {
        onInteractionModeChanged();
      }

      lastMode = mode;
    } finally {
      pollInFlight = false;
    }
  };

  const intervalHandle = setInterval(() => {
    void poll();
  }, intervalMs);

  return {
    dispose(): void {
      disposed = true;
      clearInterval(intervalHandle);
    },
  };
}
