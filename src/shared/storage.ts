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

export interface ImportedData {
  sessions?: SavedSession[];
  snippets?: Snippet[];
}

function isValidIsoDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    !Number.isNaN(Date.parse(value)) &&
    value.trim().length > 0
  );
}

function isValidSessionTab(value: unknown): value is { title: string; url: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { title?: unknown }).title === "string" &&
    typeof (value as { url?: unknown }).url === "string"
  );
}

function isValidSavedSession(value: unknown): value is SavedSession {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const item = value as Partial<SavedSession>;

  return (
    typeof item.id === "string" &&
    typeof item.name === "string" &&
    isValidIsoDate(item.createdAt) &&
    Array.isArray(item.tabs) &&
    item.tabs.every(isValidSessionTab)
  );
}

function isValidSnippet(value: unknown): value is Snippet {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const item = value as Partial<Snippet>;

  return (
    typeof item.id === "string" &&
    typeof item.title === "string" &&
    typeof item.content === "string" &&
    isValidIsoDate(item.createdAt)
  );
}

export function validateImportedData(value: unknown): value is ImportedData {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const data = value as Partial<ImportedData>;

  if (data.sessions !== undefined) {
    if (!Array.isArray(data.sessions) || !data.sessions.every(isValidSavedSession)) {
      return false;
    }
  }

  if (data.snippets !== undefined) {
    if (!Array.isArray(data.snippets) || !data.snippets.every(isValidSnippet)) {
      return false;
    }
  }

  return true;
}

export function mergeImportedSessions(
  existing: SavedSession[],
  imported: SavedSession[]
): SavedSession[] {
  const seenIds = new Set(existing.map((item) => item.id));
  const merged = [...existing];

  imported.forEach((session) => {
    const nextId = seenIds.has(session.id) ? crypto.randomUUID() : session.id;
    if (nextId !== session.id) {
      merged.push({ ...session, id: nextId });
    } else {
      merged.push(session);
    }
    seenIds.add(nextId);
  });

  return merged;
}

export function mergeImportedSnippets(
  existing: Snippet[],
  imported: Snippet[]
): Snippet[] {
  const seenIds = new Set(existing.map((item) => item.id));
  const merged = [...existing];

  imported.forEach((snippet) => {
    const nextId = seenIds.has(snippet.id) ? crypto.randomUUID() : snippet.id;
    if (nextId !== snippet.id) {
      merged.push({ ...snippet, id: nextId });
    } else {
      merged.push(snippet);
    }
    seenIds.add(nextId);
  });

  return merged;
}

export async function ensureDefaultSnippets(defaults: Snippet[]): Promise<void> {
  const snippets = await loadSnippets();

  if (snippets.length === 0) {
    await saveSnippets(defaults);
  }
}
