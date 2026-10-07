import { describe, expect, test } from 'bun:test';
import type { GitRemote } from '@/lib/api/types';
import { gitHubRepositoryUrl, gitHubRepositoryUrlFromRemotes } from './repositoryUrl';

const remote = (name: string, fetchUrl: string, pushUrl = fetchUrl): GitRemote => ({ name, fetchUrl, pushUrl });

describe('gitHubRepositoryUrl', () => {
  test('reads the owner and repo from an https remote', () => {
    expect(gitHubRepositoryUrl('https://github.com/team/repo.git')).toBe('https://github.com/team/repo');
    expect(gitHubRepositoryUrl('https://github.com/team/repo')).toBe('https://github.com/team/repo');
    expect(gitHubRepositoryUrl('https://github.com/team/repo/')).toBe('https://github.com/team/repo');
  });

  test('reads the owner and repo from an ssh remote', () => {
    expect(gitHubRepositoryUrl('git@github.com:team/repo.git')).toBe('https://github.com/team/repo');
    expect(gitHubRepositoryUrl('ssh://git@github.com/team/repo.git')).toBe('https://github.com/team/repo');
  });

  test('lowercases the host and ignores surrounding whitespace', () => {
    expect(gitHubRepositoryUrl('  git@GitHub.com:team/repo.git  ')).toBe('https://github.com/team/repo');
  });

  test('refuses hosts that are not github.com', () => {
    expect(gitHubRepositoryUrl('https://gitlab.com/team/repo.git')).toBeNull();
    expect(gitHubRepositoryUrl('git@gitlab.com:team/repo.git')).toBeNull();
    expect(gitHubRepositoryUrl('https://github.example.com/team/repo.git')).toBeNull();
  });

  test('refuses a path that is not exactly owner/repo', () => {
    expect(gitHubRepositoryUrl('https://github.com/team')).toBeNull();
    expect(gitHubRepositoryUrl('https://github.com/team/repo/tree/main')).toBeNull();
    expect(gitHubRepositoryUrl('https://github.com/')).toBeNull();
  });

  test('refuses a missing or unparseable remote', () => {
    expect(gitHubRepositoryUrl('')).toBeNull();
    expect(gitHubRepositoryUrl('   ')).toBeNull();
    expect(gitHubRepositoryUrl('not a url')).toBeNull();
  });
});

describe('gitHubRepositoryUrlFromRemotes', () => {
  test('prefers origin over any other remote', () => {
    expect(gitHubRepositoryUrlFromRemotes([
      remote('upstream', 'https://github.com/upstream/project.git'),
      remote('origin', 'git@github.com:me/project.git'),
    ])).toBe('https://github.com/me/project');
  });

  test('falls back to the first GitHub remote when origin is elsewhere', () => {
    expect(gitHubRepositoryUrlFromRemotes([
      remote('origin', 'git@gitlab.com:me/project.git'),
      remote('upstream', 'https://github.com/upstream/project.git'),
    ])).toBe('https://github.com/upstream/project');
  });

  test('reads the push URL when the fetch URL carries no GitHub repo', () => {
    expect(gitHubRepositoryUrlFromRemotes([
      remote('origin', '', 'git@github.com:me/project.git'),
    ])).toBe('https://github.com/me/project');
  });

  test('returns null when no remote is on github.com', () => {
    expect(gitHubRepositoryUrlFromRemotes([
      remote('origin', 'git@gitlab.com:me/project.git'),
      remote('upstream', 'https://example.com/team/repo.git'),
    ])).toBeNull();
    expect(gitHubRepositoryUrlFromRemotes([])).toBeNull();
  });
});
