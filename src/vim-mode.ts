import path from 'path';
import { commands, extensions } from 'vscode';

export type EditorInteractionMode = 'interactiveEdit' | 'viewOnly';

const editableModes = new Set(['Insert', 'Replace', 'SurroundInputMode']);

type ModuleLoader = (modulePath: string) => unknown;

type VSCodeVimExtensionLike = {
  extensionPath: string;
  packageJSON?: {
    main?: string;
  };
};

type VSCodeVimMainModule = {
  getAndUpdateModeHandler?: (forceSyncAndUpdate?: boolean) => Promise<{
    vimState?: {
      currentMode?: number | string;
    };
  } | undefined>;
};

const vscodeVimModeNamesByValue = [
  'Normal',
  'Insert',
  'Visual',
  'VisualBlock',
  'VisualLine',
  'SearchInProgressMode',
  'CommandlineInProgress',
  'Replace',
  'EasyMotionMode',
  'EasyMotionInputMode',
  'SurroundInputMode',
  'OperatorPendingMode',
  'Disabled',
] as const;

function defaultModuleLoader(modulePath: string): unknown {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  return require(modulePath);
}

function normalizeVSCodeVimMode(mode: number | string | undefined): string | undefined {
  if (typeof mode === 'string') {
    return mode;
  }

  if (typeof mode === 'number' && Number.isInteger(mode)) {
    return vscodeVimModeNamesByValue[mode];
  }

  return undefined;
}

export function classifyVimMode(mode: string): EditorInteractionMode {
  return editableModes.has(mode) ? 'interactiveEdit' : 'viewOnly';
}

export async function resolveEditorInteractionModeFromVSCodeVimInternals(
  vimExtension: VSCodeVimExtensionLike,
  moduleLoader: ModuleLoader = defaultModuleLoader,
): Promise<EditorInteractionMode | undefined> {
  const mainEntry = vimExtension.packageJSON?.main;
  if (typeof mainEntry !== 'string' || mainEntry.length === 0) {
    return undefined;
  }

  try {
    const mainModulePath = path.join(vimExtension.extensionPath, mainEntry);
    const mainModule = moduleLoader(mainModulePath) as VSCodeVimMainModule;

    if (typeof mainModule.getAndUpdateModeHandler !== 'function') {
      return undefined;
    }

    const modeHandler = await mainModule.getAndUpdateModeHandler();
    const currentModeValue = modeHandler?.vimState?.currentMode;
    const modeName = normalizeVSCodeVimMode(currentModeValue);

    if (typeof modeName !== 'string') {
      return undefined;
    }

    return classifyVimMode(modeName);
  } catch {
    return undefined;
  }
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

  const internalMode = await resolveEditorInteractionModeFromVSCodeVimInternals(vimExtension);
  if (internalMode) {
    return internalMode;
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
