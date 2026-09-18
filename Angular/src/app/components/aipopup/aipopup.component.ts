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
  @Input() assistInitialPos: any;
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
  viewerHost: HTMLElement | null = null;
  fabChatVisible = false;
  fabAssistVisible = false;
  assistBtn = { left: 80, top: 160, width: 24, height: 24, visible: true };
  aiResults: string[] = [];

  // widget references
  private assistFab!: Fab;
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
    this.startViewerPick();
    createSpinner({ target: this.hostRef.nativeElement.querySelector('#spinner-container') as HTMLElement });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isAIEnabled']) {
      if (!this.isAIEnabled) {
        this.fabAssistVisible = false;
        this.fabChatVisible = false;
      } else {
        this.fabAssistVisible = true;
        // Chat FAB is hidden from the sample — kept in code but not shown.
        this.fabChatVisible = false;
      }
      if (this.assistFab) {
        this.assistFab.visible = this.fabAssistVisible;
        this.updateFabPosition();
      }
      if (this.chatFab) {
        this.chatFab.visible = this.fabChatVisible;
        if (this.fabChatVisible) requestAnimationFrame(() => this.positionChatFabByHelper());
      }
    }
    if (changes['chatOpen'] && this.chatFab) {
      // Chat FAB is hidden from the sample — keep it always invisible.
      this.fabChatVisible = false;
      this.chatFab.visible = false;
    }
    if (changes['assistInitialPos'] && this.assistInitialPos) {
      this.assistBtn = {
        left: this.assistInitialPos.left ?? this.assistBtn.left,
        top: this.assistInitialPos.top ?? this.assistBtn.top,
        width: this.assistInitialPos.width ?? this.assistBtn.width,
        height: this.assistInitialPos.height ?? this.assistBtn.height,
        visible: true
      };
      if (!this.isAIEnabled) { this.fabAssistVisible = false; this.fabChatVisible = false; }
      this.updateFabPosition();
    }
    // React re-runs its selectionChange useEffect whenever editorRef changes.
    // The viewer polling may find #documentEditorDiv before the parent's
    // @ViewChild('container') resolves, so editorRef can be undefined the
    // first time onViewerHostChanged runs. Reset the flag so the polling
    // interval can re-install the hook once documentEditor is available.
    // Defer to avoid NG0100 (ExpressionChangedAfterItHasBeenCheckedError)
    // when containerRef changes from undefined to the component instance.
    if (changes['editorRef']) {
      this.selectionChangeHooked = false;
      setTimeout(() => this.hookSelectionChange(), 0);
    }
  }

  ngOnDestroy(): void {
    [this.assistFab, this.chatFab, this.genDialog, this.smartDialog, this.stopDialog,
     this.assistMenu, this.settingsMenu, this.settingsBtn, this.gearHeaderBtn,
     this.textbox, this.translateComboBox, this.grammarMultiSelect].forEach(w => { try { w?.destroy?.(); } catch {} });
    if (this.viewerPickInterval) clearInterval(this.viewerPickInterval);
    if (this.assistMenuHost?.parentNode) this.assistMenuHost.parentNode.removeChild(this.assistMenuHost);
    if (this.onOutsidePress) {
      document.removeEventListener('pointerdown', this.onOutsidePress, true);
      document.removeEventListener('mousedown', this.onOutsidePress, true);
    }
  }

  // ---------- widget construction ----------
  private buildWidgets(): void {
    const host = this.hostRef.nativeElement;

    // assist FAB
    const fabAssistEl = document.createElement('button');
    fabAssistEl.id = 'ai-assist-fab';
    host.appendChild(fabAssistEl);
    this.assistFab = new Fab({
      cssClass: 'ai-assist-btn',
      iconCss: 'e-icons e-ai-assist-btn',
      visible: this.fabAssistVisible
    } as any);
    this.assistFab.appendTo(fabAssistEl);
    fabAssistEl.title = 'Generate new content';
    fabAssistEl.addEventListener('mousedown', (e: MouseEvent) => { e.preventDefault(); e.stopPropagation(); });
    fabAssistEl.addEventListener('click', (e: MouseEvent) => {
      // Stop the click from bubbling to document — Syncfusion's ContextMenu
      // listens at the document level and would otherwise close the menu we
      // are about to open below.
      e.preventDefault();
      e.stopPropagation();
      this.zone.run(() => this.openAssistMenu(e));
    });
    this.updateFabPosition();
    console.log('[AIPopup] assist FAB created', { element: fabAssistEl, classList: Array.from(fabAssistEl.classList) });

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
      close: () => this.zone.run(() => { this.smartVisible = false; })
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

  private updateFabPosition(): void {
    const el = this.assistFab?.element;
    if (!el) return;
    el.style.position = 'absolute';
    el.style.left = `${this.assistBtn.left}px`;
    el.style.top = `${this.assistBtn.top}px`;
    el.style.width = `${this.assistBtn.width}px`;
    el.style.height = `${this.assistBtn.height}px`;
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
    return `<div class="ai-dialog-body"><div class="ai-splitter smart-splitter"><div class="pane-content"><div class="pane-content-header"><label class="translate-label smart-from-label"></label></div><div class="pane-text-area smart-in-html" style="height:280px;border:1px solid #ccc;padding:6px 10px;overflow-y:auto;"></div></div><div class="pane-content"><div class="pane-content-header"><label class="translate-label smart-to-label"></label><span class="smart-translate-combo" style="margin-left:8px"></span><span class="smart-grammar-multiselect" style="margin-left:8px"></span></div><div id="e-de-editableDiv" class="pane-text-area smart-out-html" style="height:280px;border:1px solid #ccc;padding:6px 10px;overflow-y:auto;"></div></div></div><div id="spinner-container" class="spinner-target"></div></div>`;
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
        const sc = document.getElementById('spinner-container');
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
        sourceText = this.getSelectionText();
        if (!sourceText || sourceText.trim().length < 3) { this.isLoading = false; return; }
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
        const sc = document.getElementById('spinner-container');
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
    console.log('[AIPopup] onMenuSelect fired', { item: args.item });
    const sel = args.item?.text;
    const action = sel === 'Rephrase' ? AiTask.Rephrase : (sel === 'Translate' ? AiTask.Translate : AiTask.Grammar);
    if (!sel) return;
    this.popupType = action;
    this.suggestions = []; this.currentIndex = 0; this.userPrompt = '';
    this.isSmartEditor = true;
    this.inHtml = `<p>${this.getSelectionText()}</p>`;
    this.outHtml = '';
    const sc = document.getElementById('spinner-container');
    if (sc) showSpinner(sc);
    this.smartVisible = true;
    this.smartDialog.show();
    this.refreshSmartDialogContent();
    setTimeout(() => this.runTask(action), 100);
  }

  openAssistMenu(ev: any): void {
    console.log('[AIPopup] openAssistMenu fired', { ev, editorRef: this.editorRef });
    ev?.preventDefault?.();
    ev?.stopPropagation?.();

    // Preserve the editor selection: clicking the FAB can blur the editor and
    // the underlying DocumentEditor may clear its selection before this handler
    // reads it. Re-focus the editor (no-op if already focused) before reading.
    try {
      this.editorRef?.documentEditor?.focusIn?.();
    } catch {}

    const sel = this.getSelectionText();
    console.log('[AIPopup] selection html =', JSON.stringify(sel));
    if (!sel) {
      console.log('[AIPopup] no selection → opening Generate dialog');
      if (this.stopVisible) { console.log('[AIPopup] stopVisible=true, bail'); return; }
      this.popupType = AiTask.Generate;
      this.isSmartEditor = false;
      this.inHtml = ''; this.outHtml = ''; this.userPrompt = ''; this.suggestions = [];
      const pos = (window as any).getAIAssistPopupPosition ? (window as any).getAIAssistPopupPosition() : null;
      console.log('[AIPopup] getAIAssistPopupPosition =', pos);
      const posVal = pos || { x: 200, y: 160 };
      this.dialogPos = { x: String(Math.round(posVal.x)), y: String(Math.round(posVal.y)) };
      this.genDialog.position = { X: this.dialogPos.x, Y: this.dialogPos.y } as any;
      this.genVisible = true;
      this.genDialog.show();
      requestAnimationFrame(() => (this.genDialog as any).refreshPosition?.());
      this.wireGenOutsidePress();
      return;
    }
    console.log('[AIPopup] selection present → attempting to open Rephrase/Translate/Grammar menu');
    if (this.genVisible || this.stopVisible) {
      console.log('[AIPopup] bail: genVisible/stopVisible', { genVisible: this.genVisible, stopVisible: this.stopVisible });
      return;
    }
    const aiPos = (window as any).getAIButtonPosition ? (window as any).getAIButtonPosition() : null;
    console.log('[AIPopup] getAIButtonPosition =', aiPos, '| assistMenu =', !!this.assistMenu, '| open fn =', typeof (this.assistMenu as any)?.open);
    if (aiPos && (this.assistMenu as any).open) {
      console.log('[AIPopup] calling assistMenu.open(y, x) with primary coords', { y: Math.round(aiPos.y), x: Math.round(aiPos.x + 24) });
      this.assistMenu.open(Math.round(aiPos.y), Math.round(aiPos.x + 24));
      this.dumpMenuState('primary');
      return;
    }
    const r = (this.assistFab?.element as HTMLElement)?.getBoundingClientRect();
    console.log('[AIPopup] fallback → assistFab rect =', r);
    if (r) {
      // ContextMenu.open(top, left) expects (y, x) order.
      const top = Math.round(r.top + (window as any).scrollY);
      const left = Math.round(r.left + (window as any).scrollX + 24);
      console.log('[AIPopup] calling assistMenu.open(y, x) with fallback coords', { top, left, scrollY: (window as any).scrollY, scrollX: (window as any).scrollX });
      this.assistMenu.open(top, left);
      this.dumpMenuState('fallback');
    } else {
      console.log('[AIPopup] ✗ no FAB rect available — menu will NOT open');
    }
  }

  /** Logs the rendered ContextMenu popup state for diagnostics. */
  private dumpMenuState(tag: string): void {
    setTimeout(() => {
      const popups = document.querySelectorAll('ul.e-contextmenu, .e-contextmenu-wrapper, .e-menu-wrapper');
      console.log(`[AIPopup] dumpMenuState(${tag}) → found ${popups.length} contextmenu popup(s)`);
      popups.forEach((p, i) => {
        const el = p as HTMLElement;
        const cs = window.getComputedStyle(el);
        console.log(`[AIPopup] popup[${i}]`, {
          display: cs.display,
          visibility: cs.visibility,
          opacity: cs.opacity,
          position: cs.position,
          top: cs.top,
          left: cs.left,
          zIndex: cs.zIndex,
          offsetParent: el.offsetParent?.tagName,
          childCount: el.querySelectorAll('li.e-menu-item').length,
          outerHTML: el.outerHTML.slice(0, 200)
        });
      });
    }, 50);
  }

  openChat(): void {
    document.querySelector('.e-ribbon-help-template')?.classList.add('e-hide');
    document.querySelector('.e-fab.ai-assist-btn')?.classList.add('e-hide');
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

  // ---------- viewer pick + FAB positioning ----------
  private viewerPickInterval: any;
  private viewerTracked = false;
  private mouseTracking = false;
  private selectionChangeHooked = false;

  private startViewerPick(): void {
    const pick = () => {
      const el = document.querySelector('#document-editor #documentEditorDiv') as HTMLElement;
      if (el && el !== this.viewerHost) {
        this.viewerHost = el;
        this.onViewerHostChanged(el);
      }
      // The editorRef (DocumentEditorContainerComponent) is set early, but its
      // internal documentEditor is only created after the container's
      // 'created' event. Keep trying until documentEditor is available, then
      // install the selectionChange hook. React achieves this via a useEffect
      // with dependency [editorRef, viewerHost] that re-runs when either
      // changes; Angular has no equivalent re-trigger, so we poll here.
      if (this.editorRef?.documentEditor && !this.selectionChangeHooked) {
        this.hookSelectionChange();
      }
    };
    pick();
    this.viewerPickInterval = setInterval(pick, 300);
    window.addEventListener('resize', () => pick());
  }

  private onViewerHostChanged(el: HTMLElement): void {
    console.log('[AIPopup] onViewerHostChanged → viewer element found', { el, editorRef: this.editorRef });
    // Position the assist FAB initially once the viewer is available.
    this.positionAssistFabInitial();

    // Install the selectionChange hook (also re-installed from ngOnChanges
    // when editorRef resolves). React assigns unconditionally — no guard on
    // ed.selectionChange being already defined.
    this.hookSelectionChange();

    if (this.viewerTracked) { console.log('[AIPopup] viewer already tracked, skipping listener attach'); return; }
    this.viewerTracked = true;

    // React: useEffect for mousedown/mouseup tracking on the viewer element.
    el.addEventListener('mousedown', (e: MouseEvent) => this.zone.runOutsideAngular(() => this.onViewerMouseDown(e)), false);
    el.addEventListener('mouseup', (e: MouseEvent) => this.zone.runOutsideAngular(() => this.onViewerMouseUp(e)), false);
    console.log('[AIPopup] attached mousedown/mouseup on viewer');
  }

  /** Install (or re-install) the editor selectionChange hook so the FAB
   *  follows the cursor. Mirrors React's useEffect([editorRef, viewerHost]).
   *  Safe to call repeatedly — React assigns unconditionally (no guard). */
  private hookSelectionChange(): void {
    try {
      const ed = this.editorRef?.documentEditor;
      if (ed) {
        ed.selectionChange = () => this.zone.run(() => this.onSelectionChange());
        this.selectionChangeHooked = true;
        console.log('[AIPopup] selectionChange hook installed');
      }
    } catch {}
  }

  private onSelectionChange(): void {
    try {
      const pos = (window as any).getAIAssistBtnPosition?.();
      if (pos) {
        this.assistBtn = {
          ...this.assistBtn,
          left: Math.round(pos.x),
          top: Math.round(pos.y)
        };
        this.updateFabPosition();
      }
    } catch {}
  }

  private onViewerMouseDown(_e: MouseEvent): void {
    this.mouseTracking = true;
    try {
      const sel = this.editorRef?.documentEditor?.selection?.text || '';
      if (sel && this.isSmartEditor) {
        this.zone.run(() => { this.isSmartEditor = false; });
      }
    } catch {}
  }

  private onViewerMouseUp(_e: MouseEvent): void {
    if (!this.mouseTracking) return;
    this.mouseTracking = false;

    setTimeout(() => {
      try {
        const selText = this.editorRef?.documentEditor?.selection?.text || '';
        console.log('[AIPopup] onViewerMouseUp → selection text =', JSON.stringify(selText), '| viewerHost =', !!this.viewerHost);
        if (!!selText && selText.trim().length > 0) {
          this.zone.run(() => {
            this.isSmartEditor = true;
            // Mirror React: set the FAB tooltip to indicate refine mode.
            if (this.assistFab?.element) (this.assistFab.element as HTMLElement).title = 'Refine the content';
          });
        }

        const pos = (window as any).getAIAssistBtnPosition?.();
        console.log('[AIPopup] getAIAssistBtnPosition =', pos);
        if (pos && typeof pos.x === 'number' && typeof pos.y === 'number') {
          this.zone.run(() => {
            this.assistBtn = {
              ...this.assistBtn,
              left: Math.round(pos.x),
              top: Math.round(pos.y)
            };
            this.updateFabPosition();
          });
        }
      } catch {}
    }, 10);
  }

  private positionAssistFabInitial(): void {
    try {
      const pos = (window as any).getAIAssistBtnPosition?.();
      if (!pos) return;
      this.assistBtn = {
        ...this.assistBtn,
        left: Math.round(pos.x),
        top: Math.round(pos.y),
        width: 24,
        height: 24
      };
      this.updateFabPosition();
    } catch {}
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
