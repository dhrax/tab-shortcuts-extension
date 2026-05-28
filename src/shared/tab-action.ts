export const TAB_ACTIONS = [
  "duplicate-current-tab",
  "toggle-mute-current-tab",
  "mute-other-tabs",
  "close-duplicate-tabs",
  "close-tabs-to-left",
  "close-tabs-to-right",
  "close-other-tabs",
  "group-tabs-by-domain",
  "sort-tabs-by-domain",
  "toggle-pin-current-tab"
] as const;

export type TabAction = (typeof TAB_ACTIONS)[number];

export interface ExtensionMessage {
  action: TabAction;
}

export interface ExtensionResponse {
  success: boolean;
  message: string;
}

export function isTabAction(value: unknown): value is TabAction {
  return typeof value === "string" && TAB_ACTIONS.includes(value as TabAction);
}