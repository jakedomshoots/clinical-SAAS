export interface ClickyTargetSnapshot {
  label: string;
  text: string;
  role: string | null;
  testId: string | null;
  tagName: string;
  pointTag: string;
  routePath: string;
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface ClickyVisibleContext {
  routePath: string;
  title: string;
  headings: string[];
  actions: string[];
  summary: string;
}

function cleanText(value: string | null | undefined, maxLength = 180) {
  const cleaned = value?.replace(/\s+/g, ' ').trim() ?? '';
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, maxLength - 3).trim()}...`;
}

function isVisible(element: Element) {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    style.visibility !== 'hidden' &&
    style.display !== 'none' &&
    style.opacity !== '0'
  );
}

function labelForElement(element: Element) {
  const ariaLabel = cleanText(element.getAttribute('aria-label'));
  if (ariaLabel) return ariaLabel;

  const testId = cleanText(element.getAttribute('data-testid'));
  if (testId) return testId.replace(/[-_]/g, ' ');

  const role = cleanText(element.getAttribute('role'));
  const visibleText = cleanText(element.textContent, 80);
  if (visibleText) return visibleText;
  if (role) return role;

  return element.tagName.toLowerCase();
}

function nearestUsefulElement(target: Element) {
  const useful = target.closest(
    'button, a, input, select, textarea, [role], [data-testid], h1, h2, h3, article, section'
  );
  return useful ?? target;
}

export function snapshotClickyTarget(
  target: EventTarget | null,
  routePath: string
): ClickyTargetSnapshot | null {
  if (!(target instanceof Element)) return null;
  const element = nearestUsefulElement(target);
  if (element.closest('[data-clicky-overlay="true"]')) return null;
  if (!isVisible(element)) return null;

  const rect = element.getBoundingClientRect();
  const centerX = Math.round(rect.left + rect.width / 2);
  const centerY = Math.round(rect.top + rect.height / 2);
  const label = labelForElement(element);
  const text = cleanText(element.textContent, 240);
  const role = element.getAttribute('role');
  const testId = element.getAttribute('data-testid');

  return {
    label,
    text,
    role,
    testId,
    tagName: element.tagName.toLowerCase(),
    pointTag: `[POINT:${centerX},${centerY}:${label}:screen]`,
    routePath,
    rect: {
      x: Math.round(rect.left),
      y: Math.round(rect.top),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    },
  };
}

export function collectClickyVisibleContext(documentRef: Document, routePath: string) {
  const title =
    cleanText(documentRef.title.replace(/\s+[\u2013\u2014-]\s+ConciergeOS$/, ''), 90) ||
    'ConciergeOS';
  const headings = Array.from(documentRef.querySelectorAll('main h1, main h2, main h3'))
    .filter(isVisible)
    .map((node) => cleanText(node.textContent, 80))
    .filter(Boolean)
    .slice(0, 6);
  const actions = Array.from(documentRef.querySelectorAll('main button, main a[href]'))
    .filter(isVisible)
    .map((node) => cleanText(node.textContent || node.getAttribute('aria-label'), 70))
    .filter(Boolean)
    .slice(0, 6);
  const summaryParts = [
    title,
    headings.length > 0 ? `Headings: ${headings.slice(0, 3).join(', ')}` : null,
    actions.length > 0 ? `Actions: ${actions.slice(0, 3).join(', ')}` : null,
  ].filter(Boolean);

  return {
    routePath,
    title,
    headings,
    actions,
    summary: summaryParts.join(' | '),
  } satisfies ClickyVisibleContext;
}
