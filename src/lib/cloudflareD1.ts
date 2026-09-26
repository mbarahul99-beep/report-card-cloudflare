import { FullSchoolData, SaasSchool } from '../types';

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
 * Synchronizes school report card data with Cloudflare D1 serverless database via Pages Functions.
 */
export class CloudflareD1Service {
  private static apiBase = '/api';

  /**
   * Save complete school payload to Cloudflare D1
   */
  public static async saveSchool(schoolId: string, payload: FullSchoolData): Promise<D1SyncResponse> {
    const cleanId = schoolId.replace(/[^a-zA-Z0-9_-]/g, '_');
    try {
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
      console.warn(`[Cloudflare D1] Primary sync failed for ${schoolId}, retrying fallback:`, err.message);
      
      try {
        const fallbackRes = await fetch(`/api/sync-school/${cleanId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        return await fallbackRes.json();
      } catch (fallbackErr: any) {
        throw new Error(`Cloudflare D1 sync failed: ${err.message}`);
      }
    }
  }

  /**
   * Fetch complete school payload from Cloudflare D1
   */
  public static async getSchool(schoolId: string): Promise<FullSchoolData | null> {
    const cleanId = schoolId.replace(/[^a-zA-Z0-9_-]/g, '_');
    try {
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
      console.warn(`[Cloudflare D1] Fetch failed for ${schoolId}:`, err.message);
      return null;
    }
  }

  /**
   * Fetch all registered schools from Cloudflare D1
   */
  public static async getAllSchools(): Promise<SaasSchool[]> {
    try {
      const response = await fetch(`${this.apiBase}/schools`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });
      if (response.ok) {
        const res = await response.json();
        if (res.success && Array.isArray(res.schools)) {
          return res.schools;
        }
      }
    } catch (err: any) {
      console.warn(`[Cloudflare D1] Fetch all schools failed:`, err.message);
    }
    return [];
  }

  /**
   * Save SaaS school metadata to Cloudflare D1
   */
  public static async saveSaaSSchool(school: SaasSchool): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiBase}/schools`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ school }),
      });
      return response.ok;
    } catch (err: any) {
      console.warn(`[Cloudflare D1] Save SaaS school failed:`, err.message);
      return false;
    }
  }

  /**
   * Delete school from Cloudflare D1
   */
  public static async deleteSchool(schoolId: string): Promise<boolean> {
    try {
      const cleanId = schoolId.replace(/[^a-zA-Z0-9_-]/g, '_');
      const response = await fetch(`${this.apiBase}/sync-school/${cleanId}`, {
        method: 'DELETE',
      });
      return response.ok;
    } catch (err: any) {
      console.warn(`[Cloudflare D1] Delete school failed:`, err.message);
      return false;
    }
  }
}
