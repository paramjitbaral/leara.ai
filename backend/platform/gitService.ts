import { simpleGit } from "simple-git";

interface GitRemoteInfo {
  name: string;
  fetch: string;
  push: string;
}

function toAuthRemoteUrl(remoteUrl: string, githubToken?: string): string {
  if (!githubToken) return remoteUrl;
  if (!/https:\/\/github\.com\//i.test(remoteUrl)) return remoteUrl;

  const clean = githubToken.trim();
  const stripped = remoteUrl.replace(/^https:\/\//i, "");
  return `https://x-access-token:${encodeURIComponent(clean)}@${stripped}`;
}

export async function gitStatus(projectRoot: string) {
  const git = simpleGit(projectRoot);
  const status = await git.status();
  return status;
}

export async function gitDiff(projectRoot: string, filePath?: string) {
  const git = simpleGit(projectRoot);
  if (filePath) return git.diff(["--", filePath]);
  return git.diff();
}

export async function gitRemotes(projectRoot: string): Promise<GitRemoteInfo[]> {
  const remotes = await simpleGit(projectRoot).getRemotes(true);
  return remotes.map((r) => ({
    name: r.name,
    fetch: r.refs.fetch || "",
    push: r.refs.push || "",
  }));
}

export async function gitSetRemote(projectRoot: string, name: string, url: string): Promise<void> {
  const git = simpleGit(projectRoot);
  const existing = await git.getRemotes(true);
  const found = existing.find((r) => r.name === name);
  if (found) {
    await git.remote(["set-url", name, url]);
  } else {
    await git.addRemote(name, url);
  }
}

export async function gitStage(projectRoot: string, paths: string[]) {
  const git = simpleGit(projectRoot);
  await git.add(paths.length ? paths : ["."]);
  return git.status();
}

export async function gitUnstage(projectRoot: string, paths: string[]) {
  const git = simpleGit(projectRoot);
  const target = paths.length ? paths : ["."];
  await git.reset(["HEAD", "--", ...target]);
  return git.status();
}

export async function gitDiscard(projectRoot: string, paths: string[]) {
  const git = simpleGit(projectRoot);
  const target = paths.length ? paths : ["."];
  await git.checkout(["--", ...target]);
  return git.status();
}

export async function gitCommit(projectRoot: string, message: string) {
  const git = simpleGit(projectRoot);
  const result = await git.commit(message || "Leara commit");
  return result;
}

export async function gitPush(projectRoot: string, remote = "origin", branch?: string, githubToken?: string) {
  const git = simpleGit(projectRoot);
  const localStatus = await git.status();
  const targetBranch = branch || localStatus.current || "main";

  let remoteRef = remote;
  if (githubToken) {
    const remotes = await git.getRemotes(true);
    const found = remotes.find((r) => r.name === remote);
    if (found?.refs?.push) {
      remoteRef = toAuthRemoteUrl(found.refs.push, githubToken);
    }
  }

  const result = await git.push(remoteRef, targetBranch);
  return result;
}

export async function gitPull(projectRoot: string, remote = "origin", branch?: string, githubToken?: string) {
  const git = simpleGit(projectRoot);
  const localStatus = await git.status();
  const targetBranch = branch || localStatus.current || "main";

  let remoteRef = remote;
  if (githubToken) {
    const remotes = await git.getRemotes(true);
    const found = remotes.find((r) => r.name === remote);
    if (found?.refs?.fetch) {
      remoteRef = toAuthRemoteUrl(found.refs.fetch, githubToken);
    }
  }

  const result = await git.pull(remoteRef, targetBranch);
  return result;
}

export async function gitBranches(projectRoot: string) {
  const git = simpleGit(projectRoot);
  return git.branchLocal();
}

export async function gitCheckout(projectRoot: string, branch: string, create = false) {
  const git = simpleGit(projectRoot);
  if (create) await git.checkoutLocalBranch(branch);
  else await git.checkout(branch);
  return git.branchLocal();
}

export async function gitStash(projectRoot: string, message?: string) {
  const git = simpleGit(projectRoot);
  const r = await git.stash(["push", "-m", message || "Leara stash"]);
  return { result: r };
}

export async function gitConflicts(projectRoot: string): Promise<string[]> {
  const status = await simpleGit(projectRoot).status();
  return status.conflicted || [];
}
