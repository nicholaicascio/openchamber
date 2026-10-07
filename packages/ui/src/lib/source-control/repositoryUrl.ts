import type { GitRemote } from '@/lib/api/types';
import { gitRemoteHost } from './identity';

const GITHUB_HOST = 'github.com';

/**
 * The owner/repo path a git remote points at, for `https://host/owner/repo.git`
 * and for the scp-like `git@host:owner/repo.git` alike.
 */
const remotePath = (remoteUrl: string): string | null => {
  const value = remoteUrl.trim();
  if (!value) return null;

  const scpLike = /^[^/@]+@[^/:]+:(.+)$/.exec(value);
  if (scpLike) return scpLike[1];

  try {
    return new URL(value).pathname.replace(/^\/+/, '');
  } catch {
    return null;
  }
};

/**
 * The browser URL for a GitHub remote, or null when the remote is not
 * `https://github.com/owner/repo` or `git@github.com:owner/repo`. Only
 * github.com is recognised: a GitLab or self-hosted GitHub Enterprise remote
 * has no canonical browser URL OpenChamber can assume.
 */
export const gitHubRepositoryUrl = (remoteUrl: string): string | null => {
  const value = remoteUrl.trim();
  if (!value || gitRemoteHost(value) !== GITHUB_HOST) return null;

  const path = remotePath(value);
  if (!path) return null;

  const segments = path.replace(/\.git$/i, '').replace(/\/+$/, '').split('/');
  if (segments.length !== 2 || !segments[0] || !segments[1]) return null;

  return `https://${GITHUB_HOST}/${segments[0]}/${segments[1]}`;
};

/**
 * The GitHub browser URL for a repository: `origin` first, then the first
 * remote that is on github.com. Each remote's fetch URL answers before its
 * push URL, because a fork's fetch is the repository and its push is where the
 * person happens to be allowed to write.
 */
export const gitHubRepositoryUrlFromRemotes = (remotes: readonly GitRemote[]): string | null => {
  const ordered = [...remotes].sort((a, b) => (a.name === 'origin' ? -1 : b.name === 'origin' ? 1 : 0));
  for (const remote of ordered) {
    const url = gitHubRepositoryUrl(remote.fetchUrl) ?? gitHubRepositoryUrl(remote.pushUrl);
    if (url) return url;
  }
  return null;
};
