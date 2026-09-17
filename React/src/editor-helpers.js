window.getAIAssistBtnPosition = function () {
  var documnetEditor = document.querySelector(".control-section");
  if (!documnetEditor) {
    return;
  }
  var documnetEditorRect = documnetEditor.getBoundingClientRect();
  var documnetEditorTop = documnetEditorRect.top;
  var documnetEditorLeft = documnetEditorRect.left;
  var viewerContainer = document.querySelector("#document-editor_editor_viewerContainer");
  if (!viewerContainer) {
    return;
  }
  var viewerContainerRect = viewerContainer.getBoundingClientRect();
  var viewerContainerTop = viewerContainerRect.top;
  var viewerContainerLeft = viewerContainerRect.left;
  var cursor = document.querySelector('.e-de-blink-cursor');
  if (!cursor) {
    return;
  }
  var cursorRect = cursor.getBoundingClientRect();
  var cursorTop = cursor.style.display === 'none' ? parseInt(cursor.style.top.split("px")[0], 10) : cursorRect.top;
  var viewercontainer = document.querySelector("#document-editor_editor_viewerContainer .e-de-hRuler .e-de-hRuler");
  if (!viewercontainer) {
    return;
  }
  var rulerLeft = parseInt(viewercontainer.style.marginLeft.split("px")[0], 10);
  var viewercontainerWidth = document.querySelector(".e-de-hRuler .e-de-hRuler").offsetWidth;
  if (!viewercontainerWidth && viewercontainerWidth !== 0) {
    return;
  }
  var AiButtonPosition = viewercontainerWidth / 20;
  var markIndicator = document.querySelector("#document-editor_editor_markIndicator");
  var vRuleIndicator = document.querySelector("#document-editor_editor_vRulerBottom");
  if (!markIndicator || !vRuleIndicator) {
    return;
  }
  var markIndicatorRect = markIndicator.getBoundingClientRect().top;
  var vRuleIndicatorRect = vRuleIndicator.getBoundingClientRect().top;
  var scrollDifference = markIndicatorRect - vRuleIndicatorRect;

  var y = cursor.style.display === 'none' ? ((viewerContainerTop - documnetEditorTop) + cursorTop) - scrollDifference : (cursorTop - documnetEditorTop);
  var x = (viewerContainerLeft - documnetEditorLeft) + rulerLeft + AiButtonPosition;
  return { x: x, y: y };
};

window.getAIChatBtnPosition = function () {
  var documnetEditor = document.querySelector("#document-editor");
  if (!documnetEditor) {
    return;
  }
  var documnetEditorRect = documnetEditor.getBoundingClientRect();
  var documnetEditorHeight = documnetEditorRect.height;
  var documnetEditorWidth = documnetEditorRect.width;
  var x = documnetEditorWidth - 87;
  var y = documnetEditorHeight - 81;
  return { x: x, y: y };
};

window.setAiAssistBtnPosition = function (x, y) {
  var el = document.getElementsByClassName('ai-chat-btn')[0];
  if (!el) return;
  el.style.position = 'absolute';
  el.style.left = x + 'px';
  el.style.top = y + 'px';
};
window.getAIAssistPopupPosition = function () {
  var aiButton = document.getElementsByClassName('ai-assist-btn')[0];
  if (!aiButton) return { x: 200, y: 160 };
  var bRect = aiButton.getBoundingClientRect();
  var sampleMargin = 8;
  return { x: bRect.left - sampleMargin, y: (bRect.top + bRect.height) - sampleMargin };
};

