export function initializeNavigation(): void {
  const viewSelector = document.getElementById("view-selector") as HTMLSelectElement | null;
  const sections = Array.from(
    document.querySelectorAll<HTMLElement>(".section-panel")
  );

  if (!viewSelector) {
    return;
  }

  function openSection(sectionId: string): void {
    sections.forEach((section) => {
      section.classList.toggle("hidden", section.id !== sectionId);
    });

    viewSelector!.value = sectionId;
  }

  viewSelector.addEventListener("change", () => {
    openSection(viewSelector.value);
  });

  openSection("actions-section");
}
