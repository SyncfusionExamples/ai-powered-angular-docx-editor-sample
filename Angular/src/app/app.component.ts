import {
  Component,
  ViewChild,
  OnDestroy,
  OnInit,
  NgZone,
  ChangeDetectorRef,
  inject
} from '@angular/core';
import { L10n } from '@syncfusion/ej2-base';

import { TitleBarService } from './services/title-bar.service';
import { EditorHelpersService } from './services/editor-helpers.service';
import { SummarizerService } from './services/summarizer.service';
import { AiModelsService } from './services/ai-models.service';

L10n.load({
  'en-US': {
    uploader: { dropFilesHint: 'or drop file here' }
  }
});

const SERVICE_URL = 'http://localhost:62869/api/DocumentEditor/';
const UPLOADER_SAVE_URL = 'https://services.syncfusion.com/react/production/api/FileUploader/Save';
const UPLOADER_REMOVE_URL = 'https://services.syncfusion.com/react/production/api/FileUploader/Remove';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, OnDestroy {
  @ViewChild('container', { static: false }) containerRef!: any;
  @ViewChild('uploader', { static: false }) uploaderRef!: any;
  @ViewChild('assistInstance', { static: false }) assistInstance!: any;

  private cdr = inject(ChangeDetectorRef);

  private titleBarService = inject(TitleBarService);
  private editorHelpers = inject(EditorHelpersService);
  private summarizer = inject(SummarizerService);
  private ai = inject(AiModelsService);
  private zone = inject(NgZone);

  initialized = false;
  openChat = false;
  isAIEnabled = false;
  documentName = 'New Document';
  assistBtnPos = { left: 80, top: 160, width: 24, height: 24 };
  aiSuggestions: string[] = ['Summarize this document'];

  private titleBar: any;
  private resizeHandler = () => this.onZoomFactorChange();

  SERVICE_URL = SERVICE_URL;
  UPLOADER_SAVE_URL = UPLOADER_SAVE_URL;
  UPLOADER_REMOVE_URL = UPLOADER_REMOVE_URL;

  ngOnInit(): void {
    this.editorHelpers.register();
  }

  ngOnDestroy(): void {
    window.removeEventListener('resize', this.resizeHandler);
    try { this.titleBar?.destroy?.(); } catch {}
  }

  onZoomFactorChange(): void {
    const editor = this.containerRef?.documentEditor;
    if (!editor) return;
    setTimeout(() => {
      editor.focusIn();
      const zoom = editor.zoomFactor;
      const pos = (window as any).getAIAssistBtnPosition?.();
      if (pos) {
        this.assistBtnPos = {
          left: Math.round(pos.x),
          top: Math.round(pos.y),
          width: Math.round(24 * zoom),
          height: Math.round(24 * zoom)
        };
      }
      (window as any).setAIAssistBtnIconSize?.(Math.round(14 * zoom));
    }, 10);
  }

  onContainerCreated(): void {
    // Defer to next tick so ViewChild (containerRef) is resolved and to avoid
    // ExpressionChangedAfterItHasBeenCheckedError when child [editorRef] updates.
    setTimeout(() => this.initEditor(), 0);
  }

  private initEditor(): void {
    const editor = this.containerRef?.documentEditor;
    if (!editor) return;
    // containerRef is now resolved; force the [editorRef] binding to update
    // in this same tick so Angular doesn't throw NG0100 on the next CD pass.
    this.cdr.detectChanges();
    try { editor.focusIn(); } catch {}
    setTimeout(() => {
      try {
        const pos = (window as any).getAIAssistBtnPosition?.();
        if (pos) {
          this.assistBtnPos = {
            left: Math.round(pos.x),
            top: Math.round(pos.y),
            width: 24,
            height: 24
          };
        }
      } catch {}
    }, 10);
    (window as any).onbeforeunload = () => 'Want to save your changes?';
    editor.zoomFactorChange = () => this.onZoomFactorChange();
    editor.pageOutline = '#E0E0E0';
    editor.acceptTab = true;
    this.containerRef.documentEditorSettings.showRuler = true;
    editor.resize();
    this.titleBar = this.titleBarService.create(
      document.getElementById('documenteditor_titlebar') as HTMLElement,
      editor,
      true,
      null,
      () => this.goBackToUploadPage(),
      (checked: boolean) => this.zone.run(() => this.setIsAIEnabled(checked))
    );
    this.onLoadDefault();
    
    window.addEventListener('resize', this.resizeHandler);
  }

  private setIsAIEnabled(checked: boolean): void {
    this.isAIEnabled = checked;
    if (!checked) this.openChat = false;
  }

  private onLoadDefault(): void {
    const editor = this.containerRef?.documentEditor;
    if (editor) {
      editor.documentName = this.documentName;
      this.titleBar?.updateDocumentTitle?.();
      editor.documentChange = () => {
        this.titleBar?.updateDocumentTitle?.();
        editor.focusIn();
      };
    }
  }

  openNewDocument(): void {
    this.initialized = true;
    this.documentName = 'New Document';
  }

  goBackToUploadPage(): void {
    const editor = this.containerRef?.documentEditor;
    try {
      if (editor) {
        editor.showRevisions = false;
        editor.destroy();
        this.isAIEnabled = false;
      }
    } catch {}
    this.initialized = false;
  }

  async onFileSelected(args: any): Promise<void> {
    const files = args.filesData || [];
    if (!files.length) return;
    const file = files[0]?.rawFile;
    if (!file) return;
    this.initialized = true;
    this.documentName = files[0].name ? files[0].name.split('.' + files[0].type)[0] : 'Untitled Document';
    try {
      const formData = new FormData();
      formData.append('files', file, file.name);
      const response = await fetch(`${SERVICE_URL}Import`, { method: 'POST', body: formData });
      if (!response.ok) throw new Error(`Import failed: ${response.statusText}`);
      const sfdt = await response.text();
      setTimeout(() => {
        const editor = this.containerRef?.documentEditor;
        if (editor) editor.open(sfdt);
      }, 0);
    } catch {
      alert('Failed to import and open the document.');
    }
  }

  onUploaderCreated(): void {
    const browseBtn = document.querySelector('.e-file-select-wrap .e-btn') as HTMLElement;
    if (browseBtn && !browseBtn.querySelector('.e-btn-icon')) {
      const icon = document.createElement('span');
      icon.className = 'e-btn-icon e-icons e-fe-upload';
      browseBtn.insertBefore(icon, browseBtn.firstChild);
    }
  }

  showChatPane(): void {
    this.openChat = true;
    this.aiSuggestions = ['Summarize this document'];
  }

  chatPanelCreated(): void {
    const inst = this.assistInstance as any;
    inst.toolbarSettings.itemClicked = (args: any) => {
      const itemClass = String(args?.item?.iconCss || '');
      if (itemClass.includes('e-close')) {
        this.zone.run(() => {
          this.openChat = false;
          document.querySelector('.e-fab.ai-assist-btn')?.classList.remove('e-hide');
          document.querySelector('.document-editor-container')?.classList.remove('e-hide');
        });
      }
    };
    this.aiSuggestions = ['Summarize this document'];
  }

  async promptRequest(args: any): Promise<void> {
    const prompt = String(args?.prompt || '').trim();
    if (!prompt) { args.response = ''; return; }
    try {
      if (prompt === 'Summarize this document') {
        await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 10)));
        const documentContent = await this.summarizer.getDocumentText(this.containerRef);
        const summaryHtml = await this.ai.getAzureChatAIRequest({
          messages: [
            { role: 'system', content: 'You are a helpful assistant. Your task is to analyze the provided text and generate short summary. Always respond in proper HTML format, but do not include <html>, <head>, or <body> tags.' },
            { role: 'user', content: documentContent }
          ],
          model: 'gpt-4'
        });
        args.response = summaryHtml || '<p>No summary available.</p>';
        (this.assistInstance as any).addPromptResponse(args.response);
        const suggestionsRaw = await this.ai.getAzureChatAIRequest({
          messages: [
            { role: 'system', content: 'You are a helpful assistant. Your task is to analyze the provided text and generate 3 short diverse questions and each question should not exceed 10 words' },
            { role: 'user', content: documentContent }
          ],
          model: 'gpt-4'
        });
        if (suggestionsRaw) {
          const next = suggestionsRaw.split(/\d+\.\s*/).filter((x: string) => x.trim() !== '').map((text: string, index: number) => `${index + 1}. ${text.trim()}`);
          if (next.length) this.aiSuggestions = next;
        }
      } else {
        await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 10)));
        const answerHtml = await this.ai.getAzureChatAIRequest({
          messages: [
            { role: 'system', content: 'You are a helpful assistant. Use the provided context to answer the user question. Always respond in proper HTML format, but do not include <html>, <head>, or <body> tags. Context:' },
            { role: 'user', content: prompt }
          ],
          model: 'gpt-4'
        });
        args.response = String(answerHtml ?? '<p>No answer.</p>');
        (this.assistInstance as any).addPromptResponse(args.response);
      }
    } catch (e: any) {
      args.response = `<p class="aiassist-error">AI error: ${e?.message || e}</p>`;
    }
  }

  async responseToolbarItemClicked(e: any): Promise<void> {
    const idx = typeof e?.dataIndex === 'number' ? e.dataIndex : ((this.assistInstance as any)?.prompts?.length ?? 1) - 1;
    const resHtml = (this.assistInstance as any)?.prompts?.[idx]?.response ?? '';
    if (!resHtml) return;
    const tmp = document.createElement('div');
    tmp.innerHTML = resHtml;
    const plainText = (tmp.innerText || '').trim();
    const tip = (e?.item?.tooltip || '').toLowerCase();
    if (tip === 'copy') {
      if (navigator.clipboard && (window as any).ClipboardItem) {
        const blobHtml = new Blob([resHtml], { type: 'text/html' });
        const blobText = new Blob([plainText], { type: 'text/plain' });
        await navigator.clipboard.write([new (window as any).ClipboardItem({ 'text/html': blobHtml, 'text/plain': blobText })]);
      } else {
        await navigator.clipboard?.writeText(plainText);
      }
    } else if (tip === 'insert') {
      const editor = this.containerRef?.documentEditor?.editor;
      if (editor && plainText) editor.insertText(plainText);
    }
  }
}
