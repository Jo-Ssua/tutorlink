/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  /** Dominios institucionales aceptados, separados por coma. */
  readonly VITE_INSTITUTIONAL_DOMAINS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
