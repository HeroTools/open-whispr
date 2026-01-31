import { Flame, Rocket, Crown } from "lucide-react";
import type { DashboardStats } from "../types/electron";

interface StatsHeaderProps {
  stats: DashboardStats;
  userName?: string;
}

export default function StatsHeader({ stats, userName }: StatsHeaderProps) {
  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toLocaleString();
  };

  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold text-gray-900 mb-4">
        Welcome back{userName ? `, ${userName}` : ""}
      </h1>
      <div className="flex flex-wrap gap-3">
        {/* Streak */}
        <div className="flex items-center gap-2 px-4 py-2 bg-orange-50 border border-orange-200 rounded-full">
          <Flame className="w-4 h-4 text-orange-500" />
          <span className="text-sm font-medium text-orange-700">
            {stats.streak} {stats.streak === 1 ? "day" : "days"}
          </span>
        </div>

        {/* Total Words */}
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-full">
          <Rocket className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-medium text-blue-700">
            {formatNumber(stats.totalWords)} words
          </span>
        </div>

        {/* Average WPM */}
        <div className="flex items-center gap-2 px-4 py-2 bg-purple-50 border border-purple-200 rounded-full">
          <Crown className="w-4 h-4 text-purple-500" />
          <span className="text-sm font-medium text-purple-700">{stats.averageWpm} WPM</span>
        </div>
      </div>
    </div>
  );
}
