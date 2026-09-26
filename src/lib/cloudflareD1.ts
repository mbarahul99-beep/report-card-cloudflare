import { FullSchoolData } from './firebaseSync';

export interface D1SyncResponse {
  success: boolean;
  source?: string;
  savedAt?: string;
  data?: FullSchoolData;
  error?: string;
  message?: string;
}

/**
 * Cloudflare D1 Client Service
 * Synchronizes school report card data with Cloudflare D1 serverless database.
 */
export class CloudflareD1Service {
  private static apiBase = '/api/d1';

  /**
   * Save complete school payload to Cloudflare D1
   */
  public static async saveSchool(schoolId: string, payload: FullSchoolData): Promise<D1SyncResponse> {
    try {
      const cleanId = schoolId.replace(/[^a-zA-Z0-9_-]/g, '_');
      const response = await fetch(`${this.apiBase}/sync-school/${cleanId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`D1 Sync HTTP ${response.status}: ${errText}`);
      }

      const result: D1SyncResponse = await response.json();
      console.log(`[Cloudflare D1] Successfully synced school ${cleanId}:`, result);
      return result;
    } catch (err: any) {
      console.warn(`[Cloudflare D1] Save failed for ${schoolId}, attempting fallback:`, err.message);
      
      // Fallback to local server endpoint
      try {
        const fallbackRes = await fetch(`/api/sync-school/${schoolId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        return await fallbackRes.json();
      } catch (fallbackErr: any) {
        throw new Error(`Cloudflare D1 & Fallback sync failed: ${err.message}`);
      }
    }
  }

  /**
   * Fetch complete school payload from Cloudflare D1
   */
  public static async getSchool(schoolId: string): Promise<FullSchoolData | null> {
    try {
      const cleanId = schoolId.replace(/[^a-zA-Z0-9_-]/g, '_');
      const response = await fetch(`${this.apiBase}/sync-school/${cleanId}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`D1 Fetch HTTP ${response.status}`);
      }

      const result: D1SyncResponse = await response.json();
      if (result.success && result.data) {
        return result.data;
      }
      return null;
    } catch (err: any) {
      console.warn(`[Cloudflare D1] Fetch failed for ${schoolId}, trying fallback:`, err.message);
      
      // Fallback to standard server endpoint
      try {
        const fallbackRes = await fetch(`/api/sync-school/${schoolId}`);
        if (fallbackRes.ok) {
          const resJson = await fallbackRes.json();
          return resJson.data || null;
        }
      } catch {
        // ignore fallback error
      }
      return null;
    }
  }

  /**
   * Test connection to Cloudflare D1 database
   */
  public static async testHealth(): Promise<{ status: string; d1Configured: boolean; message: string }> {
    try {
      const res = await fetch(`${this.apiBase}/health`);
      if (res.ok) {
        return await res.json();
      }
      return { status: 'degraded', d1Configured: false, message: 'D1 endpoint returned non-200' };
    } catch (e: any) {
      return { status: 'offline', d1Configured: false, message: e.message };
    }
  }
}
