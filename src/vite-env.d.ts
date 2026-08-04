/// <reference types="vite/client" />

// vite.config.ts の define でビルド時に注入される
declare const __APP_VERSION__: string;
declare const __GIT_COMMIT__: string;

declare module "monaco-editor/editor/editor.worker?worker" {
  const WorkerFactory: new () => Worker;
  export default WorkerFactory;
}

declare module "monaco-editor/languages/features/typescript/ts.worker?worker" {
  const WorkerFactory: new () => Worker;
  export default WorkerFactory;
}
