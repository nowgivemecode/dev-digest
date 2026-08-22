"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Contextual values shared across the PR detail findings subtree.
 * Eliminates prop-drilling of repoFullName + headSha through
 * FindingsTab → ReviewRunAccordion → FindingsPanel → FindingCard.
 * Set up by FindingsTab; consumed by components that build GitHub deep-links.
 */

interface PRDetailContextValue {
  repoFullName: string | null;
  headSha: string | null;
}

const PRDetailContext = createContext<PRDetailContextValue>({
  repoFullName: null,
  headSha: null,
});

export function PRDetailProvider({
  repoFullName,
  headSha,
  children,
}: PRDetailContextValue & { children: ReactNode }) {
  return (
    <PRDetailContext.Provider value={{ repoFullName, headSha }}>
      {children}
    </PRDetailContext.Provider>
  );
}

export function usePRDetail() {
  return useContext(PRDetailContext);
}
