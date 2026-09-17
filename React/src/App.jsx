import React, { useRef, useEffect, useState, useCallback } from 'react';
import { DocumentEditorContainerComponent, Ribbon } from '@syncfusion/ej2-react-documenteditor';
import { TitleBar } from './title-bar.jsx';
import { UploaderComponent } from '@syncfusion/ej2-react-inputs';
import { ButtonComponent } from '@syncfusion/ej2-react-buttons';
import { AIAssistViewComponent, ViewsDirective, ViewDirective } from '@syncfusion/ej2-react-interactive-chat';
import { getDocumentText } from './summarizer';
import AIPopup from './AIPopup.jsx';
import './editor-helpers.js';
import './App.css';
import { L10n } from "@syncfusion/ej2-base";
import { getAzureChatAIRequest } from './ai-models';

DocumentEditorContainerComponent.Inject(Ribbon);

L10n.load({
  'en-US': {
    uploader: {
      dropFilesHint: "or drop file here"
    }
  }
});

const SERVICE_URL = 'http://localhost:62869/api/DocumentEditor/';
const UPLOADER_SAVE_URL = 'https://services.syncfusion.com/react/production/api/FileUploader/Save';
const UPLOADER_REMOVE_URL = 'https://services.syncfusion.com/react/production/api/FileUploader/Remove';

