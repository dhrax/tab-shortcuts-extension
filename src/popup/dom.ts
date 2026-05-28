export function getRequiredElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);

  if (element === null) {
    throw new Error(`Element with id not found: ${id}`);
  }

  return element as T;
}

export function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  attributes?: Record<string, string>
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);

  if (className) {
    element.className = className;
  }

  if (attributes) {
    Object.entries(attributes).forEach(([key, value]) => {
      element.setAttribute(key, value);
    });
  }

  return element;
}

export function setStatus(
  message: string,
  type: "success" | "error" | "neutral" = "neutral"
): void {
  const statusElement = document.getElementById("status");

  if (statusElement === null) {
    return;
  }

  statusElement.textContent = message;
  statusElement.classList.remove("success", "error");

  if (type !== "neutral") {
    statusElement.classList.add(type);
  }
}

export function formatDate(value: string): string {
  const date = new Date(value);

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}
