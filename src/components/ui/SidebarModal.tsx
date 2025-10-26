import React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

export interface SidebarItem<T extends string> {
  id: T;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface SidebarModalProps<T extends string> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  sidebarItems: SidebarItem<T>[];
  activeSection: T;
  onSectionChange: (section: T) => void;
  children: React.ReactNode;
  sidebarWidth?: string;
}

export default function SidebarModal<T extends string>({
  open,
  onOpenChange,
  title,
  sidebarItems,
  activeSection,
  onSectionChange,
  children,
  sidebarWidth = "w-72",
}: SidebarModalProps<T>) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" />
        <DialogPrimitive.Content className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] fixed top-[50%] left-[50%] z-50 max-h-[90vh] w-[90vw] max-w-5xl translate-x-[-50%] translate-y-[-50%] overflow-hidden rounded-2xl bg-white p-0 shadow-2xl duration-200">
          <div className="relative h-full max-h-[90vh] overflow-hidden">
            <DialogPrimitive.Close className="ring-offset-background absolute top-6 right-6 z-10 rounded-full bg-gray-100 p-2 opacity-70 transition-all hover:bg-gray-200 hover:opacity-100 focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 focus:outline-none">
              <X className="h-4 w-4 text-gray-600" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>

            <div className="flex h-[90vh]">
              {/* Sidebar */}
              <div className={`${sidebarWidth} border-r border-primary-200 bg-primary-50/50 p-6`}>
                <h2 className="mb-6 px-2 text-xl font-semibold text-primary-900">{title}</h2>
                <nav className="space-y-1.5">
                  {sidebarItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={() => onSectionChange(item.id)}
                        className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-medium transition-all duration-200 ${
                          activeSection === item.id
                            ? "bg-primary-500 text-white shadow-sm shadow-primary-500/20"
                            : "text-secondary-600 hover:bg-primary-100 hover:text-primary-900"
                        }`}
                      >
                        <Icon className="h-5 w-5 flex-shrink-0" />
                        <span className="flex-1">{item.label}</span>
                      </button>
                    );
                  })}
                </nav>
              </div>

              {/* Main Content */}
              <div className="flex-1 overflow-y-auto bg-white">
                <div className="p-8">
                  <div className="max-w-3xl">{children}</div>
                </div>
              </div>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
