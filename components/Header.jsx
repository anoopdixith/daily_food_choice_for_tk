"use client";

import { usePathname } from 'next/navigation';

export default function Header() {
  const pathname = usePathname() || '/';
  const isAdmin = pathname.startsWith('/admin');

  return (
    <div className="header-inner">
      {isAdmin ? (
        <h1>Daily Food Choice</h1>
      ) : (
        <>
          <h1>Choose your kid's daily food menu</h1>
          <p className="header-sub">To be submitted by parents every morning</p>
        </>
      )}
    </div>
  );
}

