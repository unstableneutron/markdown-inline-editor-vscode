import { commands, extensions } from 'vscode';

export type EditorInteractionMode = 'interactiveEdit' | 'viewOnly';

const editableModes = new Set(['Insert', 'Replace', 'SurroundInputMode']);

export function classifyVimMode(mode: string): EditorInteractionMode {
  return editableModes.has(mode) ? 'interactiveEdit' : 'viewOnly';
}

export async function resolveEditorInteractionMode(
  vimModeGatingEnabled: boolean,
): Promise<EditorInteractionMode> {
  if (!vimModeGatingEnabled) {
    return 'interactiveEdit';
  }

  const vimExtension = extensions.getExtension('vscodevim.vim');
  if (!vimExtension || !vimExtension.isActive) {
    return 'interactiveEdit';
  }

  try {
    const mode = await commands.executeCommand(
      'getContextKeyValue',
      'vim.mode',
    );

    if (typeof mode !== 'string') {
      return 'interactiveEdit';
    }

    return classifyVimMode(mode);
  } catch {
    return 'interactiveEdit';
  }
}
