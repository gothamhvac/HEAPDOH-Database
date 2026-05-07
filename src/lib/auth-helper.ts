import { createClient as createServerClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Get the current user's user_id and org_id, plus a service-role admin client.
 *
 * In production this requires a real Supabase session — unauthenticated calls
 * throw and the API route returns 401. The middleware also bounces signed-out
 * browsers to /login, so any API hit reaching here should already be signed in.
 *
 * In development, when DEV_AUTOLOGIN=true is set, falls back to the first
 * profile in the DB (or auto-creates a dev user) so you can iterate without
 * signing in. Never enabled in production.
 */
export async function getAuthContext() {
  const admin = createServiceClient();

  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await admin
        .from("profiles")
        .select("org_id")
        .eq("id", user.id)
        .single();

      if (profile) {
        return { userId: user.id, orgId: profile.org_id, admin };
      }
    }
  } catch {}

  // Production: refuse anything unauthenticated.
  if (process.env.NODE_ENV !== "development" || process.env.DEV_AUTOLOGIN !== "true") {
    throw new AuthRequiredError();
  }

  // ─── Dev autologin (opt-in via DEV_AUTOLOGIN=true) ─────────────────────────
  const { data: profile } = await admin
    .from("profiles")
    .select("id, org_id")
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (profile) {
    return { userId: profile.id, orgId: profile.org_id, admin };
  }

  const { data: existingOrg } = await admin
    .from("organizations")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  const orgId = existingOrg?.id || (await (async () => {
    const { data: org } = await admin
      .from("organizations")
      .insert({ name: "Dev Organization" })
      .select()
      .single();
    return org?.id;
  })());

  if (!orgId) throw new Error("Could not create dev org");

  const { data: authUser } = await admin.auth.admin.createUser({
    email: "dev@localhost.com",
    password: "devdev123",
    email_confirm: true,
  });

  if (!authUser?.user) throw new Error("Could not create dev user");

  await admin.from("profiles").insert({
    id: authUser.user.id,
    org_id: orgId,
    full_name: "Dev User",
    role: "owner",
  });

  return { userId: authUser.user.id, orgId: orgId, admin };
}

export class AuthRequiredError extends Error {
  constructor() {
    super("Not signed in");
    this.name = "AuthRequiredError";
  }
}
