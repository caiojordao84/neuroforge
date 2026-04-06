Run cargo clippy -p neuroforge-asl -p neuroforge-transport -p neuroforge-firmware -- -D warnings
warning: profiles for the non root package will be ignored, specify profiles at the workspace root:
package:   /home/runner/work/neuroforge/neuroforge/apps/desktop/src-tauri/Cargo.toml
workspace: /home/runner/work/neuroforge/neuroforge/Cargo.toml
warning: profiles for the non root package will be ignored, specify profiles at the workspace root:
package:   /home/runner/work/neuroforge/neuroforge/apps/mobile/src-tauri/Cargo.toml
workspace: /home/runner/work/neuroforge/neuroforge/Cargo.toml
    Checking neuroforge-transport v0.1.0 (/home/runner/work/neuroforge/neuroforge/crates/neuroforge-transport)
    Checking neuroforge-firmware v0.1.0 (/home/runner/work/neuroforge/neuroforge/crates/neuroforge-firmware)
    Checking neuroforge-asl v4.0.0 (/home/runner/work/neuroforge/neuroforge/crates/neuroforge-asl)
warning: multiple lines skipped by escaped newline
   --> crates/neuroforge-asl/src/plugins/plc/ld/generator.rs:135:85
    |
135 |               "            <leftPowerRail localId=\"{}\" height=\"20\" width=\"10\">\n\
    |  _____________________________________________________________________________________^
136 | |
137 | |                <position x=\"0\" y=\"{}\"/>\n\
    | |_______________^ skipping everything up to and including this point

warning: multiple lines skipped by escaped newline
   --> crates/neuroforge-asl/src/plugins/plc/ld/generator.rs:137:46
    |
137 |                  <position x=\"0\" y=\"{}\"/>\n\
    |  ______________________________________________^
138 | |
139 | |                <connectionPointOut formalParameter=\"\"/>\n\
    | |_______________^ skipping everything up to and including this point

warning: multiple lines skipped by escaped newline
   --> crates/neuroforge-asl/src/plugins/plc/ld/generator.rs:139:60
    |
139 |                  <connectionPointOut formalParameter=\"\"/>\n\
    |  ____________________________________________________________^
140 | |
141 | |              </leftPowerRail>\n",
    | |_____________^ skipping everything up to and including this point

warning: multiple lines skipped by escaped newline
   --> crates/neuroforge-asl/src/plugins/plc/ld/generator.rs:230:94
    |
230 |               "            <contact localId=\"{}\" height=\"20\" width=\"20\" negated=\"{}\">\n\
    |  ______________________________________________________________________________________________^
231 | |
232 | |                <position x=\"{}\" y=\"{}\"/>\n\
    | |_______________^ skipping everything up to and including this point

warning: multiple lines skipped by escaped newline
   --> crates/neuroforge-asl/src/plugins/plc/ld/generator.rs:232:47
    |
232 |                  <position x=\"{}\" y=\"{}\"/>\n\
    |  _______________________________________________^
233 | |
234 | |                <connectionPointIn>\n\
    | |_______________^ skipping everything up to and including this point

warning: multiple lines skipped by escaped newline
   --> crates/neuroforge-asl/src/plugins/plc/ld/generator.rs:234:37
    |
234 |                  <connectionPointIn>\n\
    |  _____________________________________^
235 | |
236 | |                  <relPosition x=\"0\" y=\"10\"/>\n\
    | |_________________^ skipping everything up to and including this point

warning: multiple lines skipped by escaped newline
   --> crates/neuroforge-asl/src/plugins/plc/ld/generator.rs:236:51
    |
236 |                    <relPosition x=\"0\" y=\"10\"/>\n\
    |  ___________________________________________________^
237 | |
238 | |                  <connection refLocalId=\"{}\"/>\n\
    | |_________________^ skipping everything up to and including this point

warning: multiple lines skipped by escaped newline
   --> crates/neuroforge-asl/src/plugins/plc/ld/generator.rs:238:51
    |
