async function run(fullPrompt, options = {}) {
  if (!window?.AIBrowser?.generateTextRaw) {
    return '<p>Browser AI is not available.</p>';
  }
  const out = await window?.AIBrowser?.generateTextRaw(fullPrompt, options);
  return typeof out === 'string' ? out : String(out ?? '');
}

export async function getAnswer(systemPrompt, question) {
  return await run(systemPrompt, {
    max_new_tokens: 256,
    temperature: 0.45,
    top_k: 50,
    top_p: 0.95,
    repetition_penalty: 1.1
  });
}

export async function getDocumentText(editorRef) {
  const de = editorRef.current.documentEditor;
  const sel = de.selection;
  const start = sel.startOffset;
  const end = sel?.endOffset;
  de.selection.selectAll();
  const text = de.selection.text;
  de.selection.select(start, end);
  return text;
}

export async function getDocumentSummary(editorRef) {
  const docuemntText = await getDocumentText(editorRef);
  const prompt =
    `Summarize: ${docuemntText}`;
  return await run(prompt, {
    max_new_tokens: 220,
    temperature: 0.35
  });
}

export async function getSuggestions(editorRef) {
  const docuemntText = await getDocumentText(editorRef);
  const prompt =
    `list 3 short follow-up questions a user might ask about this text, one per line:\n${docuemntText}\nReturn only the 3 lines.`;
  return await run(prompt, {
    max_new_tokens: 80,
    temperature: 0.6
  });
}