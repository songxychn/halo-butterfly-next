import type Theme from './core/theme.ts';
import type Common from './core/common.ts';
import type Scroll from './core/scroll.ts';
import type Message from './core/_message.ts';

/** Values injected by Halo and old saved theme configurations. */
export type SettingValue = string | number | boolean | null | undefined;
export type ColorScheme = 'light' | 'dark';
export interface PaginationConfig {
  total: number;
  page: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
  prevUrl: string;
  nextUrl: string;
}
export interface ThemeConfig extends Partial<PaginationConfig> {
  restore_aside?: boolean;
  style_mode?: SettingValue;
  darkmode_autoChangeMode?: SettingValue;
  darkmode_start?: SettingValue;
  darkmode_end?: SettingValue;
  enable_aside?: SettingValue;
  enable_webInfo?: SettingValue;
  assets_link?: string;
  nav_fixed?: boolean;
  nav_display_post_title?: boolean;
  rightside_scroll_percent?: SettingValue;
  enable_above?: SettingValue;
  above_background?: string;
  enable_h_icon?: SettingValue;
  toc_number?: SettingValue;
  toc_expand?: SettingValue;
  toc_scroll_percent?: SettingValue;
  anchor_auto_update?: SettingValue;
  anchor_click_to_scroll?: SettingValue;
  photofigcaption?: SettingValue;
  related_post_limit?: SettingValue;
  post_copyright_decode?: SettingValue;
  enable_code?: SettingValue;
  enable_code_copy?: SettingValue;
  enable_code_expander?: SettingValue;
  enable_code_title?: SettingValue;
  enable_code_hr?: SettingValue;
  enable_code_line?: SettingValue;
  enable_code_mac_style?: SettingValue;
  code_height_limit?: SettingValue;
  enable_code_word_wrap?: SettingValue;
  enable_code_fullpage?: SettingValue;
  subtitle_source?: SettingValue;
  subtitle_typed_option?: unknown;
  enable_subtitle?: boolean;
  subtitle_effect?: boolean;
  typewriter_custom_text?: string;
  typewriter_random_api?: string;
  enable_typewriter_random_text?: boolean;
  typewriter_api_value_format?: string;
}
export interface ThemeModule { name: string }
export interface PrismApi { highlightAllUnder(root: Element): void }
export interface ThemeApp {
  conf: ThemeConfig;
  attrs: { enable_code_copy?: SettingValue };
  modules: Record<string, ThemeModule>;
  data?: unknown;
  useTheme: Theme;
  useCommon: Common;
  useScroll: Scroll;
  useMessage: Message;
  codeDomReady?: Promise<unknown>;
  prismSource?: string;
  prismReady?: Promise<boolean>;
}
export interface ArchiveYear { year: number; months: { month: number; posts: unknown[] }[] }
export interface Category { postCount: number; spec: { displayName: string } }
