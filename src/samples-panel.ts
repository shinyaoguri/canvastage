import { SAMPLE_CATEGORIES, SampleCategory } from "./samples";
import { Files } from "./preview";

export type SampleSelectCallback = (files: Files) => void;

export class SamplesPanel {
  private container: HTMLElement;
  private panel: HTMLElement;
  private isOpen: boolean = false;
  private onSelect?: SampleSelectCallback;

  constructor(container: HTMLElement) {
    this.container = container;

    this.panel = document.createElement("div");
    this.panel.id = "samples-panel";
    this.panel.innerHTML = this.buildHTML();
    this.container.appendChild(this.panel);

    this.bindEvents();
  }

  setOnSelect(callback: SampleSelectCallback): void {
    this.onSelect = callback;
  }

  private buildHTML(): string {
    let html = `<div class="samples-header">
      <span>Samples</span>
      <button class="samples-close">×</button>
    </div>
    <div class="samples-content">
      <div class="samples-categories">`;

    for (const category of SAMPLE_CATEGORIES) {
      html += `<button class="samples-category-btn" data-category="${category.id}">
        <span class="samples-category-icon">${category.icon}</span>
        <span class="samples-category-name">${category.name}</span>
      </button>`;
    }

    html += `</div>
      <div class="samples-list"></div>
    </div>`;

    return html;
  }

  private renderSampleList(category: SampleCategory): void {
    const listEl = this.panel.querySelector(".samples-list") as HTMLElement;
    if (!listEl) return;

    let html = `<div class="samples-list-header">${category.name}</div>`;

    for (const sample of category.samples) {
      html += `<button class="samples-item" data-sample="${sample.id}" data-category="${category.id}">
        <div class="samples-item-name">${sample.name}</div>
        <div class="samples-item-desc">${sample.description}</div>
      </button>`;
    }

    listEl.innerHTML = html;

    // サンプルアイテムのクリックイベント
    listEl.querySelectorAll(".samples-item").forEach((item) => {
      item.addEventListener("click", () => {
        const categoryId = (item as HTMLElement).dataset.category;
        const sampleId = (item as HTMLElement).dataset.sample;
        this.selectSample(categoryId!, sampleId!);
      });
    });
  }

  private selectSample(categoryId: string, sampleId: string): void {
    const category = SAMPLE_CATEGORIES.find((c) => c.id === categoryId);
    if (!category) return;

    const sample = category.samples.find((s) => s.id === sampleId);
    if (!sample) return;

    if (this.onSelect) {
      this.onSelect(sample.files);
    }

    this.close();
  }

  private bindEvents(): void {
    // カテゴリボタン
    this.panel.querySelectorAll(".samples-category-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const categoryId = (btn as HTMLElement).dataset.category;
        const category = SAMPLE_CATEGORIES.find((c) => c.id === categoryId);

        if (category) {
          // アクティブ状態を更新
          this.panel.querySelectorAll(".samples-category-btn").forEach((b) => {
            b.classList.remove("active");
          });
          btn.classList.add("active");
          this.renderSampleList(category);
        }
      });
    });

    // 閉じるボタン
    this.panel.querySelector(".samples-close")?.addEventListener("click", () => {
      this.close();
    });

    // 初期表示: 最初のカテゴリを選択
    const firstCategoryBtn = this.panel.querySelector(".samples-category-btn");
    if (firstCategoryBtn) {
      (firstCategoryBtn as HTMLElement).click();
    }
  }

  toggle(): void {
    this.isOpen = !this.isOpen;
    this.panel.classList.toggle("open", this.isOpen);
  }

  close(): void {
    this.isOpen = false;
    this.panel.classList.remove("open");
  }

  open(): void {
    this.isOpen = true;
    this.panel.classList.add("open");
  }
}
