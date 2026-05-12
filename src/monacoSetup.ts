// Monaco worker setup for Vite.
// Using Vite's `?worker` imports ensures the workers are emitted as real JS modules.
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import CssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import HtmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import TsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

import * as monaco from 'monaco-editor';
import { loader } from '@monaco-editor/react';

// Configure monaco-editor/react to use local monaco instance
loader.config({ monaco });

const globalScope = globalThis as any;

globalScope.MonacoEnvironment = {
  getWorker: (_moduleId: string, label: string) => {
    if (label === 'json') return new JsonWorker();
    if (label === 'css' || label === 'scss' || label === 'less') return new CssWorker();
    if (label === 'html' || label === 'handlebars' || label === 'razor') return new HtmlWorker();
    if (label === 'typescript' || label === 'javascript') return new TsWorker();
    return new EditorWorker();
  }
};

export default null;
