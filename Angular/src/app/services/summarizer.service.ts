import { Injectable } from '@angular/core';

async function run(fullPrompt: string, options: any = {}): Promise<string> {
  if (!(window as any)?.AIBrowser?.generateTextRaw) {
    return '<p>Browser AI is not available.</p>';
  }
  const out = await (window as any)?.AIBrowser?.generateTextRaw(fullPrompt, options);
  return typeof out === 'string' ? out : String((out as any) ?? '');
}

@Injectable({ providedIn: 'root' })
export class SummarizerService {
  async getAnswer(systemPrompt: string, question: string): Promise<string> {
    return await run(systemPrompt, {
      max_new_tokens: 256,
      temperature: 0.45,
      top_k: 50,
      top_p: 0.95,
      repetition_penalty: 1.1
    });
  }

  async getDocumentText(editorRef: any): Promise<string> {
    const de = editorRef.documentEditor;
    const sel = de.selection;
    const start = sel.startOffset;
    const end = sel?.endOffset;
    de.selection.selectAll();
    const text = de.selection.text;
    de.selection.select(start, end);
    return text;
  }

  async getDocumentSummary(editorRef: any): Promise<string> {
    const documentText = await this.getDocumentText(editorRef);
    const prompt = `Summarize: ${documentText}`;
    return await run(prompt, { max_new_tokens: 220, temperature: 0.35 });
  }

  async getSuggestions(editorRef: any): Promise<string> {
    const documentText = await this.getDocumentText(editorRef);
    const prompt =
      `list 3 short follow-up questions a user might ask about this text, one per line:\n${documentText}\nReturn only the 3 lines.`;
    return await run(prompt, { max_new_tokens: 80, temperature: 0.6 });
  }
}