238 |                    <connection refLocalId=\"{}\"/>\n\
    |  ___________________________________________________^
239 | |
240 | |                </connectionPointIn>\n\
    | |_______________^ skipping everything up to and including this point

warning: multiple lines skipped by escaped newline
   --> crates/neuroforge-asl/src/plugins/plc/ld/generator.rs:240:38
    |
240 |                  </connectionPointIn>\n\
    |  ______________________________________^
241 | |
242 | |                <connectionPointOut formalParameter=\"\"/>\n\
    | |_______________^ skipping everything up to and including this point

warning: multiple lines skipped by escaped newline
   --> crates/neuroforge-asl/src/plugins/plc/ld/generator.rs:242:60
    |
242 |                  <connectionPointOut formalParameter=\"\"/>\n\
    |  ____________________________________________________________^
243 | |
244 | |                <variable>{}</variable>\n\
    | |_______________^ skipping everything up to and including this point

warning: multiple lines skipped by escaped newline
   --> crates/neuroforge-asl/src/plugins/plc/ld/generator.rs:244:41
    |
244 |                  <variable>{}</variable>\n\
    |  _________________________________________^
245 | |
246 | |              </contact>\n",
    | |_____________^ skipping everything up to and including this point

warning: multiple lines skipped by escaped newline
   --> crates/neuroforge-asl/src/plugins/plc/ld/generator.rs:266:76
    |
266 |               "            <coil localId=\"{}\" height=\"20\" width=\"20\">\n\
    |  ____________________________________________________________________________^
267 | |
268 | |                <position x=\"{}\" y=\"{}\"/>\n\
    | |_______________^ skipping everything up to and including this point

warning: multiple lines skipped by escaped newline
   --> crates/neuroforge-asl/src/plugins/plc/ld/generator.rs:268:47
    |
268 |                  <position x=\"{}\" y=\"{}\"/>\n\
    |  _______________________________________________^
269 | |
270 | |                <connectionPointIn>\n\
    | |_______________^ skipping everything up to and including this point

warning: multiple lines skipped by escaped newline
   --> crates/neuroforge-asl/src/plugins/plc/ld/generator.rs:270:37
    |
270 |                  <connectionPointIn>\n\
    |  _____________________________________^
271 | |
272 | |                  <relPosition x=\"0\" y=\"10\"/>\n",
    | |_________________^ skipping everything up to and including this point

warning: multiple lines skipped by escaped newline
   --> crates/neuroforge-asl/src/plugins/plc/ld/generator.rs:284:51
    |
284 |               "               </connectionPointIn>\n\
    |  ___________________________________________________^
285 | |
286 | |                <connectionPointOut formalParameter=\"\"/>\n\
    | |_______________^ skipping everything up to and including this point

warning: multiple lines skipped by escaped newline
   --> crates/neuroforge-asl/src/plugins/plc/ld/generator.rs:286:60
    |
286 |                  <connectionPointOut formalParameter=\"\"/>\n\
    |  ____________________________________________________________^
287 | |
288 | |                <variable>{}</variable>\n\
    | |_______________^ skipping everything up to and including this point

warning: multiple lines skipped by escaped newline
   --> crates/neuroforge-asl/src/plugins/plc/ld/generator.rs:288:41
    |
288 |                  <variable>{}</variable>\n\
    |  _________________________________________^
289 | |
290 | |              </coil>\n",
    | |_____________^ skipping everything up to and including this point

warning: multiple lines skipped by escaped newline
   --> crates/neuroforge-asl/src/plugins/plc/fbd/generator.rs:306:82
    |
306 |               "            <inVariable localId=\"{}\" height=\"20\" width=\"60\">\n\
    |  __________________________________________________________________________________^
307 | |
308 | |                            <position x=\"{}\" y=\"{}\"/>\n\
    | |___________________________^ skipping everything up to and including this point

