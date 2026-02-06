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
  sidebarWidth = "w-52",
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
        className={`ml-auto text-[9px] font-semibold uppercase tracking-wider px-1.5 py-px rounded-sm shrink-0 ${
          item.badgeVariant === "new"
            ? "bg-primary/15 text-primary"
            : item.badgeVariant === "update"
              ? "bg-warning/15 text-warning"
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
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-50 max-h-[85vh] w-[90vw] max-w-4xl translate-x-[-50%] translate-y-[-50%] rounded-xl p-0 overflow-hidden bg-surface-1 border border-border-subtle shadow-[0_25px_60px_-12px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.05)] duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-98 data-[state=open]:zoom-in-98">
          <div className="relative h-full max-h-[85vh] overflow-hidden">
            <DialogPrimitive.Close className="absolute right-4 top-4 z-10 rounded-md p-1.5 opacity-40 ring-offset-background transition-all hover:opacity-100 bg-transparent hover:bg-surface-raised focus:outline-none focus:ring-2 focus:ring-ring/30 focus:ring-offset-1">
              <X className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>

            <div className="flex h-[85vh]">
              {/* Sidebar - Luxury redesign */}
              <div
                className={`${sidebarWidth} shrink-0 border-r border-border-subtle/50 flex flex-col bg-gradient-to-b from-surface-0 to-surface-1`}
              >
                {/* Title */}
                <div className="px-5 pt-6 pb-4">
                  <h2 className="text-sm font-semibold text-foreground tracking-tight">
                    {title}
                  </h2>
                </div>

                {/* Navigation */}
                <nav className="relative flex-1 px-3 pb-3 overflow-y-auto">
                  {groupedItems.map((group, groupIndex) => (
                    <div key={groupIndex} className={groupIndex > 0 ? "mt-5" : ""}>
                      {group.label && (
                        <div className="px-2.5 pb-2 pt-2">
                          <span className="text-[10px] font-semibold tracking-wider uppercase text-muted-foreground/40">
                            {group.label}
                          </span>
                        </div>
                      )}
                      <div className="space-y-1">
                        {group.items.map((item) => {
                          const Icon = item.icon;
                          const isActive = activeSection === item.id;
                          return (
                            <button
                              key={item.id}
                              data-section-id={item.id}
                              onClick={() => onSectionChange(item.id)}
                              className={`group relative w-full flex items-center gap-3 px-3 py-2.5 text-left text-[13px] rounded-xl transition-all duration-200 outline-none ${
                                isActive
                                  ? "text-foreground bg-primary/10 shadow-[0_0_20px_rgba(112,255,186,0.15)]"
                                  : "text-foreground/60 hover:text-foreground hover:bg-surface-raised"
                              }`}
                            >
                              {/* Active glow indicator */}
                              {isActive && (
                                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-primary shadow-[0_0_8px_rgba(112,255,186,0.6)]" />
                              )}
                              <div
                                className={`flex items-center justify-center h-7 w-7 rounded-lg shrink-0 transition-all duration-200 ${
                                  isActive ? "bg-primary/20" : "bg-transparent group-hover:bg-surface-raised"
                                }`}
                              >
                                <Icon
                                  className={`h-[18px] w-[18px] shrink-0 transition-colors duration-200 ${
                                    isActive
                                      ? "text-primary"
                                      : "text-foreground/40 group-hover:text-foreground/70"
                                  }`}
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <span
                                  className={`block truncate leading-tight ${isActive ? "font-semibold" : "font-medium"}`}
                                >
                                  {item.label}
                                </span>
                                {item.description && !isActive && (
                                  <span className="block text-[10px] text-muted-foreground/40 truncate mt-0.5">
                                    {item.description}
                                  </span>
                                )}
                              </div>
                              {renderBadge(item)}
                              {item.shortcut && !item.badge && (
                                <kbd className="ml-auto text-[9px] text-muted-foreground/20 font-mono shrink-0">
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
                  <div className="px-4 py-3 border-t border-border-subtle/30">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                      <span className="text-[10px] text-muted-foreground/50 tabular-nums font-medium">
                        Version {version}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Main Content - Enhanced */}
              <div className="flex-1 overflow-y-auto bg-surface-1">
                <div className="p-8 max-w-3xl mx-auto">{children}</div>
              </div>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
