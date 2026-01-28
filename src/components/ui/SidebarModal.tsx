import React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

export interface SidebarItem<T extends string> {
  id: T;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  group?: string;
  description?: string;
  badge?: string;
  badgeVariant?: "default" | "new" | "update" | "dot";
  shortcut?: string;
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
  version?: string;
}

export default function SidebarModal<T extends string>({
  open,
  onOpenChange,
  title,
  sidebarItems,
  activeSection,
  onSectionChange,
  children,
  sidebarWidth = "w-56",
  version,
}: SidebarModalProps<T>) {
  // Group items by their group property
  const groupedItems = React.useMemo(() => {
    const groups: { label: string | null; items: SidebarItem<T>[] }[] = [];
    let currentGroup: string | null | undefined = undefined;

    for (const item of sidebarItems) {
      const group = item.group ?? null;
      if (group !== currentGroup) {
        groups.push({ label: group, items: [item] });
        currentGroup = group;
      } else {
        groups[groups.length - 1].items.push(item);
      }
    }

    return groups;
  }, [sidebarItems]);

  const renderBadge = (item: SidebarItem<T>) => {
    if (!item.badge && item.badgeVariant !== "dot") return null;

    if (item.badgeVariant === "dot") {
      return <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary shrink-0" />;
    }

    return (
      <span
        className={`ml-auto text-[9px] font-semibold uppercase tracking-wider px-1.5 py-px rounded-full shrink-0 ${
          item.badgeVariant === "new"
            ? "bg-primary/10 text-primary dark:bg-primary/15"
            : item.badgeVariant === "update"
              ? "bg-warning/10 text-warning dark:bg-warning/15"
              : "bg-muted text-muted-foreground"
        }`}
      >
        {item.badge}
      </span>
    );
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-50 max-h-[90vh] w-[90vw] max-w-5xl translate-x-[-50%] translate-y-[-50%] rounded-2xl p-0 overflow-hidden bg-background border border-border/50 shadow-2xl dark:bg-background dark:border-border dark:shadow-modal duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]">
          <div className="relative h-full max-h-[90vh] overflow-hidden">
            <DialogPrimitive.Close className="absolute right-5 top-5 z-10 rounded-full p-1.5 opacity-50 ring-offset-background transition-all hover:opacity-100 bg-transparent hover:bg-muted dark:hover:bg-surface-raised focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
              <X className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>

            <div className="flex h-[90vh]">
              {/* Sidebar */}
              <div
                className={`${sidebarWidth} shrink-0 border-r border-border/40 dark:border-border-subtle flex flex-col bg-surface-1 dark:bg-surface-0`}
              >
                {/* Title */}
                <div className="px-5 pt-6 pb-1">
                  <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/60">
                    {title}
                  </h2>
                </div>

                {/* Navigation */}
                <nav className="relative flex-1 px-2.5 pt-3 pb-2 overflow-y-auto">
                  {groupedItems.map((group, groupIndex) => (
                    <div key={groupIndex} className={groupIndex > 0 ? "mt-4" : ""}>
                      {group.label && (
                        <div className="px-2.5 pb-1 pt-1">
                          <span className="text-[10px] font-medium tracking-[0.06em] uppercase text-muted-foreground/40">
                            {group.label}
                          </span>
                        </div>
                      )}
                      <div className="space-y-0.5">
                        {group.items.map((item) => {
                          const Icon = item.icon;
                          const isActive = activeSection === item.id;
                          return (
                            <button
                              key={item.id}
                              data-section-id={item.id}
                              onClick={() => onSectionChange(item.id)}
                              className={`group w-full flex items-center gap-2.5 px-2.5 py-[7px] text-left text-[13px] rounded-lg transition-all duration-150 outline-none ${
                                isActive
                                  ? "text-foreground bg-primary/8 dark:bg-primary/7"
                                  : "text-muted-foreground hover:text-foreground hover:bg-black/4 dark:hover:bg-white/4"
                              }`}
                            >
                              <div
                                className={`flex items-center justify-center h-6 w-6 rounded-md shrink-0 transition-all duration-150 ${
                                  isActive
                                    ? "bg-primary/12 dark:bg-primary/12"
                                    : "bg-transparent group-hover:bg-black/4 dark:group-hover:bg-white/4"
                                }`}
                              >
                                <Icon
                                  className={`h-[14px] w-[14px] shrink-0 transition-colors duration-150 ${
                                    isActive
                                      ? "text-primary"
                                      : "text-muted-foreground/70 group-hover:text-foreground"
                                  }`}
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <span
                                  className={`block leading-tight truncate ${isActive ? "font-medium" : "font-normal"}`}
                                >
                                  {item.label}
                                </span>
                                {item.description && (
                                  <span className="block text-[10px] text-muted-foreground/50 leading-tight mt-0.5 truncate">
                                    {item.description}
                                  </span>
                                )}
                              </div>
                              {renderBadge(item)}
                              {item.shortcut && !item.badge && (
                                <kbd className="ml-auto text-[10px] text-muted-foreground/30 font-mono shrink-0">
                                  {item.shortcut}
                                </kbd>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </nav>

                {/* Footer / version */}
                {version && (
                  <div className="px-4 py-3 border-t border-border/20 dark:border-border-subtle/50">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-success/60" />
                      <span className="text-[10px] text-muted-foreground/40 tabular-nums tracking-wide">
                        v{version}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Main Content */}
              <div className="flex-1 overflow-y-auto bg-background dark:bg-background">
                <div className="p-8">
                  <div className="max-w-2xl">{children}</div>
                </div>
              </div>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