warning: multiple lines skipped by escaped newline
   --> crates/neuroforge-asl/src/plugins/plc/fbd/generator.rs:308:59
    |
308 |   ...                   <position x=\"{}\" y=\"{}\"/>\n\
    |  ______________________________________________________^
309 | | ...
310 | | ...                   <connectionPointOut formalParameter=\"\"/>\n\
    | |______________________^ skipping everything up to and including this point

warning: multiple lines skipped by escaped newline
   --> crates/neuroforge-asl/src/plugins/plc/fbd/generator.rs:310:72
    |
310 |   ...                   <connectionPointOut formalParameter=\"\"/>\n\
    |  ___________________________________________________________________^
311 | | ...
312 | | ...                   <expression>{}</expression>\n\
    | |______________________^ skipping everything up to and including this point

warning: multiple lines skipped by escaped newline
   --> crates/neuroforge-asl/src/plugins/plc/fbd/generator.rs:312:57
    |
312 |                              <expression>{}</expression>\n\
    |  _________________________________________________________^
313 | |
314 | |                          </inVariable>\n",
    | |_________________________^ skipping everything up to and including this point

warning: multiple lines skipped by escaped newline
   --> crates/neuroforge-asl/src/plugins/plc/fbd/generator.rs:339:83
    |
339 |               "            <outVariable localId=\"{}\" height=\"20\" width=\"60\">\n\
    |  ___________________________________________________________________________________^
340 | |
341 | |                            <position x=\"{}\" y=\"{}\"/>\n\
    | |___________________________^ skipping everything up to and including this point

warning: multiple lines skipped by escaped newline
   --> crates/neuroforge-asl/src/plugins/plc/fbd/generator.rs:341:59
    |
341 |   ...                   <position x=\"{}\" y=\"{}\"/>\n\
    |  ______________________________________________________^
342 | | ...
343 | | ...                   <connectionPointIn>\n\
    | |______________________^ skipping everything up to and including this point

warning: multiple lines skipped by escaped newline
   --> crates/neuroforge-asl/src/plugins/plc/fbd/generator.rs:343:49
    |
343 |                              <connectionPointIn>\n\
    |  _________________________________________________^
344 | |
345 | |                  <relPosition x=\"0\" y=\"10\"/>\n\
    | |_________________^ skipping everything up to and including this point

warning: multiple lines skipped by escaped newline
   --> crates/neuroforge-asl/src/plugins/plc/fbd/generator.rs:345:51
    |
345 |                    <relPosition x=\"0\" y=\"10\"/>\n\
    |  ___________________________________________________^
346 | |
347 | |                  <connection refLocalId=\"{}\"/>\n\
    | |_________________^ skipping everything up to and including this point

warning: multiple lines skipped by escaped newline
   --> crates/neuroforge-asl/src/plugins/plc/fbd/generator.rs:347:51
    |
347 |                    <connection refLocalId=\"{}\"/>\n\
    |  ___________________________________________________^
348 | |
349 | |                </connectionPointIn>\n\
    | |_______________^ skipping everything up to and including this point
    |  _______________________________________________________^
410 | |
411 | |                      <connection refLocalId=\"{}\"/>\n\
    | |_____________________^ skipping everything up to and including this point

warning: multiple lines skipped by escaped newline
   --> crates/neuroforge-asl/src/plugins/plc/fbd/generator.rs:411:55
    |
411 |                        <connection refLocalId=\"{}\"/>\n\
    |  _______________________________________________________^
412 | |
413 | |                    </connectionPointIn>\n\
    | |___________________^ skipping everything up to and including this point

warning: multiple lines skipped by escaped newline
   --> crates/neuroforge-asl/src/plugins/plc/fbd/generator.rs:413:42
    |
413 |                      </connectionPointIn>\n\
    |  __________________________________________^
414 | |
415 | |                  </variable>\n",
    | |_________________^ skipping everything up to and including this point

warning: multiple lines skipped by escaped newline
   --> crates/neuroforge-asl/src/plugins/plc/fbd/generator.rs:432:69
    |
