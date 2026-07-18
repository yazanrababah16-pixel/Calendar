"use client";

import * as DialogPrimitive from "@base-ui/react/dialog";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

function Dialog({
  open,
  onOpenChange,
  children,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <DialogPrimitive.Dialog.Root open={open} onOpenChange={onOpenChange} modal>
      {children}
    </DialogPrimitive.Dialog.Root>
  );
}

function DialogTrigger({ children }: { children: React.ReactNode }) {
  return <DialogPrimitive.Dialog.Trigger>{children}</DialogPrimitive.Dialog.Trigger>;
}

function DialogContent({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Dialog.Popup>) {
  return (
    <DialogPrimitive.Dialog.Portal>
      <DialogPrimitive.Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 data-ending:opacity-0 data-starting:opacity-0 transition-opacity" />
      <DialogPrimitive.Dialog.Popup
        data-slot="dialog-content"
        className={cn(
          "fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-6 shadow-lg data-ending:scale-95 data-starting:scale-95 data-ending:opacity-0 data-starting:opacity-0 transition-all duration-200",
          className,
        )}
        {...props}
      >
        <DialogPrimitive.Dialog.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          <X className="size-4" />
        </DialogPrimitive.Dialog.Close>
        {children}
      </DialogPrimitive.Dialog.Popup>
    </DialogPrimitive.Dialog.Portal>
  );
}

function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-1 text-center sm:text-left", className)}
      {...props}
    />
  );
}

function DialogTitle({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Dialog.Title>) {
  return (
    <DialogPrimitive.Dialog.Title
      data-slot="dialog-title"
      className={cn("text-lg leading-none font-semibold", className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Dialog.Description>) {
  return (
    <DialogPrimitive.Dialog.Description
      data-slot="dialog-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription };
