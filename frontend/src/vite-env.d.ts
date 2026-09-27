/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Full API base URL in production, e.g. https://aurelle-api.onrender.com/api */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
