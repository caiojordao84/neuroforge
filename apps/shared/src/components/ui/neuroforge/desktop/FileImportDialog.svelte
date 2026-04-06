<script lang="ts">
  let {
    open = $bindable(false),
    mode = 'library',          // 'main' | 'library'
    onCreateNew,               // (name: string) => void
    onImportGitHub,            // (url: string) => void
    onImportFiles,             // (files: FileList) => void
    onClose,                   // () => void
  }: {
    open: boolean;
    mode?: 'main' | 'library';
    onCreateNew?: (name: string) => void;
    onImportGitHub?: (url: string) => void;
    onImportFiles?: (files: FileList) => void;
    onClose?: () => void;
  } = $props();

  let activeOption = $state<'new' | 'github' | 'file'>('new');
  let newFileName = $state('');
  let githubUrl = $state('');
  let fileInput = $state<HTMLInputElement | undefined>();

  function handleCreateNew() {
    if (!newFileName.trim()) return;
    onCreateNew?.(newFileName.trim());
    newFileName = '';
    close();
  }

  function handleImportGitHub() {
    if (!githubUrl.trim()) return;
    onImportGitHub?.(githubUrl.trim());
    githubUrl = '';
    close();
  }

  function handleFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      onImportFiles?.(input.files);
      close();
    }
  }

  function close() {
    open = false;
    activeOption = 'new';
    newFileName = '';
    githubUrl = '';
    onClose?.();
  }

  function handleBackdrop(e: MouseEvent) {
    if (e.target === e.currentTarget) close();
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div
    role="dialog"
    aria-modal="true"
    aria-labelledby="dialog-title"
    class="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
    onclick={handleBackdrop}
  >
    <div class="w-[360px] bg-[#131221] border border-white/10 rounded-lg shadow-2xl overflow-hidden">
      <!-- Header -->
      <div class="h-10 flex items-center justify-between px-4 border-b border-white/5 bg-white/[0.02]">
        <span class="text-xs font-semibold text-white/80 uppercase tracking-wider">
          {mode === 'main' ? 'Import Main File' : 'Add Library'}
        </span>
        <button
          class="text-white/30 hover:text-white transition-colors"
          onclick={close}
        >
          <span class="material-symbols-outlined text-sm">close</span>
        </button>
      </div>

      <!-- Option Tabs -->
      <div class="flex border-b border-white/5">
        {#if mode === 'library'}
          <button
            class="flex-1 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors {activeOption === 'new' ? 'text-primary-container border-b-2 border-primary-container' : 'text-white/40 hover:text-white/60'}"
            onclick={() => activeOption = 'new'}
          >
            Create New
          </button>
        {/if}
        <button
          class="flex-1 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors {activeOption === 'github' ? 'text-primary-container border-b-2 border-primary-container' : 'text-white/40 hover:text-white/60'}"
          onclick={() => activeOption = 'github'}
        >
          GitHub
        </button>
        <button
          class="flex-1 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors {activeOption === 'file' ? 'text-primary-container border-b-2 border-primary-container' : 'text-white/40 hover:text-white/60'}"
          onclick={() => activeOption = 'file'}
        >
          Computer
        </button>
      </div>

      <!-- Content -->
      <div class="p-4">
        {#if activeOption === 'new' && mode === 'library'}
          <div class="space-y-3">
            <label for="filename-input" class="block text-[10px] uppercase tracking-wider text-white/40 font-semibold">
              File name (with extension)
            </label>
            <input
              id="filename-input"
              type="text"
              placeholder="e.g. utils.h, helpers.py, motor.rs"
              bind:value={newFileName}
              class="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-xs text-white/90 font-mono placeholder:text-white/20 focus:outline-none focus:border-primary-container/50 transition-colors"
              onkeydown={(e: KeyboardEvent) => e.key === 'Enter' && handleCreateNew()}
            />
            <button
              class="w-full py-2 text-xs font-bold uppercase tracking-wider rounded transition-all {newFileName.trim() ? 'bg-primary-container/20 text-primary-container hover:bg-primary-container/30' : 'bg-white/5 text-white/20 cursor-not-allowed'}"
              onclick={handleCreateNew}
              disabled={!newFileName.trim()}
            >
              Create
            </button>
          </div>

        {:else if activeOption === 'github'}
          <div class="space-y-3">
            <label for="github-url-input" class="block text-[10px] uppercase tracking-wider text-white/40 font-semibold">
              Raw GitHub URL
            </label>
            <input
              id="github-url-input"
              type="url"
              placeholder="https://raw.githubusercontent.com/..."
              bind:value={githubUrl}
              class="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-xs text-white/90 font-mono placeholder:text-white/20 focus:outline-none focus:border-primary-container/50 transition-colors"
              onkeydown={(e: KeyboardEvent) => e.key === 'Enter' && handleImportGitHub()}
            />
            <button
              class="w-full py-2 text-xs font-bold uppercase tracking-wider rounded transition-all {githubUrl.trim() ? 'bg-primary-container/20 text-primary-container hover:bg-primary-container/30' : 'bg-white/5 text-white/20 cursor-not-allowed'}"
              onclick={handleImportGitHub}
              disabled={!githubUrl.trim()}
            >
              Import
            </button>
          </div>

        {:else if activeOption === 'file'}
          <div class="space-y-3">
            <label for="file-input" class="block text-[10px] uppercase tracking-wider text-white/40 font-semibold">
              Select file(s) from your computer
            </label>
            <input
              id="file-input"
              bind:this={fileInput}
              type="file"
              multiple={mode === 'library'}
              accept=".c,.cpp,.h,.hpp,.ino,.py,.rs,.st,.txt"
              class="hidden"
              onchange={handleFileSelect}
            />
            <button
              class="w-full py-6 border-2 border-dashed border-white/10 rounded-lg text-white/40 hover:border-primary-container/30 hover:text-primary-container/60 transition-all flex flex-col items-center gap-2"
              onclick={() => fileInput?.click()}
            >
              <span class="material-symbols-outlined text-2xl">upload_file</span>
              <span class="text-xs font-medium">
                {mode === 'library' ? 'Choose files (multiple allowed)' : 'Choose file'}
              </span>
            </button>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}
