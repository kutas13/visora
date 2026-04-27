"use client";

import Link from "next/link";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
  badge?: string;
}

/**
 * Modern sayfa başlığı:
 * - Üstte breadcrumb
 * - Solda büyük gradient bar + başlık + açıklama
 * - Sağda aksiyonlar (butonlar, filtreler vb.)
 */
export default function PageHeader({ title, description, breadcrumbs, actions, badge }: PageHeaderProps) {
  return (
    <div className="mb-6">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1.5 text-[12px] text-slate-500 mb-2 flex-wrap">
          {breadcrumbs.map((b, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {b.href ? (
                <Link href={b.href} className="hover:text-indigo-600 transition-colors">
                  {b.label}
                </Link>
              ) : (
                <span className="text-slate-700 font-medium">{b.label}</span>
              )}
              {i < breadcrumbs.length - 1 && (
                <svg className="w-3 h-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              )}
            </span>
          ))}
        </nav>
      )}

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <span className="mt-1 w-1.5 self-stretch rounded-full bg-gradient-to-b from-indigo-500 via-violet-500 to-fuchsia-500" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl md:text-[28px] font-black tracking-tight text-slate-900 leading-tight">{title}</h1>
              {badge && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-gradient-to-r from-indigo-100 via-violet-100 to-fuchsia-100 text-indigo-700 ring-1 ring-indigo-200/50">
                  {badge}
                </span>
              )}
            </div>
            {description && (
              <p className="mt-1 text-sm text-slate-500 max-w-2xl">{description}</p>
            )}
          </div>
        </div>

        {actions && <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">{actions}</div>}
      </div>
    </div>
  );
}
