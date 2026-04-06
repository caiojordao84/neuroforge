<script lang="ts">
  import { onMount } from 'svelte';
  import { ideState, langDisplayNames } from '../../../../state/ide.svelte.ts';
  import { library } from '../../../../state/library.svelte.ts';
  import CodeEditor from '../../../CodeEditor.svelte';
  import FileImportDialog from './FileImportDialog.svelte';

  let isBrowser = $state(false);
  let showLangMenu = $state(false);
  let showLibMenu = $state(false);
  let showMainMenu = $state(false);

  // Import dialog state
  let importDialogOpen = $state(false);
  let importDialogMode = $state<'main' | 'library'>('library');

  // Confirmation dialog state
  let confirmDialogOpen = $state(false);
  let pendingMainImport = $state<{ content: string; name: string } | null>(null);

  onMount(() => {
    isBrowser = true;

    // Close dropdowns on outside click (document level)
    function onDocClick() {
      showLangMenu = false;
      showLibMenu = false;
      showMainMenu = false;
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  });

  function selectLang(lang: string) {
    ideState.setLanguage(lang);
    showLangMenu = false;
  }

  // ── Main tab menu actions ──
  function openMainImportDialog() {
    showMainMenu = false;
    importDialogMode = 'main';
    importDialogOpen = true;
  }

  function handleMainImportFiles(files: FileList) {
    const file = files[0];
    if (!file) return;
    file.text().then(content => {
      pendingMainImport = { content, name: file.name };
      confirmDialogOpen = true;
    });
  }

  function handleMainImportGitHub(url: string) {
    fetch(url)
      .then(r => { if (!r.ok) throw new Error('Fetch failed'); return r.text(); })
      .then(content => {
        const name = url.split('/').at(-1) ?? 'imported';
        pendingMainImport = { content, name };
        confirmDialogOpen = true;
      })
      .catch(e => ideState.addLog(`GitHub import failed: ${e}`, 'error'));
  }

  function confirmReplaceMain() {
    if (pendingMainImport) {
      ideState.replaceMainCode(pendingMainImport.content, pendingMainImport.name);
    }
    confirmDialogOpen = false;
    pendingMainImport = null;
  }

  function cancelReplaceMain() {
    confirmDialogOpen = false;
    pendingMainImport = null;
  }

  // ── Library dropdown actions ──
  function openLibraryImportDialog() {
    showLibMenu = false;
    importDialogMode = 'library';
    importDialogOpen = true;
  }

  function handleLibCreateNew(name: string) {
    library.createNew(name);
    ideState.activeTab = 'library';
    ideState.addLog(`Created library file: ${name}`, 'success');
  }

  function handleLibImportFiles(files: FileList) {
    library.importFromComputer(files).then(ids => {
      ideState.activeTab = 'library';
      ideState.addLog(`Imported ${ids.length} file(s)`, 'success');
    });
  }

  function handleLibImportGitHub(url: string) {
    library.importFromUrl(url)
      .then(() => {
        ideState.activeTab = 'library';
        ideState.addLog(`Imported from GitHub: ${url.split('/').at(-1)}`, 'success');
      })
      .catch(e => ideState.addLog(`Import failed: ${e}`, 'error'));
  }

  function selectLibrary(id: string) {
    library.setActiveLibrary(id);
    ideState.activeTab = 'library';
    showLibMenu = false;
  }

  function removeLibrary(id: string, e: Event) {
    e.stopPropagation();
    const lib = library.libraries.find((l: any) => l.id === id);
    library.deleteLibrary(id);
    if (library.libraries.length === 0) {
      ideState.activeTab = 'main';
    }
    ideState.addLog(`Removed library: ${lib?.name ?? id}`, 'info');
  }
</script>

<aside class="w-[480px] glass-panel border-l border-white/10 flex flex-col z-40">

  <!-- ═══ Upper Section: Code Editor ═══ -->
  <div class="flex-1 flex flex-col border-b border-white/5 relative">

    <!-- Toolbar: 4 items -->
    <div class="h-10 bg-white/[0.02] border-b border-white/5 flex items-center justify-between px-1 shrink-0 relative">
      <div class="flex items-center h-full">

        <!-- 1. Main Tab -->
        <div class="relative flex items-center h-full">
          <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
          <button
            class="flex items-center gap-1.5 px-3 h-full text-xs font-medium cursor-pointer transition-all {ideState.activeTab === 'main' ? 'text-primary-container bg-primary-container/10' : 'text-on-surface-variant hover:bg-white/5'}"
            onclick={(e: Event) => { e.stopPropagation(); ideState.showMain(); }}
          >
            <span class="material-symbols-outlined text-xs">description</span>
            <span class="font-mono text-[10px]">{ideState.mainFileName}</span>
          </button>
          <!-- More menu for Main -->
          <button
            class="h-full px-1 text-white/20 hover:text-white/50 transition-colors"
            onclick={(e: Event) => {
              e.stopPropagation();
              showMainMenu = !showMainMenu;
              showLibMenu = false;
              showLangMenu = false;
            }}
          >
            <span class="material-symbols-outlined text-xs">more_vert</span>
          </button>
          {#if showMainMenu}
            <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
            <div
              role="menu"
              tabindex="-1"
              class="absolute top-10 left-0 w-44 glass-panel shadow-2xl z-50 py-1 bg-[#131221] border border-white/10 rounded"
              onclick={(e: Event) => e.stopPropagation()}
            >
              <button
                role="menuitem"
                class="w-full text-left px-3 py-1.5 text-[10px] text-on-surface-variant hover:bg-primary-container/20 hover:text-primary-container transition-colors flex items-center gap-2"
                onclick={openMainImportDialog}
              >
                <span class="material-symbols-outlined text-xs">upload</span>
                Import / Open File
              </button>
            </div>
          {/if}
        </div>

        <!-- Separator -->
        <div class="w-px h-5 bg-white/5"></div>

        <!-- 2. ASL Tab -->
        <button
          class="flex items-center px-3 h-full text-[9px] font-bold uppercase tracking-wider cursor-pointer transition-colors {ideState.activeTab === 'asl' ? 'text-primary-container bg-primary-container/10' : 'text-on-surface-variant hover:bg-white/5'}"
          onclick={() => ideState.showAsl()}
        >
          ASL
        </button>

        <!-- Separator -->
        <div class="w-px h-5 bg-white/5"></div>

        <!-- 3. Library Dropdown -->
        <div class="relative h-full flex items-center">
          <button
            class="flex items-center gap-1 px-3 h-full text-[10px] font-medium cursor-pointer transition-colors {ideState.activeTab === 'library' ? 'text-primary-container bg-primary-container/10' : 'text-on-surface-variant hover:bg-white/5'}"
            onclick={(e: Event) => {
              e.stopPropagation();
              showLibMenu = !showLibMenu;
              showLangMenu = false;
              showMainMenu = false;
            }}
          >
            <span class="material-symbols-outlined text-xs">folder_open</span>
            Libraries
            {#if library.libraries.length > 0}
              <span class="bg-primary-container/20 text-primary-container text-[8px] font-bold px-1 rounded-sm">{library.libraries.length}</span>
            {/if}
            <span class="material-symbols-outlined text-[10px]">expand_more</span>
          </button>

          {#if showLibMenu}
            <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
            <div
              role="menu"
              tabindex="-1"
              class="absolute top-10 left-0 w-52 glass-panel shadow-2xl z-50 bg-[#131221] border border-white/10 rounded overflow-hidden"
              onclick={(e: Event) => e.stopPropagation()}
            >
              <!-- Existing libraries -->
              {#each library.libraries as lib (lib.id)}
                <div class="flex items-center group">
                  <button
                    role="menuitem"
                    class="flex-1 text-left px-3 py-1.5 text-[10px] font-mono hover:bg-primary-container/20 hover:text-primary-container transition-colors truncate {library.activeLibraryId === lib.id ? 'text-primary-container bg-primary-container/10' : 'text-on-surface-variant'}"
                    onclick={() => selectLibrary(lib.id)}
                  >
                    {lib.name}
                  </button>
                  <button
                    class="px-2 py-1.5 text-white/20 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                    onclick={(e: Event) => removeLibrary(lib.id, e)}
                    title="Remove"
                  >
                    <span class="material-symbols-outlined text-xs">close</span>
                  </button>
                </div>
              {/each}

              <!-- Add new -->
              <button
                role="menuitem"
                class="w-full text-left px-3 py-2 text-[10px] font-medium text-primary-container/60 hover:text-primary-container hover:bg-primary-container/10 transition-colors flex items-center gap-1.5 border-t border-white/5"
                onclick={openLibraryImportDialog}
              >
                <span class="material-symbols-outlined text-xs">add</span>
                Add library
              </button>
            </div>
          {/if}
        </div>
      </div>

      <!-- 4. Language Selector (right side) -->
      <div class="relative h-full flex items-center">
        <button
          class="flex items-center gap-1 px-3 h-full text-[10px] font-mono text-on-surface-variant uppercase tracking-wider hover:text-white transition-colors"
          onclick={(e: Event) => {
            e.stopPropagation();
            showLangMenu = !showLangMenu;
            showLibMenu = false;
            showMainMenu = false;
          }}
        >
          {ideState.language}
          <span class="material-symbols-outlined text-[10px]">expand_more</span>
        </button>

        {#if showLangMenu}
          <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
          <div
            role="menu"
            tabindex="-1"
            class="absolute top-10 right-0 w-40 glass-panel shadow-2xl z-50 py-1 bg-[#131221] border border-white/10 rounded"
            onclick={(e: Event) => e.stopPropagation()}
          >
            {#each ideState.availableLanguages as lang}
              <button
                role="menuitem"
                class="w-full text-left px-3 py-1.5 text-[10px] hover:bg-primary-container/20 transition-colors flex items-center justify-between {ideState.language === lang ? 'text-primary-container font-bold' : 'text-on-surface-variant'}"
                onclick={() => selectLang(lang)}
              >
                <span>{langDisplayNames[lang] ?? lang}</span>
                {#if ideState.language === lang}
                  <span class="material-symbols-outlined text-xs text-primary-container">check</span>
                {/if}
              </button>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <!-- Editor Content -->
    <div class="flex-1 bg-surface-container-lowest overflow-hidden">
      {#if isBrowser}
        {#if ideState.activeTab === 'asl'}
          <CodeEditor
            height="100%"
            language="json"
            readOnly={true}
            value={ideState.transpiledAsl}
          />
        {:else if ideState.activeTab === 'library' && library.activeLibrary}
          <CodeEditor
            height="100%"
            language={library.activeLibrary.language}
            bind:value={library.activeLibrary.content}
          />
        {:else}
          <CodeEditor
            height="100%"
            language={ideState.language}
            bind:value={ideState.code}
          />
        {/if}
      {:else}
        <div class="h-full w-full flex items-center justify-center text-white/10 animate-pulse">
          <span class="material-symbols-outlined text-4xl">code</span>
        </div>
      {/if}
    </div>
  </div>

  <!-- ═══ Lower Section: Console Output (only visible on Main tab) ═══ -->
  {#if ideState.activeTab === 'main'}
    <div class="h-64 flex flex-col bg-black/40 shrink-0">
      <div class="h-8 border-b border-white/5 px-4 flex items-center justify-between">
        <span class="font-mono text-[10px] font-bold uppercase text-white/50 flex items-center gap-2">
          <span class="material-symbols-outlined text-xs">terminal</span> CONSOLE OUTPUT
        </span>
        <div class="flex gap-2">
          <button class="text-white/30 hover:text-primary-container transition-colors" title="Copy Log" onclick={() => navigator.clipboard.writeText(JSON.stringify(ideState.terminalLogs))}>
            <span class="material-symbols-outlined text-xs">content_copy</span>
          </button>
          <button class="text-white/30 hover:text-primary-container transition-colors" title="Clear" onclick={() => ideState.terminalLogs = []}>
            <span class="material-symbols-outlined text-xs">delete_sweep</span>
          </button>
        </div>
      </div>
      <div class="flex-1 p-3 font-mono text-[10px] overflow-y-auto space-y-1 custom-scrollbar">
        {#each ideState.terminalLogs as log}
          <div class="flex gap-2">
            <span class="text-white/20 shrink-0">[{log.time}]</span>
            <span class={log.type === 'error' ? 'text-error' : log.type === 'success' ? 'text-primary-container' : 'text-blue-400'}>
              {log.msg}
            </span>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</aside>

<!-- ═══ Import Dialog ═══ -->
<FileImportDialog
  bind:open={importDialogOpen}
  mode={importDialogMode}
  onCreateNew={handleLibCreateNew}
  onImportGitHub={importDialogMode === 'main' ? handleMainImportGitHub : handleLibImportGitHub}
  onImportFiles={importDialogMode === 'main' ? handleMainImportFiles : handleLibImportFiles}
/>

<!-- ═══ Confirmation Dialog (Replace Main) ═══ -->
{#if confirmDialogOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div
    role="dialog"
    aria-modal="true"
    aria-labelledby="confirm-title"
    tabindex="-1"
    class="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm"
    onclick={(e: MouseEvent) => { if (e.target === e.currentTarget) cancelReplaceMain(); }}
  >
    <div class="w-[340px] bg-[#131221] border border-white/10 rounded-lg shadow-2xl overflow-hidden">
      <div class="p-5 space-y-4">
        <div class="flex items-start gap-3">
          <span class="material-symbols-outlined text-xl text-amber-400 mt-0.5">warning</span>
          <div class="space-y-1">
            <h3 id="confirm-title" class="text-sm font-semibold text-white">Replace main file?</h3>
            <p class="text-xs text-white/50 leading-relaxed">
              This will replace the entire content of <span class="font-mono text-white/70">{ideState.mainFileName}</span> with
              <span class="font-mono text-white/70">{pendingMainImport?.name}</span>. This action cannot be undone.
            </p>
          </div>
        </div>
        <div class="flex gap-2 justify-end pt-2">
          <button
            class="px-4 py-1.5 text-xs font-medium text-white/60 hover:text-white bg-white/5 hover:bg-white/10 rounded transition-colors"
            onclick={cancelReplaceMain}
          >
            Cancel
          </button>
          <button
            class="px-4 py-1.5 text-xs font-medium text-amber-400 bg-amber-400/10 hover:bg-amber-400/20 rounded transition-colors"
            onclick={confirmReplaceMain}
          >
            Replace
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .custom-scrollbar::-webkit-scrollbar {
    width: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.02);
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(255, 211, 0, 0.2);
    border-radius: 2px;
  }
</style>
