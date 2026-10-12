import React from "react";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  icon: LucideIcon;
  iconColorClass?: "blue" | "green" | "purple" | "orange";
  tag: string;
  tagColorClass?: "green" | "neutral" | "orange";
  label: string;
  value: string | number;
  footnote?: string;
  isSmallValue?: boolean;
}

export const StatCard: React.FC<StatCardProps> = ({
  icon: Icon,
  iconColorClass = "blue",
  tag,
  tagColorClass,
  label,
  value,
  footnote,
  isSmallValue = false,
}) => {
  return (
    <article className="stat-card">
      <div className="stat-topline">
        <span className={`stat-icon stat-icon-${iconColorClass}`}>
          <Icon size={20} />
        </span>
        <span className={`stat-tag ${tagColorClass ? `tag-${tagColorClass}` : ""}`}>
          {tag}
        </span>
      </div>
      <p className="stat-label">{label}</p>
      <h3 className={isSmallValue ? "stat-value-small" : ""}>{value}</h3>
      {footnote && <p className="stat-footnote">{footnote}</p>}
    </article>
  );
};

export default StatCard;
