export function initializeNavigation(): void {
  const tabButtons = Array.from(
    document.querySelectorAll<HTMLButtonElement>("[data-section]")
  );
  const sections = Array.from(
    document.querySelectorAll<HTMLElement>(".section-panel")
  );

  function openSection(sectionId: string): void {
    tabButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.section === sectionId);
    });

    sections.forEach((section) => {
      section.classList.toggle("hidden", section.id !== sectionId);
    });
  }

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.section) {
        openSection(button.dataset.section);
      }
    });
  });

  openSection("actions-section");
}
