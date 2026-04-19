export class UiState {
  sidebarOpen = $state(true);
  activePanel = $state<string | null>(null);
}
export const ui = new UiState();
