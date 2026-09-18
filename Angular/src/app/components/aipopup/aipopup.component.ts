import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild,
  NgZone,
  inject
} from '@angular/core';
import {
  createSpinner,
  showSpinner,
  hideSpinner
} from '@syncfusion/ej2-popups';
import { Button } from '@syncfusion/ej2-buttons';
import { Dialog } from '@syncfusion/ej2-popups';
import { ContextMenu, MenuEventArgs } from '@syncfusion/ej2-navigations';
import { TextBox } from '@syncfusion/ej2-inputs';
import { ComboBox, MultiSelect, CheckBoxSelection } from '@syncfusion/ej2-dropdowns';
import { DropDownButton } from '@syncfusion/ej2-splitbuttons';
import { Splitter } from '@syncfusion/ej2-layouts';
import { Fab } from '@syncfusion/ej2-buttons';
import { L10n } from '@syncfusion/ej2-base';
import { AiModelsService } from '../../services/ai-models.service';

MultiSelect.Inject(CheckBoxSelection);

const GrammarOptions = [
  { Name: 'Subject-Verb Agreement' }, { Name: 'Tense Consistency' }, { Name: 'Pronoun Agreement' },
  { Name: 'Comma Usage' }, { Name: 'Parallel Structure' }, { Name: 'Misplaced Modifiers' },
  { Name: 'Dangling Modifiers' }, { Name: 'Word Choice' }, { Name: 'Redundancy' },
  { Name: 'Use of Articles' }, { Name: 'Punctuation Marks' }, { Name: 'Apostrophes for Possessives and Contractions' },
  { Name: 'Spelling Errors' }
];

const TranslateList = ['English', 'Simplified Chinese', 'Spanish', 'French', 'Arabic', 'Portuguese', 'Russian', 'Urdu', 'Indonesian', 'German', 'Japanese'];

const AiTask = { Generate: 'Generate', Rephrase: 'Rephrase', Translate: 'Translate', Grammar: 'Grammar' };

@Component({
  selector: 'app-aipopup',
  template: `
    <div id="ai-assist" #host>
      <div id="ai-assist-menu-anchor" style="position: fixed;"></div>
      <div id="ai-settings-menu-anchor" style="position: fixed;"></div>
      <!-- Syncfusion widgets are created imperatively inside #host -->
    </div>
  `,
  styles: [`:host { display: contents; }`]
})
export class AIPopupComponent implements OnInit, OnChanges, OnDestroy {
  @Input() editorRef: any;
  @Input() isAIEnabled = false;
  @Input() chatOpen = false;
  @Output() showChatPane = new EventEmitter<void>();

  @ViewChild('host', { static: true }) hostRef!: ElementRef<HTMLElement>;

  private ai = inject(AiModelsService);
  private zone = inject(NgZone);

  // state
  isSmartEditor = false;
  popupType = '';
  tone = 'Professional';
  format = 'Paragraph';
  length = 'Medium';
  translateTo = 'French';
  checks: string[] = [];
  isLoading = false;
  outHtml = '';
  inHtml = '';
  suggestions: string[] = [];
  currentIndex = 0;
  userPrompt = '';
  dialogPos = { x: '200', y: '160' };
  draftRange: { start: any, end: any } = { start: null, end: null };
  stopVisible = false;
  stopPos = { x: 0, y: 0 };
  canceled = false;
  genVisible = false;
  smartVisible = false;
  fabChatVisible = false;
  aiResults: string[] = [];
  /** When the smart-editor task is launched from the editor's native context
   *  menu, the editor selection may be cleared by the time the zone-deferred
   *  runTask body executes. This holds the HTML captured at click time so
   *  runTask uses it instead of re-reading a possibly-empty selection. */
  private capturedSelectionHtml: string | null = null;
  /** Remembers the source text of the current smart-editor task so that
   *  re-runs (Translate language change, Regenerate) — which occur after the
   *  editor selection has been lost to the open dialog — can reuse it instead
   *  of reading an empty selection and bailing out. */
  private lastSourceText: string | null = null;

  // widget references
  private chatFab!: Fab;
  private genDialog!: Dialog;
  private smartDialog!: Dialog;
  private stopDialog!: Dialog;
  private assistMenu!: ContextMenu;
  private settingsMenu!: ContextMenu;
  private settingsBtn!: DropDownButton;
  private gearHeaderBtn!: DropDownButton;
  private textbox!: TextBox;
  private translateComboBox!: ComboBox;
  private grammarMultiSelect!: MultiSelect;
  private assistMenuHost!: HTMLElement;

  // bound handlers
  private onOutsidePress?: (e: Event) => void;

  get isContentGenerated(): boolean {
    return this.popupType === AiTask.Generate && !this.isSmartEditor && !!this.outHtml;
  }

