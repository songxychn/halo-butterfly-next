import type { ThemeApp, PrismApi } from '../js/types.ts';
declare global {
  var MainApp: ThemeApp;
  interface Window { MainApp: ThemeApp; Prism?: PrismApi }
}
export {};
