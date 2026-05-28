import { createElement, getRequiredElement, setStatus } from "./dom.js";
import {
  DomainRule,
  DomainRuleAction,
  loadDomainRules,
  saveDomainRules
} from "../shared/storage.js";

let hostnameInput: HTMLInputElement;
let actionSelect: HTMLSelectElement;
let addRuleButton: HTMLButtonElement;
let rulesList: HTMLElement;

let domainRules: DomainRule[] = [];

function ensureRulesElements(): void {
  if (hostnameInput) {
    return;
  }

  hostnameInput = getRequiredElement<HTMLInputElement>("rule-hostname-input");
  actionSelect = getRequiredElement<HTMLSelectElement>("rule-action-select");
  addRuleButton = getRequiredElement<HTMLButtonElement>("add-rule-button");
  rulesList = getRequiredElement<HTMLElement>("rules-list");
}

export async function initializeDomainRules(): Promise<void> {
  ensureRulesElements();
  addRuleButton.addEventListener("click", () => {
    void addRule().catch((error: unknown) => {
      setStatus(
        error instanceof Error ? error.message : "Unable to add rule",
        "error"
      );
    });
  });

  await loadRules();
}

async function loadRules(): Promise<void> {
  domainRules = await loadDomainRules();
  renderRules();
}

function renderRules(): void {
  rulesList.innerHTML = "";

  if (domainRules.length === 0) {
    const empty = createElement("div", "empty-message");
    empty.textContent = "No auto rules configured yet.";
    rulesList.appendChild(empty);
    return;
  }

  domainRules.forEach((rule) => {
    const item = createElement("div", "rule-item");

    const header = createElement("div", "rule-item-header");
    const title = createElement("div", "rule-item-title");
    title.textContent = rule.hostname;
    const meta = createElement("div", "rule-item-meta");
    meta.textContent = `${rule.action} · ${rule.enabled ? "enabled" : "disabled"}`;
    header.appendChild(title);
    header.appendChild(meta);

    const controls = createElement("div", "rule-actions");
    const toggleButton = createElement("button", "small-button");
    toggleButton.textContent = rule.enabled ? "Disable" : "Enable";
    toggleButton.addEventListener("click", () => {
      void toggleRuleEnabled(rule.id).catch((error: unknown) => {
        setStatus(
          error instanceof Error ? error.message : "Unable to update rule",
          "error"
        );
      });
    });

    const removeButton = createElement("button", "small-button danger");
    removeButton.textContent = "Delete";
    removeButton.addEventListener("click", () => {
      void deleteRule(rule.id).catch((error: unknown) => {
        setStatus(
          error instanceof Error ? error.message : "Unable to delete rule",
          "error"
        );
      });
    });

    controls.appendChild(toggleButton);
    controls.appendChild(removeButton);

    item.appendChild(header);
    item.appendChild(controls);
    rulesList.appendChild(item);
  });
}

function normalizeHostname(value: string): string | null {
  const trimmed = value.trim();

  if (trimmed === "") {
    return null;
  }

  let candidate = trimmed;

  if (!/^[a-zA-Z]+:/.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  try {
    const url = new URL(candidate);
    return url.hostname.toLowerCase();
  } catch {
    return null;
  }
}

async function addRule(): Promise<void> {
  const hostname = normalizeHostname(hostnameInput.value);

  if (!hostname) {
    throw new Error("Enter a valid hostname or domain.");
  }

  const action = actionSelect.value as DomainRuleAction;
  const now = new Date().toISOString();

  domainRules = [
    ...domainRules,
    {
      id: crypto.randomUUID(),
      hostname,
      action,
      enabled: false,
      createdAt: now,
      updatedAt: now
    }
  ];

  await saveDomainRules(domainRules);
  renderRules();
  hostnameInput.value = "";
  actionSelect.value = "mute";
  setStatus("Rule added. Enable it when ready.", "success");
}

async function toggleRuleEnabled(ruleId: string): Promise<void> {
  domainRules = domainRules.map((rule) =>
    rule.id === ruleId
      ? { ...rule, enabled: !rule.enabled, updatedAt: new Date().toISOString() }
      : rule
  );

  await saveDomainRules(domainRules);
  renderRules();
}

async function deleteRule(ruleId: string): Promise<void> {
  domainRules = domainRules.filter((rule) => rule.id !== ruleId);
  await saveDomainRules(domainRules);
  renderRules();
}
