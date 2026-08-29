import type { ReactNode } from 'react';

interface PageProps {
  title: string;
  children?: ReactNode;
}

export default function Page({ title, children }: PageProps) {
  return (
    <>
      <h1 className="text-2xl">{title}</h1>
      <div className="mt-8">{children}</div>
    </>
  );
}
