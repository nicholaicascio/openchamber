import React, { act } from 'react';
import { expect, test } from 'bun:test';
import { Window } from 'happy-dom';
import type { GitRemote, GitStatus } from '@/lib/api/types';

const status: GitStatus = { current: 'main', tracking: null, ahead: 0, behind: 0, files: [], isClean: true };

const remote = (name: string, fetchUrl: string, pushUrl = fetchUrl): GitRemote => ({ name, fetchUrl, pushUrl });

test('the repository menu opens a GitHub repository and disables the entry elsewhere', async () => {
  const dom = new Window({ url: 'http://localhost' });
  const originals = new Map<string, PropertyDescriptor | undefined>();
  for (const [name, value] of Object.entries({
    window: dom, document: dom.document, navigator: dom.navigator,
    Element: dom.Element, HTMLElement: dom.HTMLElement, Node: dom.Node,
    Event: dom.Event, MouseEvent: dom.MouseEvent, KeyboardEvent: dom.KeyboardEvent,
    ResizeObserver: dom.ResizeObserver, getComputedStyle: dom.getComputedStyle.bind(dom),
    requestAnimationFrame: dom.requestAnimationFrame.bind(dom), cancelAnimationFrame: dom.cancelAnimationFrame.bind(dom),
    localStorage: dom.localStorage, sessionStorage: dom.sessionStorage,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  }
  const opened: string[] = [];
  Object.defineProperty(dom, 'open', {
    configurable: true,
    writable: true,
    value: (url: string) => { opened.push(url); return null; },
  });

  const { createRoot } = await import('react-dom/client');
  const { I18nProvider } = await import('@/lib/i18n');
  const { GitHeader } = await import('./GitHeader');
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);

  const baseProps = {
    directory: '/repo',
    status,
    localBranches: ['main'],
    remoteBranches: [],
    branchInfo: undefined,
    syncAction: null,
    onFetch: () => {},
    onPull: () => {},
    onSync: () => {},
    onPublish: () => {},
    onChooseSyncTargets: () => {},
    onRemoveRemote: () => {},
    removingRemoteName: null,
    onCheckoutBranch: () => {},
    onCreateBranch: async () => {},
    activeIdentityProfile: null,
    availableIdentities: [],
    onSelectIdentity: () => {},
    isApplyingIdentity: false,
    isWorktreeMode: false,
    onOpenHistory: () => {},
    onOpenGraph: () => {},
  };

  const render = (remotes: GitRemote[]) => act(async () => root.render(
    <I18nProvider>
      <GitHeader {...baseProps} remotes={remotes} />
    </I18nProvider>
  ));

  const openRepositoryItem = async (): Promise<HTMLElement> => {
    const trigger = container.querySelector<HTMLButtonElement>('button[aria-label="Repository views"]');
    if (!trigger) throw new Error('Missing repository views trigger');
    await act(async () => { trigger.click(); });
    const item = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')]
      .find((entry) => entry.textContent === 'View repository on GitHub');
    if (!item) throw new Error('Missing repository menu item');
    return item;
  };

  try {
    await render([remote('origin', 'git@github.com:me/project.git')]);
    const item = await openRepositoryItem();
    expect(item.getAttribute('aria-disabled')).toBeNull();
    await act(async () => { item.click(); });
    expect(opened).toEqual(['https://github.com/me/project']);
    expect(document.querySelector('[role="menu"]')).toBeNull();

    opened.length = 0;
    await render([remote('origin', 'git@gitlab.com:me/project.git')]);
    const disabledItem = await openRepositoryItem();
    expect(disabledItem.getAttribute('aria-disabled')).toBe('true');
    await act(async () => { disabledItem.click(); });
    expect(opened).toEqual([]);
  } finally {
    await act(async () => root.unmount());
    for (const [name, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
    await dom.happyDOM.close();
  }
});