export const App = () => {
  let container = useRef(null);
  const uploaderRef = useRef(null);
  let titleBar;
  let documentName = "New Document";
  const assistInstance = useRef(null);
  const [initialized, setInitialized] = useState(false);
  const [openChat, setOpenChat] = useState(false);
  const [isAIEnabled, setIsAIEnabled] = useState(false);
  const [assistBtnPos, setAssistBtnPos] = useState({
    left: 80,
    top: 160,
    width: 24,
    height: 24
  });
  const [aiSuggestions, setAiSuggestions] = useState(['Summarize this document']);

  const onZoomFactorChange = useCallback(() => {
    const editor = container.current?.documentEditor;
    if (!editor) return;
    setTimeout(() => {
      editor.focusIn();
      const zoom = editor.zoomFactor;
      const pos = window.getAIAssistBtnPosition?.();
      if (pos) {
        setAssistBtnPos({
          left: Math.round(pos.x),
          top: Math.round(pos.y),
          width: Math.round(24 * zoom),
          height: Math.round(24 * zoom)
        });
      }
      window.setAiAssistBtnIconSize?.(Math.round(14 * zoom));
    }, 10);
  }, []);

  useEffect(() => {
    container.current?.documentEditor?.resize?.();
    container.current?.ribbon?.ribbon?.refreshLayout?.();
    onZoomFactorChange();
  }, [openChat, onZoomFactorChange]);

  useEffect(() => {
    if (!isAIEnabled) {
      setOpenChat(false);
    }
  }, [isAIEnabled]);

  const onLoadDefault = () => {
    const editor = container.current?.documentEditor;
    if (editor) {
      editor.documentName = documentName;
      if (titleBar) {
        titleBar.updateDocumentTitle();
      }
      container.current.documentChange = () => {
        if (titleBar) {
          titleBar.updateDocumentTitle();
        }
        editor.focusIn();
      };
    }
  };

  const openNewDocument = useCallback(() => {
    setInitialized(true);
    documentName = "New Document";
  }, []);

  const onContainerCreated = useCallback(() => {
    const editor = container.current?.documentEditor;
    if (!editor) return;
    try { editor.focusIn(); } catch { }
    setTimeout(() => {
      try {
        const pos = window?.getAIAssistBtnPosition?.();
        if (!pos) return;
        setAssistBtnPos(prev => ({
          ...prev,
          left: Math.round(pos.x),
          top: Math.round(pos.y),
          width: 24,
          height: 24
        }));
      } catch { }
    }, 10);
    window.onbeforeunload = function () {
      return "Want to save your changes?";
    };
    editor.zoomFactorChange = () => {
      onZoomFactorChange();
    };
    editor.pageOutline = "#E0E0E0";
    editor.acceptTab = true;
    container.current.documentEditorSettings.showRuler = true;
    editor.resize();
    titleBar = new TitleBar(
      document.getElementById("documenteditor_titlebar"),
      editor,
      true,
      null,
      goBackToUploadPage,
      (checked) => {
        setIsAIEnabled(checked);
      }
    );
    onLoadDefault();
    let spellChecker = editor.spellChecker;
    spellChecker.languageID = 1033;
    spellChecker.removeUnderline = false;
    spellChecker.allowSpellCheckAndSuggestion = true;
    window.addEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const onResize = () => {
    onZoomFactorChange();
  }

  const goBackToUploadPage = useCallback(() => {
    const editor = container.current?.documentEditor;
    try {
      if (editor) {
        editor.showRevisions = false;
        editor.destroy();
        setIsAIEnabled(false);
      }
    } catch { }
    setInitialized(false);
  }, []);

  const onFileSelected = useCallback(async (args) => {
    const files = args.filesData || [];
    if (!files.length) return;
    const file = files[0]?.rawFile;
    if (!file) return;
    setInitialized(true);
    documentName = files[0].name ? files[0].name.split("." + files[0].type)[0] : 'Untitled Document';
    try {
      const formData = new FormData();
      formData.append('files', file, file.name);
      const response = await fetch(`${SERVICE_URL}Import`, {
        method: 'POST',
        body: formData
      });
      if (!response.ok) {
        throw new Error(`Import failed: ${response.statusText}`);
      }
      const sfdt = await response.text();
      setTimeout(() => {
        const editor = container.current?.documentEditor;
        if (editor) {
          editor.open(sfdt);
        }
      }, 0);
    } catch (err) {
      alert('Failed to import and open the document.');
    }
  }, []);

  const onUploaderCreated = () => {
    const browseBtn = document.querySelector('.e-file-select-wrap .e-btn');
    if (browseBtn && !browseBtn.querySelector('.e-btn-icon')) {
      const icon = document.createElement('span');
      icon.className = 'e-btn-icon e-icons e-fe-upload';
      browseBtn.insertBefore(icon, browseBtn.firstChild);
    }
  };

  const showChatPane = () => {
    setOpenChat(true);
    setAiSuggestions(['Summarize this document']);
  }

  const chatPanelCreated = () => {
    assistInstance.current.toolbarSettings.itemClicked = (args) => {
      const itemClass = String(args?.item?.iconCss || '');
      if (itemClass.includes('e-close')) {
        setOpenChat(false);
        document.querySelector('.e-fab.ai-assist-btn')?.classList.remove('e-hide');
        document.querySelector('.document-editor-container')?.classList.remove('e-hide');
      }
    };
    setAiSuggestions(['Summarize this document']);
  }

  return (
    <div className='control-pane'>
      <div className='control-section row uploadpreview'>
        <div className='col-lg-9'>
          {!initialized ? (
            <div className="uploader-page">
              <div className="upload-wrapper">
                <UploaderComponent
                  id="fileUpload"
                  ref={uploaderRef}
                  locale="en-US"
                  allowedExtensions=".doc,.docx,.rtf"
                  multiple={false}
                  showFileList={false}
                  autoUpload={false}
                  buttons={{ browse: 'Upload a File' }}
                  asyncSettings={{ saveUrl: UPLOADER_SAVE_URL, removeUrl: UPLOADER_REMOVE_URL }}
                  selected={onFileSelected}
                  created={onUploaderCreated}
                />
              </div>
              <div className="create-new-button-section">
                <ButtonComponent
                  cssClass="create-new-button e-primary"
                  iconCss="e-btn-sb-icons e-new-icons e-icons e-plus"
                  onClick={openNewDocument}
                >
                  Create New Document
                </ButtonComponent>
              </div>
            </div>
          ) : (
            <div className="editor-container" id="main-container" style={{ position: 'relative' }}>
              <div className="title-bar-section">
                <div id='documenteditor_titlebar' className="e-de-ctn-title"></div>
              </div>
              <div id='document-editor-page'>
                <div id='documentEditorDiv' className='document-editor-container' style={{ height: `calc(100vh - 53px)`, width: openChat ? '65%' : '100%', float: 'left' }}>
                  <DocumentEditorContainerComponent
                    id="document-editor"
                    ref={container}
                    height="100%"
                    serviceUrl={SERVICE_URL}
                    enableToolbar={true}
                    toolbarMode='Ribbon'
                    enableSpellCheck={true}
                    created={onContainerCreated}
                  />
                  <AIPopup editorRef={container} onShowChatPane={showChatPane} chatOpen={openChat} assistInitialPos={assistBtnPos} isAIEnabled={isAIEnabled} />
                </div>
                {openChat && (
                  <div
                    className="ai-chat-container"
                    style={{
                      width: '35%',
                      float: 'right',
                      height: `calc(100vh - 53px)`,
                      position: 'relative',
                      display: 'block'
                    }}
                  >
                    <AIAssistViewComponent
                      ref={assistInstance}
                      cssClass="e-aiassist-chat"
                      promptPlaceholder="Type a question"
                      promptSuggestions={aiSuggestions}
                      promptIconCss="e-icons e-aiassist-chat-icon"
                      responseIconCss="e-aiassist-chat-icon"
                      created={chatPanelCreated}
                      toolbarSettings={{
                        items: [{ iconCss: 'e-icons e-close', align: 'Right', tooltipText: 'Close' }]
                      }}
                      bannerTemplate={() =>
                        <div className="ai-assist-banner">
                          <div className="e-icons e-aiassist-page-icon"></div>
                          <div className="e-aiassist-page-header">How can I help you?</div>
                        </div>
                      }
                      promptRequest={async (args) => {
                        const prompt = String(args?.prompt || '').trim();
                        if (!prompt) { args.response = ''; return; }
                        try {
                          if (prompt === 'Summarize this document') {
                            await new Promise(resolve => {
                              requestAnimationFrame(() => setTimeout(resolve, 10));
                            });
                            const documentContent = await getDocumentText(container);
                            const options = {
                              messages: [
                                { role: "system", content: `You are a helpful assistant. Your task is to analyze the provided text and generate short summary. Always respond in proper HTML format, but do not include <html>, <head>, or <body> tags.` },
                                { role: "user", content: documentContent }
                              ],
                              model: "gpt-4",
                            };
                            const summaryHtml = await getAzureChatAIRequest(options);
                            args.response = summaryHtml || '<p>No summary available.</p>';
                            assistInstance.current.addPromptResponse(args.response);
                            const suggestionsRaw = await getAzureChatAIRequest({
                              messages: [
                                { role: "system", content: `You are a helpful assistant. Your task is to analyze the provided text and generate 3 short diverse questions and each question should not exceed 10 words` },
                                { role: "user", content: documentContent }
                              ],
                              model: "gpt-4",
                            });
                            if (suggestionsRaw) {
                              const next = (suggestionsRaw.split(/\d+\.\s*/).filter(x => x.trim() !== "")).map((text, index) => {
                                return `${index + 1}. ${text.trim()}`;
                              });
                              if (next.length) setAiSuggestions(next);
                            }
                          } else {

                            await new Promise(resolve => {
                              requestAnimationFrame(() => setTimeout(resolve, 10));
                            });

                            const options = {
                              messages: [
                                { role: "system", content: `You are a helpful assistant. Use the provided context to answer the user question. Always respond in proper HTML format, but do not include <html>, <head>, or <body> tags. Context:` },
                                { role: "user", content: prompt }
                              ],
                              model: "gpt-4",
                            };
                            const answerHtml = await getAzureChatAIRequest(options);
                            var response = String(answerHtml ?? '<p>No answer.</p>');
                            args.response = response;
                            assistInstance.current.addPromptResponse(response);
                          }
                        } catch (e) {
                          args.response = `<p class="aiassist-error">AI error: ${e?.message || e}</p>`;
                        }
                      }}
                      responseToolbarSettings={{
                        items: [
                          { iconCss: 'e-icons e-copy', tooltip: 'copy' },
                          { iconCss: 'e-btn-icon e-de-ctnr-new', tooltip: 'insert' }
                        ],
                        itemClicked: async (e) => {
                          const idx = typeof e?.dataIndex === 'number'
                            ? e.dataIndex
                            : (assistInstance.current?.prompts?.length ?? 1) - 1;
                          const resHtml = assistInstance.current?.prompts?.[idx]?.response ?? '';
                          if (!resHtml) return;
                          const tmp = document.createElement('div');
                          tmp.innerHTML = resHtml;
                          const plainText = (tmp.innerText || '').trim();
                          const tip = (e?.item?.tooltip || '').toLowerCase();
                          if (tip === 'copy') {
                            if (navigator.clipboard && window.ClipboardItem) {
                              const blobHtml = new Blob([resHtml], { type: 'text/html' });
                              const blobText = new Blob([plainText], { type: 'text/plain' });
                              await navigator.clipboard.write([
                                new ClipboardItem({
                                  'text/html': blobHtml,
                                  'text/plain': blobText
                                })
                              ]);
                            } else {
                              await navigator.clipboard?.writeText(plainText);
                            }
                          } else if (tip === 'insert') {
                            const editor = container?.current?.documentEditor?.editor;
                            if (editor && plainText) {
                              editor.insertText(plainText);
                            }
                          }
                        }
                      }}
                    >
                      <ViewsDirective>
                        <ViewDirective header="AI Assistant" iconCss="e-icons e-aiassist-chat-header" />
                      </ViewsDirective>
                    </AIAssistViewComponent>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;