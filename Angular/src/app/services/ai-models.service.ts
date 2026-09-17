import { Injectable } from '@angular/core';

const API_BASE = 'http://localhost:62869/api/DocumentEditor';

@Injectable({ providedIn: 'root' })
export class AiModelsService {
  async getAzureChatAIRequest(options: any): Promise<string> {
    try {
      const response = await fetch(`${API_BASE}/Process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options)
      });

      if (!response.ok) {
        throw new Error(`API Error : ${response.status}`);
      }

      const result = await response.json();
      return result.Text;
    } catch (err) {
      console.error(err);
      return null;
    }
  }
}
