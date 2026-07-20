"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  getMonthlyRevenue,
  getAppointmentStatusDistribution,
  getProviderWorkload,
} from "@/server/actions/analytics";
import { AlertCircle, DollarSign, CalendarCheck, Stethoscope } from "lucide-react";

const PIE_COLORS: Record<string, string> = {
  SCHEDULED: "#3b82f6",
  CONFIRMED: "#22c55e",
  IN_PROGRESS: "#f59e0b",
  COMPLETED: "#6b7280",
  CANCELLED: "#ef4444",
  NO_SHOW: "#ec4899",
};

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: "Scheduled",
  CONFIRMED: "Confirmed",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "No Show",
};

export function AdminDashboard() {
  const {
    data: revenueData,
    isLoading: revLoading,
    isError: revError,
  } = useQuery({
    queryKey: ["analytics", "monthlyRevenue"],
    queryFn: async () => {
      const result = await getMonthlyRevenue();
      if (!result.success) throw new Error(result.error);
      return result.months;
    },
  });

  const { data: statusData, isLoading: statusLoading } = useQuery({
    queryKey: ["analytics", "statusDistribution"],
    queryFn: async () => {
      const result = await getAppointmentStatusDistribution();
      if (!result.success) throw new Error(result.error);
      return result.distribution;
    },
  });

  const { data: workloadData, isLoading: workloadLoading } = useQuery({
    queryKey: ["analytics", "providerWorkload"],
    queryFn: async () => {
      const result = await getProviderWorkload();
      if (!result.success) throw new Error(result.error);
      return result.workload;
    },
  });

  const loading = revLoading || statusLoading || workloadLoading;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  const totalRevenue = revenueData?.reduce((s, m) => s + m.revenue, 0) ?? 0;
  const totalAppointments = statusData?.reduce((s, d) => s + d.count, 0) ?? 0;
  const totalProviders = workloadData?.length ?? 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue (6mo)</CardTitle>
            <DollarSign className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">${totalRevenue.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Appointments</CardTitle>
            <CalendarCheck className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalAppointments}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Providers</CardTitle>
            <Stethoscope className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalProviders}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Monthly Revenue Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            {revError || !revenueData ? (
              <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
                <AlertCircle className="mr-2 size-4 text-destructive" />
                Failed to load revenue data
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v}`} width={60} />
                  <Tooltip formatter={(value) => [`$${Number(value).toFixed(2)}`, "Revenue"]} />
                  <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Appointment Status Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Appointment Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {!statusData || statusData.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
                No data
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={statusData.map((d) => ({
                      name: STATUS_LABELS[d.status] ?? d.status,
                      value: d.count,
                    }))}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {statusData.map((d) => (
                      <Cell key={d.status} fill={PIE_COLORS[d.status] ?? "#6b7280"} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    formatter={(value: string) => <span className="text-xs">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Provider Workload Table */}
      {workloadData && workloadData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Provider Workload & Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium">Provider</th>
                    <th className="px-4 py-3 text-right font-medium">Appointments</th>
                    <th className="px-4 py-3 text-right font-medium">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {workloadData.map((p) => (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{p.name}</td>
                      <td className="px-4 py-3 text-right">{p.appointmentCount}</td>
                      <td className="px-4 py-3 text-right font-medium">
                        ${p.totalRevenue.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
