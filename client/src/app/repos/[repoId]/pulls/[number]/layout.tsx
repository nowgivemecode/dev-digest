import type { Metadata } from "next";
import type { ReactNode } from "react";

type Params = { repoId: string; number: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { number } = await params;
  return { title: `PR #${number} — DevDigest` };
}

export default function PrDetailLayout({ children }: { children: ReactNode }) {
  return children;
}
