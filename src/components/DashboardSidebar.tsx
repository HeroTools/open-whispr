import { LayoutDashboard, History, Settings, HelpCircle } from "lucide-react";

export type DashboardTab = "dashboard" | "history" | "settings" | "help";

interface DashboardSidebarProps {
  activeTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  collapsed?: boolean;
}

const navItems: { id: DashboardTab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "history", label: "History", icon: History },
  { id: "settings", label: "Settings", icon: Settings },
  { id: "help", label: "Help", icon: HelpCircle },
];

export default function DashboardSidebar({
  activeTab,
  onTabChange,
  collapsed = false,
}: DashboardSidebarProps) {
  return (
    <div
      className={`bg-gray-50 border-r border-gray-200 flex flex-col transition-all duration-200 ${
        collapsed ? "w-16" : "w-56"
      }`}
    >
      {/* Logo / Brand area */}
      <div className="h-14 flex items-center px-4 border-b border-gray-200">
        {!collapsed && (
          <span className="font-semibold text-gray-900 text-lg">OpenWhispr</span>
        )}
        {collapsed && (
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center mx-auto">
            <span className="text-white text-sm font-bold">O</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 ${
                isActive
                  ? "bg-white text-gray-900 shadow-sm border border-gray-200"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              }`}
              title={collapsed ? item.label : undefined}
            >
              <Icon
                className={`w-5 h-5 flex-shrink-0 ${isActive ? "text-indigo-600" : ""}`}
              />
              {!collapsed && (
                <span className="font-medium text-sm">{item.label}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom area - could add user info, version, etc */}
      <div className="p-4 border-t border-gray-200">
        {!collapsed && (
          <p className="text-xs text-gray-400 text-center">Voice to Text</p>
        )}
      </div>
    </div>
  );
}