window.setDialogDivHeight = (mode) => {
  var q = document.getElementById('e-de-qus-pane');
  var ans = document.getElementById('e-de-editableDiv');
  if (!ans) return;
  if (mode === 'Generate') ans.style.height = '100px';
  else { if (q) q.style.height = '75px'; ans.style.height = '75px'; }
};
window.getTextContent = () => {
  var el = document.getElementById('e-de-editableDiv');
  return el ? (el.textContent || '').trim() : '';
};
window.getInputContent = () => {
  var el = document.getElementById('e-de-editableDiv');
  return el ? (el.value || '').trim() : '';
};
window.getHtmlContent = () => {
  var el = document.getElementById('e-de-editableDiv');
  return el ? el.innerHTML : '';
};
window.setTextContent = (text) => {
  var el = document.getElementById('e-de-editableDiv');
  if (el) el.textContent = text || '';
};
window.setHtmlContent = (html) => {
  var el = document.getElementById('e-de-editableDiv');
  if (el) el.innerHTML = html || '';
};
window.clearDivContent = () => {
  var el = document.getElementById('e-de-editableDiv');
  if (el) el.innerHTML = '';
};
window.setPlaceholder = (placeholderText) => {
  var el = document.getElementById('e-de-editableDiv');
  if (el && (el.innerText || '').trim() === '') {
    el.innerText = placeholderText || '';
    el.classList.add('placeHoldr');
  }
};
window.removePlaceholder = (placeholderText) => {
  var el = document.getElementById('e-de-editableDiv');
  if (!el) return;
  if (el.innerText === placeholderText) {
    el.innerText = '';
    el.classList.remove('placeHoldr');
  }
};


window.getAIButtonPosition = function () {
  var aiButton = document.getElementsByClassName('e-control e-btn ai-assist-btn e-fab')[0];
  if (!aiButton) {
    return;
  }
  var aiButtonRect = aiButton.getBoundingClientRect();
  var x = aiButtonRect.left;
  var y = aiButtonRect.top;
  return { x: x, y: y };
}

window.toggleSendIcon = function (isEnabled) {
  const sendElement = document.querySelector(".ai-assist-dialog .e-icons.e-send");
  if (sendElement) {
    if (isEnabled) {
      sendElement.classList.remove('e-disabled');
    } else {
      sendElement.classList.add('e-disabled');
    }
  }
};


window.getGeneratingDraftPosition = function () {
  var aiButton = document.getElementsByClassName('e-control ai-assist-btn e-fab')[0];
  if (!aiButton) {
    return;
  }
  var aiButtonRect = aiButton.getBoundingClientRect();
  var aiButtonLeft = aiButtonRect.left;
  var aiButtonTop = aiButtonRect.top;
  var documnetEditor = document.querySelector(".control-section");
  if (!documnetEditor) {
    return;
  }
  var documnetEditorRect = documnetEditor.getBoundingClientRect();
  var documnetEditorTop = documnetEditorRect.top;
  var sampleMargin = 8;
  var x = aiButtonLeft - sampleMargin;
  var y = aiButtonTop - documnetEditorTop;
  return { x: x, y: y };
}

window.setGeneratingDraftPosition = function (x, y) {
  var element = document.getElementsByClassName('e-stop-generating-dialog')[0];
  if (element) {
    element.style.position = 'absolute';
    element.style.left = x + 'px';
    element.style.top = y + 'px';
  }
};
window.showGeneratingDraft = function (isShow) {
  var stopPopupElement = document.querySelector('.e-stop-generating-dialog');
  if (stopPopupElement) {
    if (isShow) {
      stopPopupElement.style.display = "block";
    }
    else {
      stopPopupElement.style.display = "none";
    }
  }
}

window.setAIAssistBtnIconSize = function (AIAssistBtnIconSize) {
  var iconElement = document.querySelector(".ai-assist-btn .e-icons.e-ai-assist-btn");
  if (iconElement) {
    iconElement.style.fontSize = AIAssistBtnIconSize + "px";
    iconElement.style.height = AIAssistBtnIconSize + "px";
    iconElement.style.width = AIAssistBtnIconSize + "px";
    iconElement.style.lineHeight = (AIAssistBtnIconSize + 1) + "px";
  }
}

window.getRegeneratePopupPosition = function () {
  var statusBar = document.querySelector(".e-de-status-bar");
  if (!statusBar) {
    return;
  }
  var statusBarRect = statusBar.getBoundingClientRect();
  var statusBarTop = statusBarRect.top;
  var regeneratePopupHeight = 175;
  var sampleMargin = 8;
  var x = 130;
  var y = (statusBarTop - regeneratePopupHeight) - sampleMargin;
  return { x: x, y: y };
}