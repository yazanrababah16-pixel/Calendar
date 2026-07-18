"use client";

import { useCallback } from "react";
import * as Toast from "@base-ui/react/toast";
import { cn } from "@/lib/utils";
import { X, CheckCircle, AlertCircle, Info } from "lucide-react";

type ToastType = "success" | "error" | "info";

type ToastData = {
  type?: ToastType;
};

function ToasterViewport() {
  const { toasts } = Toast.Toast.useToastManager<ToastData>();

  return (
    <Toast.Toast.Viewport className="fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
      {toasts.map((t) => (
        <Toast.Toast.Root
          key={t.id}
          toast={t}
          className={cn(
            "group relative flex items-start gap-3 rounded-lg border bg-background p-4 shadow-lg transition-all",
            "data-starting:-translate-y-2 data-starting:opacity-0",
            "data-ending:opacity-0 data-ending:scale-95",
          )}
        >
          <Toast.Toast.Content className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              {t.data?.type === "success" && (
                <CheckCircle className="size-4 shrink-0 text-green-500" />
              )}
              {t.data?.type === "error" && <AlertCircle className="size-4 shrink-0 text-red-500" />}
              {(!t.data?.type || t.data?.type === "info") && (
                <Info className="size-4 shrink-0 text-blue-500" />
              )}
              <Toast.Toast.Title className="text-sm font-medium">{t.title}</Toast.Toast.Title>
            </div>
            {t.description && (
              <Toast.Toast.Description className="text-xs text-muted-foreground">
                {t.description}
              </Toast.Toast.Description>
            )}
          </Toast.Toast.Content>
          <Toast.Toast.Close className="shrink-0 rounded-sm opacity-60 transition-opacity hover:opacity-100">
            <X className="size-3.5" />
          </Toast.Toast.Close>
        </Toast.Toast.Root>
      ))}
    </Toast.Toast.Viewport>
  );
}

function useToast() {
  const { add } = Toast.Toast.useToastManager<ToastData>();

  const toast = useCallback(
    (options: { title: string; description?: string; type?: ToastType; timeout?: number }) => {
      add({
        title: options.title,
        description: options.description,
        timeout: options.timeout ?? 4000,
        data: { type: options.type ?? "info" },
      });
    },
    [add],
  );

  return { toast };
}

export { ToasterViewport, useToast };
