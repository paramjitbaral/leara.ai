import { WebContainer } from '@webcontainer/api';

let webcontainerPromise: Promise<WebContainer> | null = null;

export async function getWebContainer() {
  if (!webcontainerPromise) {
    webcontainerPromise = WebContainer.boot();
  }
  return webcontainerPromise;
}

export async function mountFiles(files: any) {
  const wc = await getWebContainer();
  await wc.mount(files);
}

export async function spawnTerminal(
  terminal: any, 
  onServerReady?: (url: string) => void
) {
  const wc = await getWebContainer();
  
  const shellProcess = await wc.spawn('jsh', {
    terminal: {
      cols: terminal.cols,
      rows: terminal.rows,
    },
  });

  shellProcess.output.pipeTo(
    new WritableStream({
      write(data) {
        terminal.write(data);
      },
    })
  );

  const input = shellProcess.input.getWriter();

  terminal.onData((data: string) => {
    input.write(data);
  });

  wc.on('server-ready', (port, url) => {
    if (onServerReady) {
      onServerReady(url);
    }
  });

  return shellProcess;
}

export function transformToWebContainerFiles(files: any[]): any {
  const result: any = {};

  files.forEach((file) => {
    if (file.type === 'directory') {
      result[file.name] = {
        directory: transformToWebContainerFiles(file.children || []),
      };
    } else {
      result[file.name] = {
        file: {
          contents: '', // Will be populated on demand or initial load
        },
      };
    }
  });

  return result;
}
