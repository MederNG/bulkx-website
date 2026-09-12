import type { NextRequest } from "next/server";

const GITHUB_REPO = "MakerBuild/aurabulk";
const GITHUB_API = "https://api.github.com";

/** Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` — refuse anything else in production. */
export function isAuthorizedCronRequest(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

function githubHeaders(token: string): Record<string, string> {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

export interface DispatchResult {
  ok: boolean;
  status: number;
  detail?: string;
}

/** Fire a repository_dispatch event so the matching GitHub Action picks the work up. */
export async function dispatchRepositoryEvent(
  token: string,
  event: string,
): Promise<DispatchResult> {
  const res = await fetch(`${GITHUB_API}/repos/${GITHUB_REPO}/dispatches`, {
    method: "POST",
    headers: { ...githubHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ event_type: event }),
  });

  if (res.status === 204) return { ok: true, status: res.status };
  return { ok: false, status: res.status, detail: await res.text() };
}

/**
 * Creation timestamp of the newest successful run of `workflow`, or null when there
 * is none — and also when the lookup itself fails, so a backup trigger errs towards
 * firing rather than silently skipping a refresh.
 */
export async function lastSuccessfulRunAt(
  token: string,
  workflow: string,
): Promise<string | null> {
  try {
    const res = await fetch(
      `${GITHUB_API}/repos/${GITHUB_REPO}/actions/workflows/${workflow}/runs?status=success&per_page=1`,
      { headers: githubHeaders(token) },
    );
    if (!res.ok) return null;

    const body = (await res.json()) as { workflow_runs?: { created_at?: string }[] };
    return body.workflow_runs?.[0]?.created_at ?? null;
  } catch {
    return null;
  }
}
