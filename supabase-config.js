// FamilyKYCManager - Supabase Cloud Configuration & Offline Fallback Manager

(function() {
    // Default / Placeholder Supabase Credentials
    // Replace these with your actual Supabase Project URL and Anon Key from https://supabase.com
    const SUPABASE_URL = window.ENV_SUPABASE_URL || "https://your-project-id.supabase.co";
    const SUPABASE_ANON_KEY = window.ENV_SUPABASE_ANON_KEY || "your-anon-key-here";

    window.SupabaseVaultConfig = {
        url: SUPABASE_URL,
        key: SUPABASE_ANON_KEY,
        isConfigured: function() {
            return this.url !== "https://your-project-id.supabase.co" && 
                   this.key !== "your-anon-key-here" &&
                   typeof supabase !== "undefined";
        },
        client: null,
        init: function() {
            if (this.isConfigured()) {
                try {
                    this.client = supabase.createClient(this.url, this.key);
                    console.log("🟢 [Supabase] Connected to Cloud Vault!");
                    return true;
                } catch (e) {
                    console.warn("⚠️ [Supabase] Client init failed, using Local Fallback Mode", e);
                    return false;
                }
            } else {
                console.log("ℹ️ [Supabase] Running in Standalone Local-First Mode (LocalStorage/IndexedDB)");
                return false;
            }
        }
    };
})();
