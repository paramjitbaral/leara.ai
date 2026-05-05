import axios from "axios";

export interface GitHubUserInfo {
  login: string;
  id: number;
  name?: string;
  avatar_url?: string;
  html_url?: string;
}

export async function validateGitHubToken(token: string): Promise<GitHubUserInfo> {
  const clean = (token || "").trim();
  if (!clean) {
    throw new Error("GitHub token is required.");
  }

  const res = await axios.get("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${clean}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "Leara-IDE",
    },
    timeout: 15000,
  });

  return res.data as GitHubUserInfo;
}

export function buildGitHubOAuthUrl(args: {
  clientId: string;
  state: string;
  redirectUri: string;
  scope?: string;
}): string {
  const { clientId, state, redirectUri, scope = "repo read:user" } = args;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope,
    state,
    allow_signup: "true",
  });
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

export async function exchangeGitHubOAuthCode(args: {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
}): Promise<string> {
  const { clientId, clientSecret, code, redirectUri } = args;

  const res = await axios.post(
    "https://github.com/login/oauth/access_token",
    {
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    },
    {
      headers: {
        Accept: "application/json",
        "User-Agent": "Leara-IDE",
      },
      timeout: 15000,
    }
  );

  const token = res.data?.access_token as string | undefined;
  if (!token) {
    const msg = res.data?.error_description || res.data?.error || "OAuth token exchange failed.";
    throw new Error(msg);
  }

  return token;
}
