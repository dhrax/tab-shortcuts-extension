export interface SessionTab {
  title: string;
  url: string;
}

export interface SavedSession {
  id: string;
  name: string;
  createdAt: string;
  tabs: SessionTab[];
}

export interface Snippet {
  id: string;
  title: string;
  content: string;
  createdAt: string;
}

const STORAGE_KEYS = {
  savedSessions: "savedSessions",
  savedSnippets: "savedSnippets"
} as const;

function getStorage<T>(keys: string | string[] | object): Promise<T> {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, (result) => {
      resolve(result as T);
    });
  });
}

function setStorage(value: Record<string, unknown>): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set(value, () => {
      resolve();
    });
  });
}

export async function loadSavedSessions(): Promise<SavedSession[]> {
  const result = await getStorage<{ savedSessions?: SavedSession[] }>(
    { savedSessions: [] }
  );

  return Array.isArray(result.savedSessions) ? result.savedSessions : [];
}

export async function saveSavedSessions(
  sessions: SavedSession[]
): Promise<void> {
  await setStorage({ [STORAGE_KEYS.savedSessions]: sessions });
}

export async function loadSnippets(): Promise<Snippet[]> {
  const result = await getStorage<{ savedSnippets?: Snippet[] }>(
    { savedSnippets: [] }
  );

  return Array.isArray(result.savedSnippets) ? result.savedSnippets : [];
}

export async function saveSnippets(snippets: Snippet[]): Promise<void> {
  await setStorage({ [STORAGE_KEYS.savedSnippets]: snippets });
}

export async function ensureDefaultSnippets(defaults: Snippet[]): Promise<void> {
  const snippets = await loadSnippets();

  if (snippets.length === 0) {
    await saveSnippets(defaults);
  }
}
