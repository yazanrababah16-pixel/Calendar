"use client";

interface CalendarLegendItem {
  color: string;
  label: string;
  variant?: "solid" | "dashed";
}

const defaultLegendItems: CalendarLegendItem[] = [
  { color: "bg-blue-500", label: "Scheduled" },
  { color: "bg-green-500", label: "Confirmed" },
  { color: "bg-amber-500", label: "In Progress" },
  { color: "border-amber-400 bg-amber-50", label: "Pending Request", variant: "dashed" },
  { color: "border-blue-400 bg-blue-50", label: "Awaiting Reply", variant: "dashed" },
  { color: "bg-purple-500", label: "Reschedule Requested" },
];

interface CalendarLegendProps {
  items?: CalendarLegendItem[];
  patientMode?: boolean;
}

export function CalendarLegend({ items, patientMode }: CalendarLegendProps) {
  const legendItems = items ?? defaultLegendItems;

  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
      {legendItems.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          {item.variant === "dashed" ? (
            <span className={`size-3 rounded border-2 border-dashed ${item.color}`} />
          ) : (
            <span className={`size-3 rounded-full ${item.color}`} />
          )}
          <span>
            {patientMode && item.label === "Awaiting Reply"
              ? "Action Required (click to respond)"
              : item.label}
          </span>
        </div>
      ))}
    </div>
  );
}