432 |                   "                <variable formalParameter=\"{}\">\n\
    |  _____________________________________________________________________^
433 | |
434 | |                    <connectionPointOut formalParameter=\"{}\"/>\n\
    | |___________________^ skipping everything up to and including this point

warning: multiple lines skipped by escaped newline
   --> crates/neuroforge-asl/src/plugins/plc/fbd/generator.rs:434:66
    |
434 |                      <connectionPointOut formalParameter=\"{}\"/>\n\
    |  __________________________________________________________________^
435 | |
436 | |                  </variable>\n",
    | |_________________^ skipping everything up to and including this point

warning: `neuroforge-asl` (lib) generated 36 warnings
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 6.01s
	
	
Run pnpm --filter @neuroforge/shared svelte-check

> @neuroforge/shared@0.1.0 svelte-check /home/runner/work/neuroforge/neuroforge/apps/shared
> svelte-check

Loading svelte-check in workspace: /home/runner/work/neuroforge/neuroforge/apps/shared
Getting Svelte diagnostics...

/home/runner/work/neuroforge/neuroforge/apps/shared/src/components/CodeEditor.svelte:5:32
Error: Cannot find module 'monaco-editor' or its corresponding type declarations. (ts)
  import loader from '@monaco-editor/loader';
  import type * as Monaco from 'monaco-editor';

/home/runner/work/neuroforge/neuroforge/apps/shared/src/components/CodeEditorWithTabs.svelte:3:32
Error: Cannot find module 'monaco-editor' or its corresponding type declarations. (ts)
  import loader from '@monaco-editor/loader';
  import type * as Monaco from 'monaco-editor';

/home/runner/work/neuroforge/neuroforge/apps/shared/src/state/asl.svelte.ts:1:33
Error: Cannot find module '../lib/wasm/neuroforge_asl.js' or its corresponding type declarations. 
type WasmModule = typeof import('../lib/wasm/neuroforge_asl.js');

/home/runner/work/neuroforge/neuroforge/apps/shared/src/components/ui/neuroforge/desktop/FileImportDialog.svelte:60:3
Warn: `<div>` with a click handler must have an ARIA role
https://svelte.dev/e/a11y_no_static_element_interactions (svelte)
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div
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
            <label class="block text-[10px] uppercase tracking-wider text-white/40 font-semibold">
              File name (with extension)
            </label>
            <input
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
            <label class="block text-[10px] uppercase tracking-wider text-white/40 font-semibold">
              Raw GitHub URL
            </label>
            <input
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
            <label class="block text-[10px] uppercase tracking-wider text-white/40 font-semibold">
              Select file(s) from your computer
            </label>
            <input
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

/home/runner/work/neuroforge/neuroforge/apps/shared/src/components/ui/neuroforge/desktop/FileImportDialog.svelte:106:13
Warn: A form label must be associated with a control
https://svelte.dev/e/a11y_label_has_associated_control (svelte)
          <div class="space-y-3">
            <label class="block text-[10px] uppercase tracking-wider text-white/40 font-semibold">
              File name (with extension)
            </label>
            <input

/home/runner/work/neuroforge/neuroforge/apps/shared/src/components/ui/neuroforge/desktop/FileImportDialog.svelte:127:13
Warn: A form label must be associated with a control
https://svelte.dev/e/a11y_label_has_associated_control (svelte)
          <div class="space-y-3">
            <label class="block text-[10px] uppercase tracking-wider text-white/40 font-semibold">
              Raw GitHub URL
            </label>
            <input

/home/runner/work/neuroforge/neuroforge/apps/shared/src/components/ui/neuroforge/desktop/FileImportDialog.svelte:148:13
Warn: A form label must be associated with a control
https://svelte.dev/e/a11y_label_has_associated_control (svelte)
          <div class="space-y-3">
            <label class="block text-[10px] uppercase tracking-wider text-white/40 font-semibold">
              Select file(s) from your computer
            </label>
            <input

