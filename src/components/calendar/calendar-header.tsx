"use client";

import { format, addWeeks, subWeeks, addMonths, subMonths, addDays, subDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { CalendarViewType } from "./calendar-view";

interface CalendarHeaderProps {
  currentDate: Date;
  view: CalendarViewType;
  onViewChange: (view: CalendarViewType) => void;
  onDateChange: (date: Date) => void;
}

export function CalendarHeader({
  currentDate,
  view,
  onViewChange,
  onDateChange,
}: CalendarHeaderProps) {
  function navigate(direction: "prev" | "next") {
    const fn =
      view === "week"
        ? direction === "prev"
          ? subWeeks
          : addWeeks
        : view === "day"
          ? direction === "prev"
            ? subDays
            : addDays
          : direction === "prev"
            ? subMonths
            : addMonths;
    onDateChange(fn(currentDate, 1));
  }

  const label =
    view === "week"
      ? `Week of ${format(currentDate, "MMM d, yyyy")}`
      : view === "day"
        ? format(currentDate, "EEEE, MMM d, yyyy")
        : format(currentDate, "MMMM yyyy");

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => navigate("prev")}>
          <ChevronLeft className="size-4" />
        </Button>
        <h2 className="text-lg font-semibold min-w-[200px] text-center">{label}</h2>
        <Button variant="outline" size="icon" onClick={() => navigate("next")}>
          <ChevronRight className="size-4" />
        </Button>
      </div>
      <div className="flex items-center gap-1 rounded-lg border p-0.5">
        <Button
          variant={view === "week" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => onViewChange("week")}
        >
          Week
        </Button>
        <Button
          variant={view === "month" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => onViewChange("month")}
        >
          Month
        </Button>
        <Button
          variant={view === "day" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => onViewChange("day")}
        >
          Day
        </Button>
      </div>
    </div>
  );
}
