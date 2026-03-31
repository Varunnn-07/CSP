import type { ReactNode } from 'react';

type TopbarProps = {
  title: string;
  subtitle?: string;
  rightSlot?: ReactNode;
};

export function Topbar({ title, subtitle, rightSlot }: TopbarProps) {
  return (
    <header className="page-topbar">
      <div>
        <h1 className="title page-heading">{title}</h1>
        {subtitle ? <p className="subtitle page-subheading">{subtitle}</p> : null}
      </div>
      {rightSlot ? <div>{rightSlot}</div> : null}
    </header>
  );
}
