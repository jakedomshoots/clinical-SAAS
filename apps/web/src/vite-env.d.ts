/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_COPILOTKIT_RUNTIME_URL?: string;
  readonly VITE_COPILOTKIT_PUBLIC_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
