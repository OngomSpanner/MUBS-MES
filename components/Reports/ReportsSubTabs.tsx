'use client';

import type { ReactNode } from 'react';
import { Badge } from 'react-bootstrap';

export type ReportsTabItem<T extends string> = {
  key: T;
  label: string;
  icon?: string;
  hint?: string;
  count?: number;
};

export type ReportsTabVariant = 'primary' | 'secondary' | 'tertiary';

type Props<T extends string> = {
  tabs: ReportsTabItem<T>[];
  active: T;
  onChange: (key: T) => void;
  variant?: ReportsTabVariant;
  className?: string;
};

const ACTIVE_STYLE = { background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' } as const;

function activeBtnClass(isActive: boolean, size: 'sm' | 'lg' = 'sm'): string {
  const base = size === 'lg' ? 'btn btn-lg' : 'btn btn-sm';
  return `${base} fw-bold d-inline-flex align-items-center gap-1 ${
    isActive ? 'btn-primary' : 'btn-outline-secondary'
  }`;
}

export default function ReportsSubTabs<T extends string>({
  tabs,
  active,
  onChange,
  variant = 'secondary',
  className = '',
}: Props<T>) {
  if (variant === 'primary') {
    return (
      <div className={`d-grid gap-2 reports-tabs-primary-grid ${className}`.trim()}>
        {tabs.map((tab) => {
          const isActive = active === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onChange(tab.key)}
              className={`${activeBtnClass(isActive, 'lg')} text-start px-3 py-3 w-100`}
              style={isActive ? ACTIVE_STYLE : undefined}
            >
              {tab.icon ? (
                <span
                  className="material-symbols-outlined flex-shrink-0"
                  style={{ fontSize: '22px' }}
                >
                  {tab.icon}
                </span>
              ) : null}
              <span className="d-flex flex-column align-items-start min-w-0">
                <span>{tab.label}</span>
                {tab.hint ? (
                  <span className="fw-normal opacity-75" style={{ fontSize: '0.68rem' }}>
                    {tab.hint}
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  if (variant === 'tertiary') {
    return (
      <div className={`reports-tabs-tertiary-scroll ${className}`.trim()}>
        <div className="d-flex flex-nowrap gap-2 pb-1">
          {tabs.map((tab) => {
            const isActive = active === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => onChange(tab.key)}
                className={`btn btn-sm fw-bold rounded-pill text-nowrap ${
                  isActive ? 'btn-primary' : 'btn-outline-secondary'
                }`}
                style={isActive ? ACTIVE_STYLE : undefined}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className={`d-flex flex-wrap gap-2 ${className}`.trim()}>
      {tabs.map((tab) => {
        const isActive = active === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={activeBtnClass(isActive)}
            style={isActive ? ACTIVE_STYLE : undefined}
          >
            {tab.icon ? (
              <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
                {tab.icon}
              </span>
            ) : null}
            {tab.label}
            {tab.count !== undefined ? (
              <Badge
                bg={isActive ? 'light' : 'secondary'}
                className={isActive ? 'text-primary' : ''}
                style={{ fontSize: '0.62rem' }}
              >
                {tab.count}
              </Badge>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

type ShellProps = {
  primary: ReactNode;
  sub?: ReactNode;
  tertiary?: ReactNode;
  className?: string;
};

export function ReportsTabShell({ primary, sub, tertiary, className = 'mb-4' }: ShellProps) {
  return (
    <div className={`table-card p-3 p-md-4 ${className}`.trim()}>
      {primary}
      {sub ? (
        <div className="d-flex flex-wrap gap-2 mt-3 pt-3 border-top">{sub}</div>
      ) : null}
      {tertiary ? <div className="mt-3 pt-3 border-top">{tertiary}</div> : null}
    </div>
  );
}
