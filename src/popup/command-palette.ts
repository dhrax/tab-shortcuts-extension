import { getRequiredElement, setStatus } from "./dom.js";
import type { ExtensionMessage, ExtensionResponse, TabAction } from "../shared/tab-action.js";
import { copyLinks } from "./link-copy.js";
import { saveCurrentWindowSession } from "./sessions.js";
import { refreshPanelData } from "./actions-panel.js";
import { refreshHistory } from "./history.js";

interface Command {
  id: string;
  label: string;
  description: string;
  keywords: string[];
  execute: () => Promise<string>;
}

let searchInput: HTMLInputElement;
let resultsList: HTMLElement;
let commands: Command[] = [];

function ensureElements(): void {
  if (searchInput) {
    return;
  }

  searchInput = getRequiredElement<HTMLInputElement>("command-search-input");
  resultsList = getRequiredElement<HTMLElement>("command-results");
}

export async function initializeCommandPalette(): Promise<void> {
  ensureElements();
  buildCommandList();

  searchInput.addEventListener("input", () => {
    filterAndRender();
  });

  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      searchInput.value = "";
      resultsList.innerHTML = "";
      return;
    }

    if (e.key === "Enter") {
      const firstCommand = getMatchingCommands()[0];

      if (firstCommand) {
        e.preventDefault();
        void executeCommand(firstCommand);
      }
    }
  });
}

function buildCommandList(): void {
  commands = [
    {
      id: "duplicate-current-tab",
      label: "Duplicate tab",
      description: "Duplicate the current tab",
      keywords: ["duplicate current tab", "clone tab"],
      execute: async () => await sendTabAction("duplicate-current-tab")
    },
    {
      id: "toggle-mute-current-tab",
      label: "Toggle mute",
      description: "Mute or unmute current tab",
      keywords: ["mute tab", "unmute tab", "audio"],
      execute: async () => await sendTabAction("toggle-mute-current-tab")
    },
    {
      id: "mute-other-tabs",
      label: "Mute others",
      description: "Mute all other tabs",
      keywords: ["mute other tabs", "silence others"],
      execute: async () => await sendTabAction("mute-other-tabs")
    },
    {
      id: "close-duplicate-tabs",
      label: "Close duplicates",
      description: "Close duplicate tabs",
      keywords: ["close duplicate tabs", "remove duplicates"],
      execute: async () => await sendTabAction("close-duplicate-tabs")
    },
    {
      id: "close-tabs-to-left",
      label: "Close left",
      description: "Close tabs to the left",
      keywords: ["close left tabs", "close tabs left"],
      execute: async () => await sendTabAction("close-tabs-to-left")
    },
    {
      id: "close-tabs-to-right",
      label: "Close right",
      description: "Close tabs to the right",
      keywords: ["close right tabs", "close tabs right"],
      execute: async () => await sendTabAction("close-tabs-to-right")
    },
    {
      id: "close-other-tabs",
      label: "Close others",
      description: "Close all other tabs",
      keywords: ["close other tabs", "close others"],
      execute: async () => await sendTabAction("close-other-tabs")
    },
    {
      id: "group-tabs-by-domain",
      label: "Group by domain",
      description: "Group tabs in current window by domain",
      keywords: ["group by domain", "domain group"],
      execute: async () => await sendTabAction("group-tabs-by-domain")
    },
    {
      id: "sort-tabs-by-domain",
      label: "Sort by domain",
      description: "Sort tabs by domain",
      keywords: ["sort by domain", "domain sort"],
      execute: async () => await sendTabAction("sort-tabs-by-domain")
    },
    {
      id: "toggle-pin-current-tab",
      label: "Pin / unpin",
      description: "Pin or unpin current tab",
      keywords: ["pin tab", "unpin tab"],
      execute: async () => await sendTabAction("toggle-pin-current-tab")
    },
    {
      id: "copy-markdown",
      label: "Copy markdown",
      description: "Copy current tab as markdown",
      keywords: ["copy markdown", "markdown link"],
      execute: async () => {
        await copyLinks("current-tab", "markdown");
        return "Text copied";
      }
    },
    {
      id: "copy-plain",
      label: "Copy plain text",
      description: "Copy current tab as plain text",
      keywords: ["copy plain", "copy text"],
      execute: async () => {
        await copyLinks("current-tab", "plain");
        return "Text copied";
      }
    },
    {
      id: "save-session",
      label: "Save session",
      description: "Save current open tabs as session",
      keywords: ["save session", "session"],
      execute: async () => await saveCurrentWindowSession()
    }
  ];
}

function filterAndRender(): void {
  const query = searchInput.value.trim();

  if (query.length === 0) {
    resultsList.innerHTML = "";
    return;
  }

  const filtered = getMatchingCommands();

  resultsList.innerHTML = "";

  if (filtered.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-message";
    empty.textContent = "No matching commands";
    resultsList.appendChild(empty);
    return;
  }

  filtered.slice(0, 8).forEach((cmd) => {
    const item = document.createElement("button");
    item.className = "command-item";
    item.type = "button";

    const header = document.createElement("div");
    header.className = "command-item-header";

    const label = document.createElement("div");
    label.className = "command-item-label";
    label.textContent = cmd.label;

    const desc = document.createElement("div");
    desc.className = "command-item-desc";
    desc.textContent = cmd.description;

    header.appendChild(label);
    header.appendChild(desc);

    item.appendChild(header);
    item.addEventListener("click", () => {
      void executeCommand(cmd);
    });

    resultsList.appendChild(item);
  });
}

async function executeCommand(cmd: Command): Promise<void> {
  try {
    const result = await cmd.execute();
    searchInput.value = "";
    resultsList.innerHTML = "";
    setStatus(result, "success");
    await Promise.all([refreshPanelData(), refreshHistory()]);
  } catch (error: unknown) {
    setStatus(
      error instanceof Error ? error.message : "Command failed",
      "error"
    );
  }
}

function getMatchingCommands(): Command[] {
  const query = searchInput.value.toLowerCase().trim();

  if (query.length === 0) {
    return [];
  }

  return commands.filter((cmd) => {
    const searchable = [
      cmd.id,
      cmd.label,
      cmd.description,
      ...cmd.keywords
    ]
      .join(" ")
      .toLowerCase();

    return query
      .split(/\s+/)
      .every((term) => searchable.includes(term));
  });
}

async function sendTabAction(action: TabAction): Promise<string> {
  const message: ExtensionMessage = { action };

  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      message,
      (response: ExtensionResponse) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        if (response.success) {
          resolve(response.message);
        } else {
          reject(new Error(response.message));
        }
      }
    );
  });
}
