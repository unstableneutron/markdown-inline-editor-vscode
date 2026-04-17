import { spawn } from 'node:child_process';

const SVG_OUTPUT_REGEX = /^(?:<\?xml[\s\S]*?\?>\s*)?<svg\b[\s\S]*<\/svg>\s*$/i;

export type MmdrRenderOptions = {
  command: string;
  preferredAspectRatio?: string;
  nodeSpacing?: number;
  rankSpacing?: number;
  fastText: boolean;
  timeoutMs: number;
  signal?: AbortSignal;
};

export async function renderMmdrSvg(source: string, options: MmdrRenderOptions): Promise<string> {
  const args = ['-i', '-', '-e', 'svg'];

  if (options.preferredAspectRatio) {
    args.push('--preferredAspectRatio', options.preferredAspectRatio);
  }

  if (options.nodeSpacing !== undefined) {
    args.push('--nodeSpacing', String(options.nodeSpacing));
  }

  if (options.rankSpacing !== undefined) {
    args.push('--rankSpacing', String(options.rankSpacing));
  }

  if (options.fastText) {
    args.push('--fastText');
  }

  return new Promise<string>((resolve, reject) => {
    const child = spawn(options.command, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const abortHandler = () => {
      child.kill();
      finishReject(new Error('mmdr render cancelled'));
    };

    const finishResolve = (value: string) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeoutId);
      options.signal?.removeEventListener('abort', abortHandler);
      resolve(value);
    };

    const finishReject = (error: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeoutId);
      options.signal?.removeEventListener('abort', abortHandler);
      reject(error);
    };

    const timeoutId = setTimeout(() => {
      child.kill();
      finishReject(new Error('mmdr render timed out'));
    }, options.timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      finishReject(error instanceof Error ? error : new Error(String(error)));
    });

    if (options.signal?.aborted) {
      abortHandler();
      return;
    }

    options.signal?.addEventListener('abort', abortHandler, { once: true });

    child.on('close', (code) => {
      if (code !== 0) {
        finishReject(new Error(stderr || `mmdr exited with code ${code}`));
        return;
      }

      if (!SVG_OUTPUT_REGEX.test(stdout.trim())) {
        finishReject(new Error('mmdr did not return SVG output'));
        return;
      }

      finishResolve(stdout);
    });

    child.stdin.write(source);
    child.stdin.end();
  });
}

export async function isMmdrAvailable(command: string, timeoutMs: number = 2000): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const child = spawn(command, ['--version'], { stdio: ['ignore', 'ignore', 'ignore'] });
    let settled = false;

    const finish = (value: boolean) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeoutId);
      resolve(value);
    };

    const timeoutId = setTimeout(() => {
      child.kill();
      finish(false);
    }, timeoutMs);

    child.on('error', () => finish(false));
    child.on('close', (code) => finish(code === 0));
  });
}
