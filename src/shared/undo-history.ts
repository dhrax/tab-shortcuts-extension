import type { ClosedTab, UndoEntry } from "./storage.js";
import { loadUndoHistory, saveUndoHistory } from "./storage.js";

const MAX_UNDO_ENTRIES = 10;

export async function recordClosedTabs(
  action: string,
  tabs: chrome.tabs.Tab[]
): Promise<void> {
  const closedTabs: ClosedTab[] = tabs
    .filter((tab) => tab.url !== undefined)
    .map((tab) => ({
      url: tab.url as string,
      title: tab.title ?? "Untitled"
    }));

  if (closedTabs.length === 0) {
    return;
  }

  const history = await loadUndoHistory();
  const newEntry: UndoEntry = {
    id: crypto.randomUUID(),
    action,
    timestamp: new Date().toISOString(),
    tabs: closedTabs
  };

  await saveUndoHistory([newEntry, ...history].slice(0, MAX_UNDO_ENTRIES));
}
