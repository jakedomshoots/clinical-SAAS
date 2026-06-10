import { useEffect } from 'react';

export function useDocumentTitle(title: string) {
  useEffect(() => {
    const originalTitle = document.title;
    document.title = `${title} | ConciergeOS`;
    return () => {
      document.title = originalTitle;
    };
  }, [title]);
}
