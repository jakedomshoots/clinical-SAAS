const PREFIX = 'concierge-os.operations';

export function getStoredTab(): string | null {
  try {
    return localStorage.getItem(`${PREFIX}.active-tab`);
  } catch {
    return null;
  }
}

export function setStoredTab(tabId: string): void {
  try {
    localStorage.setItem(`${PREFIX}.active-tab`, tabId);
  } catch {
    /* ignore */
  }
}

export function getStoredExpandedCards(): string[] {
  try {
    const raw = localStorage.getItem(`${PREFIX}.expanded-cards`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function setStoredExpandedCards(cards: string[]): void {
  try {
    localStorage.setItem(`${PREFIX}.expanded-cards`, JSON.stringify(cards));
  } catch {
    /* ignore */
  }
}

export function getPinnedSections(role: string): string[] {
  try {
    const raw = localStorage.getItem(`${PREFIX}.pinned.${role}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function setPinnedSections(role: string, sections: string[]): void {
  try {
    localStorage.setItem(`${PREFIX}.pinned.${role}`, JSON.stringify(sections));
  } catch {
    /* ignore */
  }
}

export function getHiddenSections(role: string): string[] {
  try {
    const raw = localStorage.getItem(`${PREFIX}.hidden.${role}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function setHiddenSections(role: string, sections: string[]): void {
  try {
    localStorage.setItem(`${PREFIX}.hidden.${role}`, JSON.stringify(sections));
  } catch {
    /* ignore */
  }
}

export function clearOperationsState(): void {
  try {
    localStorage.removeItem(`${PREFIX}.active-tab`);
    localStorage.removeItem(`${PREFIX}.expanded-cards`);
  } catch {
    /* ignore */
  }
}

export function getOnboardingState(): { completed: boolean; sessions: number } {
  try {
    const completed = localStorage.getItem('concierge-os.onboarding.completed') === 'true';
    const sessions = Number(localStorage.getItem('concierge-os.onboarding.sessions') || '0');
    return { completed, sessions };
  } catch {
    return { completed: false, sessions: 0 };
  }
}

export function setOnboardingCompleted(): void {
  try {
    localStorage.setItem('concierge-os.onboarding.completed', 'true');
  } catch {
    /* ignore */
  }
}

export function incrementOnboardingSession(): number {
  try {
    const current = Number(localStorage.getItem('concierge-os.onboarding.sessions') || '0');
    const next = current + 1;
    localStorage.setItem('concierge-os.onboarding.sessions', String(next));
    return next;
  } catch {
    return 0;
  }
}
