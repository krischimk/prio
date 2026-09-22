/// <reference types="vite/client" />

/**
 * Version aus `package.json`, beim Bauen eingesetzt (siehe `vite.config.ts`).
 *
 * Im Browser ist das die einzige Quelle. In der App kommt die tatsächlich
 * installierte Version dazu – wer eine ältere Fassung installiert hat, soll
 * das Update angeboten bekommen.
 */
declare const __APP_VERSION__: string
