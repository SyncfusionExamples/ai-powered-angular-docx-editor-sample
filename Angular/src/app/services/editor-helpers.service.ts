import { Injectable } from '@angular/core';

/**
 * Registers the same global window helper functions used by the React version's
 * editor-helpers.js. These functions read DOM positions of the DocumentEditor
 * viewer, the AI assist button, and various rulers to position the AI popups.
 */
@Injectable({ providedIn: 'root' })
export class EditorHelpersService {
  private registered = false;

  /** Call once at app startup to attach helpers to the window. */
  register(): void {
    if (this.registered) return;
    this.registered = true;
    const w = window as any;

    w.getAIAssistBtnPosition = function () {
      const documnetEditor = document.querySelector('.control-section');
      if (!documnetEditor) return;
      const documnetEditorRect = (documnetEditor as HTMLElement).getBoundingClientRect();
      const documnetEditorTop = documnetEditorRect.top;
      const documnetEditorLeft = documnetEditorRect.left;
      const viewerContainer = document.querySelector('#document-editor_editor_viewerContainer');
      if (!viewerContainer) return;
      const viewerContainerRect = (viewerContainer as HTMLElement).getBoundingClientRect();
      const viewerContainerTop = viewerContainerRect.top;
      const viewerContainerLeft = viewerContainerRect.left;
      const cursor = document.querySelector('.e-de-blink-cursor') as HTMLElement;
      if (!cursor) return;
      const cursorRect = cursor.getBoundingClientRect();
      const cursorTop = cursor.style.display === 'none' ? parseInt(cursor.style.top.split('px')[0], 10) : cursorRect.top;
      const viewercontainer = document.querySelector('#document-editor_editor_viewerContainer .e-de-hRuler .e-de-hRuler') as HTMLElement;
      if (!viewercontainer) return;
      const rulerLeft = parseInt(viewercontainer.style.marginLeft.split('px')[0], 10);
      const viewercontainerWidth = (document.querySelector('.e-de-hRuler .e-de-hRuler') as HTMLElement).offsetWidth;
      if (!viewercontainerWidth && viewercontainerWidth !== 0) return;
      const AiButtonPosition = viewercontainerWidth / 20;
      const markIndicator = document.querySelector('#document-editor_editor_markIndicator');
      const vRuleIndicator = document.querySelector('#document-editor_editor_vRulerBottom');
      if (!markIndicator || !vRuleIndicator) return;
      const markIndicatorRect = (markIndicator as HTMLElement).getBoundingClientRect().top;
      const vRuleIndicatorRect = (vRuleIndicator as HTMLElement).getBoundingClientRect().top;
      const scrollDifference = markIndicatorRect - vRuleIndicatorRect;
      const y = cursor.style.display === 'none' ? (viewerContainerTop - documnetEditorTop) + cursorTop - scrollDifference : cursorTop - documnetEditorTop;
      const x = (viewerContainerLeft - documnetEditorLeft) + rulerLeft + AiButtonPosition;
      return { x, y };
    };

    w.getAIChatBtnPosition = function () {
      const documnetEditor = document.querySelector('#document-editor');
      if (!documnetEditor) return;
      const documnetEditorRect = (documnetEditor as HTMLElement).getBoundingClientRect();
      const documnetEditorHeight = documnetEditorRect.height;
      const documnetEditorWidth = documnetEditorRect.width;
      return { x: documnetEditorWidth - 87, y: documnetEditorHeight - 81 };
    };

    w.setAiAssistBtnPosition = function (x: number, y: number) {
      const el = document.getElementsByClassName('ai-chat-btn')[0] as HTMLElement;
      if (!el) return;
      el.style.position = 'absolute';
      el.style.left = x + 'px';
      el.style.top = y + 'px';
    };

    w.getAIAssistPopupPosition = function () {
      const aiButton = document.getElementsByClassName('ai-assist-btn')[0] as HTMLElement;
      if (!aiButton) return { x: 200, y: 160 };
      const bRect = aiButton.getBoundingClientRect();
      const sampleMargin = 8;
      return { x: bRect.left - sampleMargin, y: (bRect.top + bRect.height) - sampleMargin };
    };

    w.setDialogDivHeight = (mode: string) => {
      const q = document.getElementById('e-de-qus-pane');
      const ans = document.getElementById('e-de-editableDiv');
      if (!ans) return;
      if (mode === 'Generate') ans.style.height = '100px';
      else { if (q) q.style.height = '75px'; ans.style.height = '75px'; }
    };

    w.getTextContent = () => {
      const el = document.getElementById('e-de-editableDiv');
      return el ? (el.textContent || '').trim() : '';
    };

    w.getInputContent = () => {
      const el = document.getElementById('e-de-editableDiv') as HTMLInputElement;
      return el ? (el.value || '').trim() : '';
    };

    w.getHtmlContent = () => {
      const el = document.getElementById('e-de-editableDiv');
      return el ? el.innerHTML : '';
    };

    w.setTextContent = (text: string) => {
      const el = document.getElementById('e-de-editableDiv');
      if (el) el.textContent = text || '';
    };

    w.setHtmlContent = (html: string) => {
      const el = document.getElementById('e-de-editableDiv');
      if (el) el.innerHTML = html || '';
    };

    w.clearDivContent = () => {
      const el = document.getElementById('e-de-editableDiv');
      if (el) el.innerHTML = '';
    };

    w.setPlaceholder = (placeholderText: string) => {
      const el = document.getElementById('e-de-editableDiv');
      if (el && (el.innerText || '').trim() === '') {
        el.innerText = placeholderText || '';
        el.classList.add('placeHoldr');
      }
    };

    w.removePlaceholder = (placeholderText: string) => {
      const el = document.getElementById('e-de-editableDiv');
      if (!el) return;
      if (el.innerText === placeholderText) {
        el.innerText = '';
        el.classList.remove('placeHoldr');
      }
    };

    w.getAIButtonPosition = function () {
      const matches = document.getElementsByClassName('e-control e-btn ai-assist-btn e-fab');
      console.log('[editor-helpers] getAIButtonPosition → matches.length =', matches.length, 'first =', matches[0] || null);
      const aiButton = matches[0] as HTMLElement;
      if (!aiButton) return;
      const aiButtonRect = aiButton.getBoundingClientRect();
      return { x: aiButtonRect.left, y: aiButtonRect.top };
    };

    w.toggleSendIcon = function (isEnabled: boolean) {
      const sendElement = document.querySelector('.ai-assist-dialog .e-icons.e-send') as HTMLElement;
      if (sendElement) {
        if (isEnabled) sendElement.classList.remove('e-disabled');
        else sendElement.classList.add('e-disabled');
      }
    };

    w.getGeneratingDraftPosition = function () {
      const aiButton = document.getElementsByClassName('e-control ai-assist-btn e-fab')[0] as HTMLElement;
      if (!aiButton) return;
      const aiButtonRect = aiButton.getBoundingClientRect();
      const aiButtonLeft = aiButtonRect.left;
      const aiButtonTop = aiButtonRect.top;
      const documnetEditor = document.querySelector('.control-section');
      if (!documnetEditor) return;
      const documnetEditorRect = (documnetEditor as HTMLElement).getBoundingClientRect();
      const documnetEditorTop = documnetEditorRect.top;
      const sampleMargin = 8;
      return { x: aiButtonLeft - sampleMargin, y: aiButtonTop - documnetEditorTop };
    };

    w.setGeneratingDraftPosition = function (x: number, y: number) {
      const element = document.getElementsByClassName('e-stop-generating-dialog')[0] as HTMLElement;
      if (element) {
        element.style.position = 'absolute';
        element.style.left = x + 'px';
        element.style.top = y + 'px';
      }
    };

    w.showGeneratingDraft = function (isShow: boolean) {
      const stopPopupElement = document.querySelector('.e-stop-generating-dialog') as HTMLElement;
      if (stopPopupElement) {
        stopPopupElement.style.display = isShow ? 'block' : 'none';
      }
    };

    w.setAIAssistBtnIconSize = function (AIAssistBtnIconSize: number) {
      const iconElement = document.querySelector('.ai-assist-btn .e-icons.e-ai-assist-btn') as HTMLElement;
      if (iconElement) {
        iconElement.style.fontSize = AIAssistBtnIconSize + 'px';
        iconElement.style.height = AIAssistBtnIconSize + 'px';
        iconElement.style.width = AIAssistBtnIconSize + 'px';
        iconElement.style.lineHeight = (AIAssistBtnIconSize + 1) + 'px';
      }
    };

    w.getRegeneratePopupPosition = function () {
      const statusBar = document.querySelector('.e-de-status-bar');
      if (!statusBar) return;
      const statusBarRect = (statusBar as HTMLElement).getBoundingClientRect();
      const statusBarTop = statusBarRect.top;
      const regeneratePopupHeight = 175;
      const sampleMargin = 8;
      return { x: 130, y: (statusBarTop - regeneratePopupHeight) - sampleMargin };
    };
  }
}
