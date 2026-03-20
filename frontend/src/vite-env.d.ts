/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_WEB_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
