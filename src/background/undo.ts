import type { UndoEntry } from "../shared/storage.js";
import { loadUndoHistory, saveUndoHistory } from "../shared/storage.js";
export { recordClosedTabs } from "../shared/undo-history.js";

async function createTab(createProperties: chrome.tabs.CreateProperties): Promise<chrome.tabs.Tab> {
  return new Promise((resolve, reject) => {
    chrome.tabs.create(createProperties, (tab) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(tab);
    });
  });
}

export async function performUndo(): Promise<string> {
  const history = await loadUndoHistory();

  if (history.length === 0) {
    throw new Error("No actions to undo");
  }

  const entry = history[0];
  const { tabs } = entry;

  for (const tab of tabs) {
    await createTab({ url: tab.url });
  }

  history.shift();
  await saveUndoHistory(history);

  return `Reopened ${tabs.length} tab${tabs.length === 1 ? "" : "s"} from "${entry.action}"`;
}

export async function getUndoHistory(): Promise<UndoEntry[]> {
  return loadUndoHistory();
}

export async function clearUndoHistory(): Promise<void> {
  await saveUndoHistory([]);
}
