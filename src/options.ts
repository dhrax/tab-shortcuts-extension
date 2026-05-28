import { getRequiredElement, setStatus } from "./popup/dom.js";
import { loadSettings, saveSettings, CopyFormat } from "./shared/storage.js";

const confirmCheckbox = getRequiredElement<HTMLInputElement>(
  "confirm-before-closing"
);
const ignorePinnedCheckbox = getRequiredElement<HTMLInputElement>(
  "ignore-pinned-tabs"
);
const formatSelect = getRequiredElement<HTMLSelectElement>(
  "default-copy-format"
);
const sessionPrefixInput = getRequiredElement<HTMLInputElement>(
  "default-session-name-prefix"
);
const saveButton = getRequiredElement<HTMLButtonElement>(
  "save-settings-button"
);

async function loadInitialSettings(): Promise<void> {
  const settings = await loadSettings();

  confirmCheckbox.checked = settings.confirmBeforeClosing;
  ignorePinnedCheckbox.checked = settings.ignorePinnedTabs;
  formatSelect.value = settings.defaultCopyFormat;
  sessionPrefixInput.value = settings.defaultSessionNamePrefix;
}

async function saveCurrentSettings(): Promise<void> {
  const selectedFormat = formatSelect.value as CopyFormat;
  const settings = {
    confirmBeforeClosing: confirmCheckbox.checked,
    ignorePinnedTabs: ignorePinnedCheckbox.checked,
    defaultCopyFormat: selectedFormat,
    defaultSessionNamePrefix: sessionPrefixInput.value.trim() || "Session"
  };

  await saveSettings(settings);
  setStatus("Settings saved", "success");
}

saveButton.addEventListener("click", () => {
  void saveCurrentSettings().catch((error: unknown) => {
    setStatus(
      error instanceof Error ? error.message : "Unable to save settings",
      "error"
    );
  });
});

window.addEventListener("DOMContentLoaded", () => {
  void loadInitialSettings().catch((error: unknown) => {
    setStatus(
      error instanceof Error ? error.message : "Unable to load settings",
      "error"
    );
  });
});
