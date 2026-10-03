import { createClient } from "@supabase/supabase-js";

let integrationAdmin;

export const getIntegrationAdmin = () => {
  if (integrationAdmin) return integrationAdmin;
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  try {
    integrationAdmin = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    return integrationAdmin;
  } catch {
    return null;
  }
};

export const hasIntegrationAdmin = () => Boolean(getIntegrationAdmin());