  ngOnInit(): void {
    this.buildWidgets();
    createSpinner({ target: this.hostRef.nativeElement.querySelector('#spinner-container') as HTMLElement });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isAIEnabled']) {
      // The assist FAB has been removed; Rephrase/Translate/Grammar now live
      // in the editor's native context menu (installEditorContextMenu). The
      // chat FAB stays hidden from this sample.
      this.fabChatVisible = false;
      if (this.chatFab) {
        this.chatFab.visible = this.fabChatVisible;
      }
    }
    if (changes['chatOpen'] && this.chatFab) {
      // Chat FAB is hidden from the sample — keep it always invisible.
      this.fabChatVisible = false;
      this.chatFab.visible = false;
    }
    // When editorRef resolves, install our Rephrase/Translate/Grammar items
    // into the Document Editor's native context menu. This is the
    // page-agnostic replacement for the old cursor-following assist FAB.
    if (changes['editorRef']) {
      setTimeout(() => this.installEditorContextMenu(), 0);
    }
  }

  ngOnDestroy(): void {
    [this.chatFab, this.genDialog, this.smartDialog, this.stopDialog,
     this.assistMenu, this.settingsMenu, this.settingsBtn, this.gearHeaderBtn,
     this.textbox, this.translateComboBox, this.grammarMultiSelect].forEach(w => { try { w?.destroy?.(); } catch {} });
    if (this.assistMenuHost?.parentNode) this.assistMenuHost.parentNode.removeChild(this.assistMenuHost);
    if (this.onOutsidePress) {
      document.removeEventListener('pointerdown', this.onOutsidePress, true);
      document.removeEventListener('mousedown', this.onOutsidePress, true);
    }
  }

  // ---------- widget construction ----------
  private buildWidgets(): void {
    const host = this.hostRef.nativeElement;

    // The assist FAB (cursor-following "Generate" button) has been removed.
    // Rephrase / Translate / Grammar are now offered through the Document
    // Editor's native context menu (see installEditorContextMenu), which
    // works on every page. The chat FAB below remains for Q&A / summaries.

    // chat FAB
    const fabChatEl = document.createElement('button');
    fabChatEl.id = 'ai-chat-fab';
    host.appendChild(fabChatEl);
    this.chatFab = new Fab({
      cssClass: 'ai-chat-btn',
      iconCss: 'e-icons e-ai-chat-btn',
      visible: this.fabChatVisible,
      created: () => this.zone.run(() => this.onChatFabCreated()),
      click: () => this.zone.run(() => this.openChat())
    } as any);
    this.chatFab.appendTo(fabChatEl);
    fabChatEl.title = 'Summarization and Q&A';
    fabChatEl.addEventListener('click', () => this.zone.run(() => this.openChat()));

    // generate dialog
    const genDiv = document.createElement('div');
    host.appendChild(genDiv);
    this.genDialog = new Dialog({
      visible: this.genVisible,
      target: host,
      showCloseIcon: false,
      isModal: false,
      width: '45%',
      position: { X: this.dialogPos.x, Y: this.dialogPos.y },
      cssClass: 'ai-generate-dialog ai-assist-dialog',
      beforeOpen: (args: any) => this.generateContentOpen(args),
      content: this.getGenerateContentHtml()
    } as any);
    this.genDialog.appendTo(genDiv);
    this.buildGenerateInputs();

    // smart editor dialog
    const smartDiv = document.createElement('div');
    host.appendChild(smartDiv);
    this.smartDialog = new Dialog({
      visible: this.smartVisible,
      target: host,
      showCloseIcon: true,
      isModal: true,
      width: '70%',
      cssClass: 'e-smart-editor-dialog',
      header: this.smartHeaderHtml(),
      content: this.getSmartContentHtml(),
      footerTemplate: this.smartFooterHtml(),
      close: () => this.zone.run(() => { this.smartVisible = false; this.lastSourceText = null; })
    } as any);
    this.smartDialog.appendTo(smartDiv);
    this.buildSmartPaneInputs();

    // stop dialog
    const stopDiv = document.createElement('div');
    host.appendChild(stopDiv);
    this.stopDialog = new Dialog({
      cssClass: 'e-stop-generating-dialog',
      target: host,
      visible: this.stopVisible,
      isModal: false,
      showCloseIcon: false,
      width: '30%',
      position: { X: String(this.stopPos.x), Y: String(this.stopPos.y) },
      content: `<div class="ai-stop-popup"><span class="stop-popup-text-icon e-icons"></span><span class="stop-popup-text">Generating a draft...</span></div>`
    } as any);
    this.stopDialog.appendTo(stopDiv);

    // assist context menu (Rephrase/Translate/Grammar)
    // React renders <ContextMenuComponent> inside #ai-assist which is in the
    // normal document flow.  In Angular we create it imperatively; attach to
    // document.body so the popup isn't clipped by position:fixed / e-hide
    // parents.  Use a <ul> element — Syncfusion ContextMenu expects a <ul>
    // host (its moverHandler reads element.id and li references that are null
    // when created on a <div>, causing the "Cannot read properties of null
    // (reading 'id')" error).
    const menuUl = document.createElement('ul');
    menuUl.id = 'ai-assist-context-menu';
    document.body.appendChild(menuUl);
    this.assistMenuHost = menuUl;
    this.assistMenu = new ContextMenu({
      cssClass: 'ai-smart-menu',
      items: [
        { text: 'Rephrase', iconCss: 'e-icons e-rephrase' },
        { text: 'Translate', iconCss: 'e-icons e-translate' },
        { text: 'Grammar', iconCss: 'e-icons e-grammar-check' }
      ],
      select: (args: MenuEventArgs) => this.zone.run(() => this.onMenuSelect(args))
    });
    this.assistMenu.appendTo(menuUl);

    // settings context menu
    // Use a <ul> host on document.body (same reason as the assist menu above
    // — Syncfusion ContextMenu expects <ul>, and body-level avoids clipping).
    const settingsMenuUl = document.createElement('ul');
    settingsMenuUl.id = 'ai-settings-context-menu';
    document.body.appendChild(settingsMenuUl);
    this.settingsMenu = new ContextMenu({
      cssClass: 'ai-settings-menu',
      items: this.settingsMenuItems(),
      fields: { text: 'text', id: 'id', children: 'items' } as any,
      beforeItemRender: (args: any) => this.onSettingsBeforeItemRender(args),
      select: (args: MenuEventArgs) => this.zone.run(() => this.onSettingsMenuSelect(args))
    } as any);
    this.settingsMenu.appendTo(settingsMenuUl);

    // spinner container inside host for the smart dialog
    const spinner = document.createElement('div');
    spinner.id = 'spinner-container';
    spinner.className = 'spinner-target';
    host.appendChild(spinner);
  }

  /** Resolve the spinner target that is currently visible — prefers the one
   *  inside the smart dialog (when the dialog is open) so the spinner
   *  actually appears over the dialog content, not on the hidden host. */
  private getActiveSpinner(): HTMLElement | null {
    const dlgEl = this.smartDialog?.element;
    const inDialog = dlgEl?.querySelector('#smart-spinner-container') as HTMLElement | null;
    if (inDialog && this.smartVisible) return inDialog;
    return document.getElementById('spinner-container');
  }

  private buildGenerateInputs(): void {
    const dlgEl = this.genDialog.element;
    const wrapper = dlgEl.querySelector('.ai-input-wrapper') as HTMLElement;
    if (!wrapper) return;
    const tbEl = document.createElement('input');
    tbEl.id = 'e-de-editableDiv';
    tbEl.type = 'text';
    wrapper.appendChild(tbEl);
    this.textbox = new TextBox({
      placeholder: 'Type a prompt',
      cssClass: 'ai-input-box',
      value: this.userPrompt,
      created: () => this.textBoxCreated(),
      input: (e: any) => this.zone.run(() => this.textboxValueChange(e)),
      focus: (args: any) => args.container?.classList.add('e-input-focus'),
      blur: (args: any) => args.container?.classList.remove('e-input-focus')
    });
    this.textbox.appendTo(tbEl);
    tbEl.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (this.userPrompt || '').trim()) {
        e.preventDefault();
        this.onSend();
      }
    });

    // settings gear dropdown
    const gearEl = document.createElement('button');
    gearEl.id = 'ai-assist-settings-btn';
    gearEl.className = 'e-caret-hide settings-btn';
    (wrapper.parentElement as HTMLElement).appendChild(gearEl);
    this.settingsBtn = new DropDownButton({
      iconCss: 'e-icons e-settings',
      cssClass: 'e-caret-hide settings-btn',
      items: [{ text: 'trigger' }],
      beforeOpen: (args: any) => { args.cancel = true; this.openGearMenu(); }
    });
    this.settingsBtn.appendTo(gearEl);
  }

  private buildSmartPaneInputs(): void {
    const dlgEl = this.smartDialog.element;
    const cbHost = dlgEl.querySelector('.smart-translate-combo') as HTMLElement;
    if (cbHost) {
      const cbEl = document.createElement('input');
      cbHost.appendChild(cbEl);
      this.translateComboBox = new ComboBox({
        dataSource: TranslateList,
        value: this.translateTo,
        width: '160px',
        placeholder: 'Translate to',
        popupHeight: '220px',
        showClearButton: false,
        change: (e: any) => this.zone.run(() => this.changeLanguage(e))
      });
      this.translateComboBox.appendTo(cbEl);
    }
    const msHost = dlgEl.querySelector('.smart-grammar-multiselect') as HTMLElement;
    if (msHost) {
      const msEl = document.createElement('input');
      msHost.appendChild(msEl);
      this.grammarMultiSelect = new MultiSelect({
        dataSource: GrammarOptions,
        fields: { text: 'Name', value: 'Name' } as any,
        value: this.checks,
        mode: 'CheckBox',
        showSelectAll: true,
        showDropDownIcon: true,
        allowFiltering: true,
        placeholder: 'e.g. Spelling Errors',
        width: '180px',
        popupHeight: '260px',
        change: (e: any) => this.zone.run(() => this.checks = e.value || [])
      } as any);
      this.grammarMultiSelect.appendTo(msEl);
    }
    // settings gear in header toolbar
    const gearHost = dlgEl.querySelector('.smart-header-gear') as HTMLElement;
    if (gearHost) {
      const g = document.createElement('button');
      g.id = 'ai-smart-settings-btn';
      g.className = 'e-caret-hide settings-btn';
      gearHost.appendChild(g);
      this.gearHeaderBtn = new DropDownButton({
        iconCss: 'e-icons e-settings',
        cssClass: 'e-caret-hide settings-btn',
        items: [{ text: 'trigger' }],
        beforeOpen: (args: any) => { args.cancel = true; this.openHeaderSettingsMenu(); }
      });
      this.gearHeaderBtn.appendTo(g);
    }
    // prev/next navigation
    const prevBtn = dlgEl.querySelector('.smart-prev-btn');
    const nextBtn = dlgEl.querySelector('.smart-next-btn');
    if (prevBtn) prevBtn.addEventListener('click', () => this.zone.run(() => this.prevSuggestion()));
    if (nextBtn) nextBtn.addEventListener('click', () => this.zone.run(() => this.nextSuggestion()));
    // Footer buttons (Replace / Regenerate / Cancel) are wired in
    // refreshSmartDialogContent() because the Dialog renders the footerTemplate
    // lazily — the footer DOM does not exist until the dialog is shown.
  }

  // ---------- HTML templates ----------
  private getGenerateContentHtml(): string {
    return `<div class="ai-dialog-body"><div class="ai-generate-content"><div class="e-de-parent gc-row ai-gc-row"><div class="ai-input-wrapper"></div></div></div></div>`;
  }

  private smartHeaderHtml(): string {
    return `<div class="e-custom-header"><div class="e-popup-header smart-header-text"></div><div class="e-header-toolbar smart-header-toolbar" style="display:none"></div></div>`;
  }

  private getSmartContentHtml(): string {
    return `<div class="ai-dialog-body"><div class="ai-splitter smart-splitter"><div class="pane-content"><div class="pane-content-header"><label class="translate-label smart-from-label"></label></div><div class="pane-text-area smart-in-html" style="height:280px;border:1px solid #ccc;padding:6px 10px;overflow-y:auto;"></div></div><div class="pane-content"><div class="pane-content-header"><label class="translate-label smart-to-label"></label><span class="smart-translate-combo" style="margin-left:8px"></span><span class="smart-grammar-multiselect" style="margin-left:8px"></span></div><div id="e-de-editableDiv" class="pane-text-area smart-out-html" style="height:280px;border:1px solid #ccc;padding:6px 10px;overflow-y:auto;"></div></div></div><div id="smart-spinner-container" class="spinner-target"></div></div>`;
  }

  private smartFooterHtml(): string {
    return `<div style="display:inline-flex"><button class="e-primary smart-replace-btn">Replace</button><button class="e-outline e-regenerate-btn smart-regenerate-btn" style="display:none">Regenerate</button><button class="smart-cancel-btn">Cancel</button></div>`;
  }

  private settingsMenuItems(): any[] {
    return [
      {
        id: 'parent-tone', text: 'Choose Tone', items: [
          { id: 'child-tone-professional', text: 'Professional' },
          { id: 'child-tone-friendly', text: 'Friendly' },
          { id: 'child-tone-instructional', text: 'Instructional' },
          { id: 'child-tone-marketing', text: 'Marketing' },
          { id: 'child-tone-academic', text: 'Academic' },
          { id: 'child-tone-legal', text: 'Legal' },
          { id: 'child-tone-technical', text: 'Technical' },
          { id: 'child-tone-narrative', text: 'Narrative' },
          { id: 'child-tone-direct', text: 'Direct' }
        ]
      },
      {
        id: 'parent-format', text: 'Choose Format', items: [
          { id: 'child-format-paragraph', text: 'Paragraph' },
          { id: 'child-format-blog-post', text: 'Blog post' },
          { id: 'child-format-technical-documentation', text: 'Technical Documentation' },
          { id: 'child-format-report', text: 'Report' },
          { id: 'child-format-research-papers', text: 'Research Papers' },
          { id: 'child-format-tutorial', text: 'Tutorial' },
          { id: 'child-format-meeting-notes', text: 'Meeting Notes' }
        ]
      },
      {
        id: 'parent-size', text: 'Choose Size', items: [
          { id: 'child-size-short', text: 'Short' },
          { id: 'child-size-medium', text: 'Medium' },
          { id: 'child-size-long', text: 'Long' }
        ]
      }
    ];
  }

  private get headerText(): string {
    if (this.popupType === AiTask.Rephrase) return 'Rephrased Content';
    if (this.popupType === AiTask.Translate) return 'Translate';
    if (this.popupType === AiTask.Grammar) return 'Grammar Check';
    return 'AI Assistant';
  }

  private refreshSmartDialogContent(): void {
    const dlgEl = this.smartDialog?.element;
    if (!dlgEl) return;
    const headerTextEl = dlgEl.querySelector('.smart-header-text') as HTMLElement;
    if (headerTextEl) headerTextEl.textContent = this.headerText;
    const toolbar = dlgEl.querySelector('.smart-header-toolbar') as HTMLElement;
    if (toolbar) toolbar.style.display = this.popupType === AiTask.Rephrase ? '' : 'none';
    if (toolbar && this.popupType === AiTask.Rephrase) {
      toolbar.innerHTML = `<button class="smart-prev-btn">‹</button><span class="page-count">${Math.min(this.currentIndex + 1, this.suggestions.length)} of ${Math.max(this.suggestions.length, 1)}</span><button class="smart-next-btn">›</button><span class="smart-header-gear"></span>`;
      const prevBtn = toolbar.querySelector('.smart-prev-btn') as HTMLElement;
      const nextBtn = toolbar.querySelector('.smart-next-btn') as HTMLElement;
      if (prevBtn) { (prevBtn as any).disabled = this.currentIndex <= 0; prevBtn.addEventListener('click', () => this.zone.run(() => this.prevSuggestion())); }
      if (nextBtn) { (nextBtn as any).disabled = this.currentIndex + 1 >= this.suggestions.length; nextBtn.addEventListener('click', () => this.zone.run(() => this.nextSuggestion())); }
      const gearHost = toolbar.querySelector('.smart-header-gear');
      if (gearHost && !gearHost.firstChild) {
        const g = document.createElement('button');
        g.className = 'e-caret-hide settings-btn';
        (gearHost as HTMLElement).appendChild(g);
        this.gearHeaderBtn = new DropDownButton({
          iconCss: 'e-icons e-settings',
          cssClass: 'e-caret-hide settings-btn',
          items: [{ text: 'trigger' }],
          beforeOpen: (args: any) => { args.cancel = true; this.openHeaderSettingsMenu(); }
        });
        this.gearHeaderBtn.appendTo(g);
      }
    }
    const fromLabel = dlgEl.querySelector('.smart-from-label') as HTMLElement;
    if (fromLabel) fromLabel.textContent = this.popupType === AiTask.Translate ? 'Translate from:' : 'From:';
    const toLabel = dlgEl.querySelector('.smart-to-label') as HTMLElement;
    if (toLabel) toLabel.textContent = this.popupType === AiTask.Translate ? 'Translate to:' : 'To:';
    const comboHost = dlgEl.querySelector('.smart-translate-combo') as HTMLElement;
    if (comboHost) (comboHost as HTMLElement).style.display = this.popupType === AiTask.Translate ? '' : 'none';
    const msHost = dlgEl.querySelector('.smart-grammar-multiselect') as HTMLElement;
    if (msHost) (msHost as HTMLElement).style.display = this.popupType === AiTask.Grammar ? '' : 'none';
    const regenBtn = dlgEl.querySelector('.smart-regenerate-btn') as HTMLElement;
    if (regenBtn) (regenBtn as HTMLElement).style.display = (this.popupType === AiTask.Rephrase || this.popupType === AiTask.Grammar) ? '' : 'none';
    const inEl = dlgEl.querySelector('.smart-in-html') as HTMLElement;
    if (inEl) inEl.innerHTML = this.inHtml;
    const outEl = dlgEl.querySelector('.smart-out-html') as HTMLElement;
    if (outEl) outEl.innerHTML = this.outHtml;

    // Wire footer buttons here — the Dialog renders footerTemplate lazily, so
    // the footer DOM only exists after the dialog has been shown.  React wires
    // these via the smartFooterTemplate callback (which re-renders each time);
    // we re-wire here on every refresh to keep handlers bound to current state.
    // Also ensure the dialog-local spinner is initialized (Dialog renders its
    // content template lazily, so #smart-spinner-container only exists after
    // the dialog has been shown once).
    const smartSpinner = dlgEl.querySelector('#smart-spinner-container') as HTMLElement | null;
    if (smartSpinner && !smartSpinner.dataset.spinnerInit) {
      smartSpinner.dataset.spinnerInit = '1';
      try { createSpinner({ target: smartSpinner }); } catch {}
    }
    this.wireSmartFooterButtons(dlgEl);
  }

  /** Wire the Replace / Regenerate / Cancel footer buttons in the smart dialog.
   *  Mirrors React's smartFooterTemplate callback behaviour. */
  private wireSmartFooterButtons(dlgEl: HTMLElement): void {
    const replaceBtn = dlgEl.querySelector('.smart-replace-btn') as HTMLElement;
    if (replaceBtn && !replaceBtn.dataset.wired) {
      replaceBtn.dataset.wired = '1';
      replaceBtn.addEventListener('click', () => this.zone.run(() => this.onReplace()));
    }
    const regenBtn = dlgEl.querySelector('.smart-regenerate-btn') as HTMLElement;
    if (regenBtn && !regenBtn.dataset.wired) {
      regenBtn.dataset.wired = '1';
      // Mirror React: show spinner, then regenerate with a short delay so the
      // spinner is visible before the async AI call begins.
      regenBtn.addEventListener('click', () => this.zone.run(() => {
        const sc = this.getActiveSpinner();
        if (sc) showSpinner(sc);
        setTimeout(() => this.runTask(this.popupType, true), 10);
      }));
    }
    const cancelBtn = dlgEl.querySelector('.smart-cancel-btn') as HTMLElement;
    if (cancelBtn && !cancelBtn.dataset.wired) {
      cancelBtn.dataset.wired = '1';
      cancelBtn.addEventListener('click', () => this.zone.run(() => {
        this.smartVisible = false;
        this.smartDialog.hide();
      }));
    }
  }

  // ---------- helpers ----------
  private getSelectionText(): string {
    try {
      const html = (this.editorRef?.documentEditor?.selection?.getHtmlContent() || '').trim();
      // Syncfusion returns an empty <span style=...></span> when the selection
      // is just a blinking cursor with no text.  Strip tags and check for
      // actual text content so we don't mistake "cursor only" for a selection.
      const plain = (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      return plain ? html : '';
    } catch { return ''; }
  }

  private htmlToPlain(html: string): string {
    return (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  private getDE(): any { return this.editorRef?.documentEditor || null; }

  private getOffsets(): { start: any, end: any } {
    const ed = this.getDE();
    const sel = ed?.selection;
    try {
      return { start: sel.startOffset, end: sel?.endOffset };
    } catch { return { start: null, end: null }; }
  }

  private selectOffsets(start: any, end: any): void {
    const sel = this.getDE()?.selection;
    if (sel?.select && start != null && end != null) sel.select(start, end);
  }

  // ---------- textbox ----------
  private textBoxCreated(): void {
    const inst = this.textbox;
    if (!inst) return;
    const isDisabled = this.userPrompt?.trim() ? '' : 'e-disabled';
    inst.addIcon('append', 'e-icons e-send ' + isDisabled);
    const wrapper = inst.element?.parentElement;
    const icon = wrapper?.querySelector('.e-input-group-icon.e-send') as HTMLElement;
    if (icon) {
      icon.setAttribute('title', 'Generate');
      icon.setAttribute('role', 'button');
      icon.setAttribute('aria-label', 'Generate');
      icon.addEventListener('click', () => this.zone.run(() => this.onSend()));
    }
  }

  private textboxValueChange(e: any): void {
    this.userPrompt = e.value;
    (window as any)?.toggleSendIcon?.(e.value?.length > 0);
  }

  // ---------- build prompt ----------
  private buildPrompt(task: string, text: string, Regenerate: boolean, opts: any = {}): any {
    const {
      tone = 'Professional', format = 'Paragraph', length = 'Medium',
      fromLang = 'English', toLang = 'French', checks = [], userHint = ''
    } = opts;
    const content = (text || '').trim().toLowerCase();
    const toneValue = String(tone).toLowerCase();
    const formatValue = String(format).toLowerCase();
    const lengthValue = String(length).toLowerCase();

    switch (task) {
      case 'Generate': {
        const currentResult = this.getSelectionText();
        if (!Regenerate) {
          return currentResult.length > 0 ? {
            messages: [
              { role: 'system', content: `You are a helpful assistant. Your task is to analyze the provided text and revise it based on the provided suggestion: '${content}'. Please adjust the text to reflect a tone of '${toneValue}', formatted in '${formatValue}' style, and maintain a length of '${lengthValue}'. Always respond in proper HTML format, excluding <html>, <head>, and <body> tags.` },
              { role: 'user', content: currentResult }
            ], model: 'gpt-4'
          } : {
            messages: [
              { role: 'system', content: `You are a helpful assistant. Your task is to generate content based on the provided text. Please adjust the text to reflect a tone of '${toneValue}', formatted in '${formatValue}' style, and maintain a length of '${lengthValue}'. Always respond in proper text format not a md format. Always respond in proper HTML format, excluding <html>, <head>, and <body> tags.` },
              { role: 'user', content }
            ], model: 'gpt-4'
          };
        } else {
          return {
            messages: [
              { role: 'system', content: `You are a helpful assistant. Your task is to analyze the provided text and rephrase it. Please adjust the text to reflect a tone of '${toneValue}', formatted in '${formatValue}' style, and maintain a length of '${lengthValue}'. Always respond in proper HTML format, excluding <html>, <head>, and <body> tags.` },
              { role: 'user', content: currentResult }
            ], model: 'gpt-4'
          };
        }
      }
      case 'Rephrase': {
        if (!Regenerate) {
          return {
            messages: [
              { role: 'system', content: `You are a helpful assistant. Your task is to analyze the provided text and rephrase it. Please adjust the text to reflect a tone of '${toneValue}', formatted in '${formatValue}' style, and maintain a length of '${lengthValue}'. Always respond in proper HTML format, excluding <html>, <head>, and <body> tags.` },
              { role: 'user', content }
            ], model: 'gpt-4'
          };
        } else {
          return {
            messages: [
              { role: 'system', content: `You are a helpful assistant. Your task is to analyze the provided text and revise it based on the provided suggestion: '${this.aiResults}'. Please adjust the text to reflect a tone of '${toneValue}', formatted in '${formatValue}' style, and maintain a length of '${lengthValue}'. Always respond in proper HTML format, excluding <html>, <head>, and <body> tags.` },
              { role: 'user', content }
            ], model: 'gpt-4'
          };
        }
      }
      case 'Translate': {
        const systemPrompt = `You are a helpful assistant.\n\nYour task is:\n- To translate the provided text into '${toLang}'\n- DO NOT modify, remove, or restructure any HTML tags.\n- DO NOT change any HTML attributes, styles, or structure.\n- Preserve the exact same HTML structure and formatting.\n- Only update the text inside the tags.\n\nReturn the output in valid HTML format.\nDo not include <html>, <head>, <p> or <body> tags.`;
        return {
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content }
          ], model: 'gpt-4'
        };
      }
      case 'Grammar': {
        let value = '';
        let systemPrompt = '';
        if (checks.length > 0) {
          checks.forEach((item: string) => { value += item + ', '; });
          systemPrompt = `You are a helpful assistant. Your task is to analyze the provided text and perform the following grammar checks: ${value}. Please ensure that the revised text reflects these corrections. Always respond in proper HTML format, but do not include <html>, <head>, or <body> tags.`;
        } else {
          systemPrompt = 'You are a helpful assistant. Your task is to analyze the provided text, check for and correct any grammatical errors, and rephrase it. Always respond in proper HTML format, but do not include <html>, <head>, or <body> tags.';
        }
        return {
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content }
          ], model: 'gpt-4'
        };
      }
      default: return content;
    }
  }

  // ---------- core task runner ----------
  async runTask(task: string, isRegenerate = false, toLanguage?: string): Promise<void> {
    this.isLoading = true;
    this.canceled = false;
    let out = '';
    this.aiResults = [];
    try {
      let sourceText = '';
      let options: any = '';
      if (task === AiTask.Generate) {
        sourceText = (this.userPrompt?.trim() || (this.textbox?.value || '').trim()) as string;
        this.userPrompt = '';
        (window as any)?.toggleSendIcon?.(false);
        this.openStopDialog();
        if (!isRegenerate && !sourceText) { this.isLoading = false; return; }
        options = this.buildPrompt(AiTask.Generate, sourceText, isRegenerate, { tone: this.tone, format: this.format, length: this.length });
        setTimeout(async () => {
          out = await this.ai.getAzureChatAIRequest(options) || '';
          out = out.replace('```html\n', '').replace('\n```', '');
          this.insertContent(out);
        }, 1000);
      } else {
        // Prefer the selection captured at context-menu click time; fall back
        // to a live read for the Generate / legacy paths.
        sourceText = this.capturedSelectionHtml ?? this.getSelectionText();
        this.capturedSelectionHtml = null;
        // If we still have no text (e.g. the editor selection was lost to the
        // open dialog during a Translate language-change / Regenerate),
        // reuse the source text from the current task.
        if ((!sourceText || sourceText.trim().length < 3) && this.lastSourceText) {
          sourceText = this.lastSourceText;
        }
        if (!sourceText || sourceText.trim().length < 3) { this.isLoading = false; return; }
        // Remember it for subsequent re-runs in this dialog session.
        this.lastSourceText = sourceText;
        // Note: the spinner is shown by runMenuTask (context-menu path) and
        // changeLanguage (re-translate path). We do NOT call showSpinner here
        // because ej2's showSpinner/hideSpinner are NOT idempotent — calling
        // showSpinner twice needs two hideSpinner calls, and the spinner would
        // never disappear (covering the translated/rephrased output).
        if (task === AiTask.Rephrase) {
          const userHint = isRegenerate ? '' : (this.userPrompt?.trim() || '');
          for (let i = 0; i < 3; i++) {
            options = this.buildPrompt(AiTask.Rephrase, sourceText, isRegenerate, { tone: this.tone, format: this.format, length: this.length, userHint });
            out = await this.ai.getAzureChatAIRequest(options) || '';
            out = out.replace('```html\n', '').replace('\n```', '');
            if (!this.aiResults.includes(out)) this.aiResults.push(out);
          }
        } else if (task === AiTask.Grammar) {
          options = this.buildPrompt(AiTask.Grammar, sourceText, isRegenerate, { checks: this.checks });
          out = await this.ai.getAzureChatAIRequest(options) || '';
          out = out.replace('```html\n', '').replace('\n```', '');
        } else {
          const toLang = toLanguage || this.translateTo;
          options = this.buildPrompt(AiTask.Translate, sourceText, false, { fromLang: 'English', toLang });
          out = await this.ai.getAzureChatAIRequest(options) || '';
          out = out.replace('```html\n', '').replace('\n```', '');
        }
        out = this.aiResults.length > 0 ? this.aiResults[0] : out;
        this.inHtml = `<p>${sourceText}</p>`;
        this.outHtml = out;
        this.suggestions = this.aiResults;
        this.currentIndex = 0;
        this.refreshSmartDialogContent();
        const sc = this.getActiveSpinner();
        if (sc) hideSpinner(sc);
      }
    } catch (e: any) {
      if (!this.canceled) alert('AI error: ' + (e?.message || e));
    } finally {
      this.isLoading = false;
    }
  }

  private async insertContent(out: string): Promise<void> {
    if (this.canceled) return;
    this.closeStopDialog();
    this.inHtml = '';
    this.outHtml = out;
    try {
      const ed = this.editorRef?.documentEditor;
      if (ed) {
        await ed.editor.delete();
        ed.focusIn();
        const { end: caretEndBefore } = this.getOffsets();
        if (caretEndBefore != null) this.selectOffsets(caretEndBefore, caretEndBefore);
        const plain = this.htmlToPlain(out);
        if (this.canceled) return;
        ed.editor.insertText(plain);
        ed.editor.insertText('\n');
        const { end: endAfter } = this.getOffsets();
        if (caretEndBefore != null && endAfter != null && endAfter >= caretEndBefore) {
          this.selectOffsets(caretEndBefore, endAfter);
          this.draftRange = { start: caretEndBefore, end: endAfter };
        } else {
          this.draftRange = { start: null, end: null };
        }
      }
    } catch (e: any) {
      alert('Insert failed: ' + (e?.message || e));
    }
    this.userPrompt = '';
  }

  // ---------- events ----------
  onMenuSelect(args: MenuEventArgs): void {
    const sel = args.item?.text;
    if (!sel) return;
    this.zone.run(() => this.runMenuTask(
      sel === 'Rephrase' ? AiTask.Rephrase :
      sel === 'Translate' ? AiTask.Translate : AiTask.Grammar
    ));
  }

  openChat(): void {
    document.querySelector('.e-ribbon-help-template')?.classList.add('e-hide');
    document.querySelector('.document-editor-container')?.classList.add('e-hide');
    this.fabChatVisible = false;
    if (this.chatFab) this.chatFab.visible = false;
    // notify parent component to open the chat pane
    this.zone.run(() => this.showChatPane.emit());
  }

  async onReplace(): Promise<void> {
    await this.replaceSelectionWithHtml(this.outHtml);
    this.smartVisible = false;
    this.smartDialog.hide();
  }

  prevSuggestion(): void {
    this.currentIndex = Math.max(this.currentIndex - 1, 0);
    this.outHtml = this.suggestions[this.currentIndex] || this.outHtml;
    this.refreshSmartDialogContent();
  }

  nextSuggestion(): void {
    this.currentIndex = Math.min(this.currentIndex + 1, this.suggestions.length - 1);
    this.outHtml = this.suggestions[this.currentIndex] || this.outHtml;
    this.refreshSmartDialogContent();
  }

  onSend(): void { this.runTask(AiTask.Generate); }

  changeLanguage(e: any): void {
    this.translateTo = e.value;
    // Re-translate uses the captured/remembered source text (the editor
    // selection is gone while the dialog is open). Show the spinner explicitly
    // here because changeLanguage calls runTask directly, bypassing runMenuTask
    // (which is the other place showSpinner is called for the smart-editor
    // path). runTask's end will call hideSpinner to reveal the new translation.
    const sc = this.getActiveSpinner();
    if (sc) showSpinner(sc);
    setTimeout(() => this.runTask(AiTask.Translate, false, e.value), 100);
  }

  generateContentOpen(args: any): void {
    if (this.isContentGenerated) {
      const aiPos = (window as any).getAIAssistPopupPosition?.();
      const updated = (window as any).getRegeneratePopupPosition?.();
      if (!aiPos || !updated) return;
      const x = String(Math.round(aiPos.x));
      const y = String(Math.round(updated.y));
      (this.genDialog as any).position = { X: x, Y: y };
      this.dialogPos = { x, y };
    }
  }

  onKeepGenerated(): void {
    const ed = this.getDE();
    const { end } = this.draftRange || {};
    if (ed && end != null) this.selectOffsets(end, end);
    this.draftRange = { start: null, end: null };
    this.genVisible = false;
    this.genDialog.hide();
  }

  onDiscardGenerated(): void {
    const ed = this.getDE();
    const { start, end } = this.draftRange || {};
    if (ed && start != null && end != null) {
      this.selectOffsets(start, end);
      ed.editor.delete();
    }
    this.draftRange = { start: null, end: null };
    this.genVisible = false;
    this.genDialog.hide();
  }

  openStopDialog(): void {
    this.genVisible = false;
    this.genDialog.hide();
    const pos = (window as any).getGeneratingDraftPosition?.() || { x: 200, y: 160 };
    this.stopPos = { x: Math.round(pos.x + 24), y: Math.round(pos.y) };
    this.stopVisible = true;
    this.stopDialog.position = { X: String(this.stopPos.x), Y: String(this.stopPos.y) } as any;
    this.stopDialog.show();
  }

  closeStopDialog(): void {
    this.stopVisible = false;
    this.stopDialog.hide();
    this.genVisible = true;
    this.genDialog.show();
  }

  // ---------- replace with HTML via SystemClipboard ----------
  private async replaceSelectionWithHtml(html: string): Promise<void> {
    try {
      const editor = this.editorRef?.documentEditor;
      if (!editor) { alert('Replace failed: editor not found'); return; }
      editor.focusIn();
      if (editor.selection?.text) editor.editor.delete();
      const container = this.editorRef;
      const serviceUrl = container?.serviceUrl;
      if (!serviceUrl) { alert('Replace failed: serviceUrl not found'); return; }
      const http = new XMLHttpRequest();
      http.open('POST', serviceUrl + 'SystemClipboard', true);
      http.setRequestHeader('Content-Type', 'application/json;charset=UTF-8');
      http.onreadystatechange = () => {
        if (http.readyState === 4) {
          if (http.status === 200 || http.status === 304) {
            editor.editor.paste(http.responseText, 'KeepSourceFormatting');
          } else {
            alert('Replace failed: ' + http.status);
          }
        }
      };
      http.send(JSON.stringify({ content: html || '', type: '.Html' }));
    } catch (e: any) {
      alert('Replace failed: ' + e.message);
    }
  }

  // ---------- settings menu ----------
  openGearMenu(): void {
    const btn = this.settingsBtn?.element as HTMLElement;
    if (!btn || !this.settingsMenu?.open) return;
    const rect = btn.getBoundingClientRect();
    this.settingsMenu.open(Math.round(rect.bottom), Math.round(rect.left));
  }

  openHeaderSettingsMenu(): void {
    const btn = this.gearHeaderBtn?.element as HTMLElement;
    if (!btn || !this.settingsMenu?.open) return;
    const rect = btn.getBoundingClientRect();
    this.settingsMenu.open(Math.round(rect.bottom), Math.round(rect.left));
  }

  private shouldTick(id: string): boolean {
    const key = (id || '').toLowerCase();
    const toneKey = (this.tone || '').toLowerCase();
    const formatKey = (this.format || '').toLowerCase().replace(/\s+/g, '-');
    const lengthKey = (this.length || '').toLowerCase();
    const isChild = key.includes('child');
    const match = key.includes(toneKey) || key.includes(formatKey) || key.includes(lengthKey);
    return isChild && match;
  }

  onSettingsBeforeItemRender(args: any): void {
    const id = args.item?.id || '';
    const li = args.element as HTMLElement;
    const hasIcon = !!li.querySelector('.e-menu-icon');
    if (this.shouldTick(id)) {
      if (!hasIcon) {
        const icon = document.createElement('span');
        icon.className = 'e-menu-icon e-icons e-check';
        li.insertBefore(icon, li.firstChild);
        li.className = li.className + ' e-selected';
      } else {
        (li.querySelector('.e-menu-icon') as HTMLElement).className = 'e-menu-icon e-icons e-check';
      }
    }
  }

  onSettingsMenuSelect(args: MenuEventArgs): void {
    const id = args.item?.id || '';
    const text = args.item?.text || '';
    if (id.startsWith('child')) {
      if (id.startsWith('child-tone-')) this.tone = text;
      else if (id.startsWith('child-format-')) this.format = text;
      else if (id.startsWith('child-size-')) this.length = text;
    }
  }

  // ---------- AI task trigger from the editor's native context menu ----------
  /**
   * Called by the parent AppComponent when the user selects the
   * "Rephrase", "Translate", or "Grammar" item that has been added to the
   * Document Editor's context menu (via `contextMenu.addCustomMenu`).
   *
   * This is the page-agnostic replacement for the old cursor-following FAB:
   * the native context menu opens at whatever page the user right-clicks on,
   * so Rephrase/Translate/Grammar work on every page, not just the first one.
   *
   * `action` is one of 'Rephrase' | 'Translate' | 'Grammar'. The editor
   * selection is preserved — the menu appears on a right-click, so the
   * selection is always present by the time this runs.
   */
  triggerAIAction(action: 'Rephrase' | 'Translate' | 'Grammar', capturedSelectionHtml?: string): void {
    // Reuse the existing menu-select path so the smart-editor dialog,
    // spinner, suggestion list and Replace flow stay identical.
    const map: Record<string, string> = {
      'Rephrase': AiTask.Rephrase,
      'Translate': AiTask.Translate,
      'Grammar': AiTask.Grammar
    };
    const task = map[action];
    if (!task) return;
    this.zone.run(() => this.runMenuTask(task, capturedSelectionHtml));
  }

  /** Shared entry point for both the legacy FAB-click menu item and the new
   *  editor custom-context-menu item.  Kept separate from onMenuSelect so
   *  the existing Syncfusion ContextMenu (Rephrase/Translate/Grammar) can
   *  keep working unchanged.
   *  `capturedSelectionHtml` lets callers (the editor context menu) pass in
   *  the HTML captured at click time so the task runs even if the editor
   *  selection has been cleared by the time the zone-deferred body executes. */
  private runMenuTask(task: string, capturedSelectionHtml?: string): void {
    const action: 'Rephrase' | 'Translate' | 'Grammar' =
      task === AiTask.Rephrase ? 'Rephrase' :
      task === AiTask.Translate ? 'Translate' : 'Grammar';
    // Use the captured selection if provided; otherwise read it live (used by
    // the legacy FAB-path ContextMenu where selection is still intact).
    const selHtml = (capturedSelectionHtml !== undefined)
      ? capturedSelectionHtml
      : this.getSelectionText();
    // Stash it so runTask (which may run after the editor has refocused and
    // cleared the selection) reads the same text we captured at click time.
    this.capturedSelectionHtml = selHtml;
    this.popupType = task;
    this.suggestions = []; this.currentIndex = 0; this.userPrompt = '';
    this.isSmartEditor = true;
    this.inHtml = `<p>${selHtml}</p>`;
    this.outHtml = '';
    // Show the dialog BEFORE touching the spinner — the spinner target
    // (#smart-spinner-container) lives inside the dialog's content template,
    // which Syncfusion renders lazily on .show(). refreshSmartDialogContent
    // (called next) initializes the spinner; only then can we show it.
    this.smartVisible = true;
    this.smartDialog.show();
    this.refreshSmartDialogContent();
    const sc = this.getActiveSpinner();
    if (sc) showSpinner(sc);
    try { this.editorRef?.documentEditor?.focusIn?.(); } catch {}
    setTimeout(() => this.runTask(action as any), 100);
  }

  /** Wire the editor's native custom context menu (Rephrase / Translate /
   *  Grammar).  The items are shown only when AI is enabled and there is a
   *  non-empty selection; otherwise they are hidden via
   *  `customContextMenuBeforeOpen`.  Safe to call more than once — addCustomMenu
   *  is idempotent per id combination in practice, so we guard with a flag. */
  private contextMenuInstalled = false;
  private contextMenuRetry = 0;
  installEditorContextMenu(): void {
    const ed = this.editorRef?.documentEditor;
    if (!ed?.contextMenu?.addCustomMenu) {
      // documentEditor is created asynchronously after the container's
      // 'created' event; retry a few times until it is available.
      if (this.contextMenuRetry++ < 40) {
        setTimeout(() => this.installEditorContextMenu(), 100);
      }
      return;
    }
    if (this.contextMenuInstalled) return;
    this.contextMenuInstalled = true;

    // Syncfusion's Document Editor automatically prefixes custom context-menu
    // item ids with its own element.id — see the "Customize Context Menu"
    // sample (https://help.syncfusion.com/.../customize-context-menu):
    //   items are created with { id: 'search_in_google' } (no prefix), but
    //   customContextMenuSelect receives args.id === edId + 'search_in_google'.
    // So we set the ids WITHOUT the edId prefix here, and build the expected
    // ids as edId + 'ai_...' when comparing in the handlers below.
    const edId: string = ed.element?.id || '';

    const menuItems = [
      { text: 'Rephrase', id: 'ai_rephrase', iconCss: 'e-icons e-rephrase' },
      { text: 'Translate', id: 'ai_translate', iconCss: 'e-icons e-translate' },
      { text: 'Grammar',  id: 'ai_grammar',  iconCss: 'e-icons e-grammar-check' }
    ];

    // Second arg = false → keep the default context menu items; our three items
    // are appended below them.
    ed.contextMenu.addCustomMenu(menuItems, false);

    // Expected ids after Syncfusion prefixes them with edId.
    const idRephrase = edId + 'ai_rephrase';
    const idTranslate = edId + 'ai_translate';
    const idGrammar = edId + 'ai_grammar';
    const isAiItem = (id: string) => id === idRephrase || id === idTranslate || id === idGrammar;

    // Show/hide our items depending on AI enabled state and selection.
    ed.customContextMenuBeforeOpen = (args: any): void => {
      try {
        const ids: string[] = args?.ids || [];
        const selText = (this.getSelectionText() || '').replace(/<[^>]+>/g, ' ').trim();
        const enabled = this.isAIEnabled && selText.length > 0;
        for (const id of ids) {
          if (isAiItem(id)) {
            // The <li> DOM element id is the prefixed id (same as args.id).
            const li = document.getElementById(id);
            if (li) li.style.display = enabled ? '' : 'none';
          }
        }
      } catch {}
    };

    // Route the selected item to the existing smart-editor flow.
    ed.customContextMenuSelect = (args: any): void => {
      try {
        const id: string = args?.id || '';
        if (!isAiItem(id)) return;
        if (!this.isAIEnabled) return;
        // Capture the selection HTML *immediately* — the context menu is
        // closing right now and the editor may refocus / clear the
        // selection before any deferred zone callback reads it again.
        const selHtml = this.getSelectionText();
        const selPlain = (selHtml || '').replace(/<[^>]+>/g, ' ').trim();
        if (selPlain.length === 0) return;
        const action = id === idRephrase ? 'Rephrase'
          : id === idTranslate ? 'Translate'
          : id === idGrammar   ? 'Grammar'
          : '';
        if (action) this.triggerAIAction(action as any, selHtml);
      } catch {}
    };
    console.log('[AIPopup] custom editor context menu installed (Rephrase/Translate/Grammar)', { edId, idRephrase, idTranslate, idGrammar });
  }

  private onChatFabCreated(): void {
    requestAnimationFrame(() => this.positionChatFabByHelper());
    window.addEventListener('resize', () => this.positionChatFabByHelper());
  }

  private positionChatFabByHelper(): void {
    let position = (window as any).getAIChatBtnPosition?.();
    // Fallback when the helper can't locate #document-editor (Angular wrapper
    // may render the inner container with a different id/class). Place the chat
    // FAB in the bottom-right of the editor viewport.
    if (!position) {
      const host = document.querySelector('#document-editor') as HTMLElement
        || document.querySelector('.e-documenteditorcontainer') as HTMLElement
        || document.querySelector('.document-editor-container') as HTMLElement;
      if (host) {
        const r = host.getBoundingClientRect();
        position = { x: r.width - 87, y: r.height - 81 };
      }
    }
    if (!position) return;
    (window as any).setAiAssistBtnPosition?.(Math.round(position.x), Math.round(position.y));
  }

  private wireGenOutsidePress(): void {
    if (this.onOutsidePress) return;
    this.onOutsidePress = (e: Event) => {
      try {
        const dlgEl = this.genDialog?.element;
        const settingsEl = document.querySelector('.ai-settings-menu');
        const inDialog = dlgEl?.contains(e.target as Node) || false;
        const inSettings = settingsEl?.contains(e.target as Node) || false;
        if (!inDialog && !inSettings) {
          this.zone.run(() => { this.genVisible = false; this.genDialog.hide(); });
        }
      } catch {}
    };
    document.addEventListener('pointerdown', this.onOutsidePress, true);
    document.addEventListener('mousedown', this.onOutsidePress, true);
  }
}
