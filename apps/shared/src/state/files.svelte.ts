export class FilesState {
  currentFile = $state<string | null>(null);
}
export const files = new FilesState();