/home/runner/work/neuroforge/neuroforge/apps/shared/src/components/ui/neuroforge/desktop/CodePanel.svelte:158:13
Warn: `<div>` with a click handler must have an ARIA role
https://svelte.dev/e/a11y_no_static_element_interactions (svelte)
            <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
            <div
              class="absolute top-10 left-0 w-44 glass-panel shadow-2xl z-50 py-1 bg-[#131221] border border-white/10 rounded"
              onclick={(e: Event) => e.stopPropagation()}
            >
              <button
                class="w-full text-left px-3 py-1.5 text-[10px] text-on-surface-variant hover:bg-primary-container/20 hover:text-primary-container transition-colors flex items-center gap-2"
                onclick={openMainImportDialog}
              >
                <span class="material-symbols-outlined text-xs">upload</span>
                Import / Open File
              </button>
            </div>
          {/if}

/home/runner/work/neuroforge/neuroforge/apps/shared/src/components/ui/neuroforge/desktop/CodePanel.svelte:208:13
Warn: `<div>` with a click handler must have an ARIA role
https://svelte.dev/e/a11y_no_static_element_interactions (svelte)
            <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
            <div
              class="absolute top-10 left-0 w-52 glass-panel shadow-2xl z-50 bg-[#131221] border border-white/10 rounded overflow-hidden"
              onclick={(e: Event) => e.stopPropagation()}
            >
              <!-- Existing libraries -->
              {#each library.libraries as lib (lib.id)}
                <div class="flex items-center group">
                  <button
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
                class="w-full text-left px-3 py-2 text-[10px] font-medium text-primary-container/60 hover:text-primary-container hover:bg-primary-container/10 transition-colors flex items-center gap-1.5 border-t border-white/5"
                onclick={openLibraryImportDialog}
              >
                <span class="material-symbols-outlined text-xs">add</span>
                Add library
              </button>
            </div>
          {/if}

/home/runner/work/neuroforge/neuroforge/apps/shared/src/components/ui/neuroforge/desktop/CodePanel.svelte:261:11
Warn: `<div>` with a click handler must have an ARIA role
https://svelte.dev/e/a11y_no_static_element_interactions (svelte)
          <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
          <div
            class="absolute top-10 right-0 w-40 glass-panel shadow-2xl z-50 py-1 bg-[#131221] border border-white/10 rounded"
            onclick={(e: Event) => e.stopPropagation()}
          >
            {#each ideState.availableLanguages as lang}
              <button
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

/home/runner/work/neuroforge/neuroforge/apps/shared/src/components/ui/neuroforge/desktop/CodePanel.svelte:354:3
Warn: `<div>` with a click handler must have an ARIA role
https://svelte.dev/e/a11y_no_static_element_interactions (svelte)
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm"
    onclick={(e: MouseEvent) => { if (e.target === e.currentTarget) cancelReplaceMain(); }}
  >
    <div class="w-[340px] bg-[#131221] border border-white/10 rounded-lg shadow-2xl overflow-hidden">
      <div class="p-5 space-y-4">
        <div class="flex items-start gap-3">
          <span class="material-symbols-outlined text-xl text-amber-400 mt-0.5">warning</span>
          <div class="space-y-1">
            <h3 class="text-sm font-semibold text-white">Replace main file?</h3>
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

/home/runner/work/neuroforge/neuroforge/apps/shared/src/lib/ledCalculations.ts:14:36
Error: Cannot find module '@/stores/useSimulationStore' or its corresponding type declarations. 
 * */
import { useSimulationStore } from '@/stores/useSimulationStore';
const state = useSimulationStore.getState();

/home/runner/work/neuroforge/neuroforge/apps/shared/src/components/ui/neuroforge/simulation/nodes/MCUNode.svelte:19:19
Warn: This reference only captures the initial value of `data`. Did you mean to reference it inside a closure instead?
https://svelte.dev/e/state_referenced_locally (svelte)

  const mcuType = data.mcuType || 'arduino-uno';
  const label = data.label || 'Arduino Uno R3';

/home/runner/work/neuroforge/neuroforge/apps/shared/src/components/ui/neuroforge/simulation/nodes/MCUNode.svelte:20:17
Warn: This reference only captures the initial value of `data`. Did you mean to reference it inside a closure instead?
https://svelte.dev/e/state_referenced_locally (svelte)
  const mcuType = data.mcuType || 'arduino-uno';
  const label = data.label || 'Arduino Uno R3';
  const rotation = data.rotation || 0;

/home/runner/work/neuroforge/neuroforge/apps/shared/src/components/ui/neuroforge/simulation/nodes/MCUNode.svelte:21:20
Warn: This reference only captures the initial value of `data`. Did you mean to reference it inside a closure instead?
https://svelte.dev/e/state_referenced_locally (svelte)
  const label = data.label || 'Arduino Uno R3';
  const rotation = data.rotation || 0;

/home/runner/work/neuroforge/neuroforge/apps/shared/src/components/ui/neuroforge/simulation/nodes/MCUNode.svelte:3:23
Error: Cannot find module '../../../../state/asl.svelte.js' or its corresponding type declarations. (ts)
  import { Handle, Position } from '@xyflow/svelte';
  import { asl } from '../../../../state/asl.svelte.js';
  import { cn } from '../../../../../lib/utils';

/home/runner/work/neuroforge/neuroforge/apps/shared/src/components/ui/neuroforge/simulation/nodes/MCUNode.svelte:4:22
Error: Cannot find module '../../../../../lib/utils' or its corresponding type declarations. (ts)
  import { asl } from '../../../../state/asl.svelte.js';
  import { cn } from '../../../../../lib/utils';

/home/runner/work/neuroforge/neuroforge/apps/shared/src/components/ui/neuroforge/simulation/nodes/MCUNode.svelte:17:47
Error: Expected 0 type arguments, but got 1. (ts)

  let { id, data, selected = false } = $props<Props>();

====================================
svelte-check found 7 errors and 11 warnings in 7 files
/home/runner/work/neuroforge/neuroforge/apps/shared:
 ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL  @neuroforge/shared@0.1.0 svelte-check: `svelte-check`
Exit status 1
Error: Process completed with exit code 1.

Run cd crates/neuroforge-asl
/home/runner/work/_temp/bcc0d190-5179-4fc5-916c-6f4f00ef5fd1.sh: line 3: --out-dir: command not found
[INFO]: 🎯  Checking for the Wasm target...
[INFO]: 🌀  Compiling to Wasm...
warning: profiles for the non root package will be ignored, specify profiles at the workspace root:
package:   /home/runner/work/neuroforge/neuroforge/apps/desktop/src-tauri/Cargo.toml
workspace: /home/runner/work/neuroforge/neuroforge/Cargo.toml
warning: profiles for the non root package will be ignored, specify profiles at the workspace root:
package:   /home/runner/work/neuroforge/neuroforge/apps/mobile/src-tauri/Cargo.toml
workspace: /home/runner/work/neuroforge/neuroforge/Cargo.toml
   Compiling proc-macro2 v1.0.106
   Compiling unicode-ident v1.0.24
   Compiling find-msvc-tools v0.1.9
   Compiling quote v1.0.45
   Compiling shlex v1.3.0
   Compiling tree-sitter-language v0.1.7
   Compiling cc v1.2.57
   Compiling wasm-bindgen-shared v0.2.114
   Compiling serde_core v1.0.228
   Compiling rustversion v1.0.22
   Compiling zmij v1.0.21
   Compiling syn v2.0.117
   Compiling memchr v2.8.0
   Compiling serde v1.0.228
   Compiling bumpalo v3.20.2
   Compiling wasm-bindgen v0.2.114
   Compiling autocfg v1.5.0
   Compiling num-traits v0.2.19
   Compiling cfg-if v1.0.4
   Compiling once_cell v1.21.4
   Compiling equivalent v1.0.2
   Compiling hashbrown v0.16.1
   Compiling thiserror v1.0.69
   Compiling serde_json v1.0.149
   Compiling indexmap v2.13.0
   Compiling itoa v1.0.17
   Compiling ucd-trie v0.1.7
   Compiling wasm-bindgen-macro-support v0.2.114
   Compiling pest v2.8.6
   Compiling aho-corasick v1.1.4
   Compiling serde_derive v1.0.228
   Compiling thiserror-impl v1.0.69
   Compiling wasm-bindgen-macro v0.2.114
   Compiling regex-syntax v0.8.10
   Compiling tree-sitter v0.26.7
   Compiling pest_meta v2.8.6
   Compiling js-sys v0.3.91
   Compiling regex-automata v0.4.14
   Compiling num-integer v0.1.46
   Compiling tree-sitter-cpp v0.23.4
   Compiling tree-sitter-python v0.25.0
   Compiling tree-sitter-arduino v0.24.0
   Compiling tree-sitter-xml v0.7.0
   Compiling tree-sitter-rust v0.24.0
   Compiling tree-sitter-c v0.24.1
   Compiling anyhow v1.0.102
   Compiling regex v1.12.3
warning: tree-sitter-c@0.24.1: Compiler family detection failed due to error: ToolNotFound: failed to find tool "C:/wasi-sdk/bin/clang.exe": No such file or directory (os error 2)
error: failed to run custom build command for `tree-sitter-c v0.24.1`

Caused by:
  process didn't exit successfully: `/home/runner/work/neuroforge/neuroforge/target/release/build/tree-sitter-c-da2896ea02b5e40e/build-script-build` (exit status: 1)
  --- stdout
  cargo:rerun-if-changed=src/parser.c
  cargo:rerun-if-env-changed=CC_FORCE_DISABLE
  CC_FORCE_DISABLE = None
  cargo:rerun-if-env-changed=CC_wasm32-unknown-unknown
  CC_wasm32-unknown-unknown = None
  cargo:rerun-if-env-changed=CC_wasm32_unknown_unknown
  CC_wasm32_unknown_unknown = Some(C:/wasi-sdk/bin/clang.exe)
  cargo:rerun-if-env-changed=CC_KNOWN_WRAPPER_CUSTOM
  CC_KNOWN_WRAPPER_CUSTOM = None
  cargo:rerun-if-env-changed=CC_ENABLE_DEBUG_OUTPUT
  cargo:warning=Compiler family detection failed due to error: ToolNotFound: failed to find tool "C:/wasi-sdk/bin/clang.exe": No such file or directory (os error 2)
  cargo:rerun-if-env-changed=CRATE_CC_NO_DEFAULTS
  CRATE_CC_NO_DEFAULTS = None
  cargo:rerun-if-env-changed=CFLAGS
  CFLAGS = None
  cargo:rerun-if-env-changed=TARGET_CFLAGS
  TARGET_CFLAGS = None
  cargo:rerun-if-env-changed=CFLAGS_wasm32_unknown_unknown
  CFLAGS_wasm32_unknown_unknown = Some(--sysroot=C:/wasi-sdk/share/wasi-sysroot -fPIC)
  cargo:rerun-if-env-changed=CC_SHELL_ESCAPED_FLAGS
  CC_SHELL_ESCAPED_FLAGS = None
  cargo:rerun-if-env-changed=CFLAGS_wasm32-unknown-unknown
  CFLAGS_wasm32-unknown-unknown = None

  --- stderr


  error occurred in cc-rs: failed to find tool "C:/wasi-sdk/bin/clang.exe": No such file or directory (os error 2)


warning: build failed, waiting for other jobs to finish...
Error: `cargo build` failed, see the output above for details
Caused by: `cargo build` failed, see the output above for details
Error: Process completed with exit code 1.