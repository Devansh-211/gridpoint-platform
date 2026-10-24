import React from 'react';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  breadcrumbs: BreadcrumbItem[];
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  breadcrumbs,
  title,
  description,
  actions,
}) => {
  return (
    <div className="border-b border-[#E2E8F0] bg-white px-4 py-5 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 space-y-1">
          {/* Breadcrumb row */}
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider uppercase text-slate-400">
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && <span className="text-slate-300">/</span>}
                {crumb.href ? (
                  <a href={crumb.href} className="hover:text-blue-600 transition">
                    {crumb.label}
                  </a>
                ) : (
                  <span className="text-blue-600 font-bold">{crumb.label}</span>
                )}
              </React.Fragment>
            ))}
          </nav>

          {/* Title & Description */}
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0F172A] truncate">
            {title}
          </h1>
          {description && (
            <p className="text-xs sm:text-sm text-[#64748B] max-w-3xl leading-relaxed">
              {description}
            </p>
          )}
        </div>

        {/* Action Buttons Row */}
        {actions && (
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};
