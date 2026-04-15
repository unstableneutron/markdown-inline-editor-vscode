import { commands, extensions } from 'vscode';
import { classifyVimMode, resolveEditorInteractionMode } from '../../vim-mode';

const interactiveModes = ['Insert', 'Replace', 'SurroundInputMode'];
const viewOnlyModes = [
  'Normal',
  'Visual',
  'VisualLine',
  'VisualBlock',
  'EasyMotionMode',
  'EasyMotionInputMode',
  'SearchInProgressMode',
  'CommandlineInProgress',
  'Disabled',
  'OperatorPendingMode',
  'UnknownMode',
];

describe('classifyVimMode', () => {
  it.each(interactiveModes)('maps %s to interactiveEdit', (mode) => {
    expect(classifyVimMode(mode)).toBe('interactiveEdit');
  });

  it.each(viewOnlyModes)('maps %s to viewOnly', (mode) => {
    expect(classifyVimMode(mode)).toBe('viewOnly');
  });
});

describe('resolveEditorInteractionMode', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns interactiveEdit when gating is disabled', async () => {
    const mode = await resolveEditorInteractionMode(false);

    expect(mode).toBe('interactiveEdit');
    expect(commands.executeCommand).not.toHaveBeenCalled();
    expect(extensions.getExtension).not.toHaveBeenCalled();
  });

  it('returns interactiveEdit when VSCodeVim is unavailable', async () => {
    (extensions.getExtension as jest.Mock).mockReturnValue(undefined);

    const mode = await resolveEditorInteractionMode(true);

    expect(mode).toBe('interactiveEdit');
    expect(commands.executeCommand).not.toHaveBeenCalled();
  });

  it('returns interactiveEdit when VSCodeVim is active and in Replace mode', async () => {
    (extensions.getExtension as jest.Mock).mockReturnValue({ isActive: true });
    (commands.executeCommand as jest.Mock).mockResolvedValue('Replace');

    const mode = await resolveEditorInteractionMode(true);

    expect(mode).toBe('interactiveEdit');
    expect(commands.executeCommand).toHaveBeenCalledWith(
      'getContextKeyValue',
      'vim.mode',
    );
  });

  it('returns viewOnly when VSCodeVim is active and in Normal mode', async () => {
    (extensions.getExtension as jest.Mock).mockReturnValue({ isActive: true });
    (commands.executeCommand as jest.Mock).mockResolvedValue('Normal');

    const mode = await resolveEditorInteractionMode(true);

    expect(mode).toBe('viewOnly');
  });

  it('falls back to interactiveEdit when mode lookup throws', async () => {
    (extensions.getExtension as jest.Mock).mockReturnValue({ isActive: true });
    (commands.executeCommand as jest.Mock).mockRejectedValue(new Error('boom'));

    const mode = await resolveEditorInteractionMode(true);

    expect(mode).toBe('interactiveEdit');
  });
});
