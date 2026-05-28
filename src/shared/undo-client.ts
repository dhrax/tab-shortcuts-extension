import type { UndoEntry } from "./storage.js";

export async function getUndoHistory(): Promise<UndoEntry[]> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: "get-undo-history" },
      (response: { success: boolean; history?: UndoEntry[]; error?: string }) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        if (response.success && response.history) {
          resolve(response.history);
        } else {
          reject(new Error(response.error ?? "Failed to get undo history"));
        }
      }
    );
  });
}

export async function performUndo(): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: "perform-undo" },
      (response: { success: boolean; message?: string; error?: string }) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        if (response.success && response.message) {
          resolve(response.message);
        } else {
          reject(new Error(response.error ?? "Failed to undo"));
        }
      }
    );
  });
}

export async function clearUndoHistory(): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: "clear-undo-history" },
      (response: { success: boolean; error?: string }) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        if (response.success) {
          resolve();
        } else {
          reject(new Error(response.error ?? "Failed to clear history"));
        }
      }
    );
  });
}
