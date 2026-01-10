export type ColorScheme = 'purple' | 'indigo' | 'blue';

export interface ModelPickerStyles {
  container: string;
  progress: string;
  progressText: string;
  progressBar: string;
  progressFill: string;
  header: string;
  modelCard: { selected: string; default: string };
  badges: { selected: string; downloaded: string; recommended: string };
  buttons: { download: string; select: string; delete: string; refresh: string };
}

export const MODEL_PICKER_COLORS: Record<ColorScheme, ModelPickerStyles> = {
  purple: {
    container: 'border border-gray-200 rounded-xl overflow-hidden',
    progress: 'bg-purple-50 border-b border-purple-200',
    progressText: 'text-purple-900',
    progressBar: 'bg-purple-200',
    progressFill: 'bg-gradient-to-r from-purple-500 to-purple-600',
    header: 'font-medium text-purple-900',
    modelCard: {
      selected: 'border-purple-500 bg-purple-50',
      default: 'border-gray-200 bg-white hover:border-gray-300',
    },
    badges: {
      selected: 'text-xs text-purple-600 bg-purple-100 px-2 py-1 rounded-full font-medium',
      downloaded: 'text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded',
      recommended: 'text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded',
    },
    buttons: {
      download: 'bg-purple-600 hover:bg-purple-700',
      select: 'border-purple-300 text-purple-700 hover:bg-purple-50',
      delete: 'text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200',
      refresh: 'border-purple-300 text-purple-700 hover:bg-purple-50',
    },
  },
  indigo: {
    container: 'border border-gray-200 rounded-xl overflow-hidden',
    progress: 'bg-indigo-50 border-b border-indigo-200',
    progressText: 'text-indigo-900',
    progressBar: 'bg-indigo-200',
    progressFill: 'bg-gradient-to-r from-indigo-500 to-indigo-600',
    header: 'font-medium text-indigo-900',
    modelCard: {
      selected: 'border-indigo-500 bg-indigo-50',
      default: 'border-gray-200 bg-white hover:border-gray-300',
    },
    badges: {
      selected: 'text-xs text-indigo-600 bg-indigo-100 px-2 py-1 rounded-full font-medium',
      downloaded: 'text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded',
      recommended: 'text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded',
    },
    buttons: {
      download: 'bg-indigo-600 hover:bg-indigo-700',
      select: 'border-indigo-300 text-indigo-700 hover:bg-indigo-50',
      delete: 'text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200',
      refresh: 'border-indigo-300 text-indigo-700 hover:bg-indigo-50',
    },
  },
  blue: {
    container: 'bg-gray-50 rounded-lg overflow-hidden border border-gray-200',
    progress: 'bg-blue-50 border-b border-blue-200',
    progressText: 'text-blue-900',
    progressBar: 'bg-blue-200',
    progressFill: 'bg-gradient-to-r from-blue-500 to-blue-600',
    header: 'font-medium text-gray-900',
    modelCard: {
      selected: 'border-blue-500 bg-blue-50',
      default: 'border-gray-200 bg-white hover:border-gray-300',
    },
    badges: {
      selected: 'text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full font-medium',
      downloaded: 'text-xs text-green-600 bg-green-100 px-2 py-1 rounded',
      recommended: 'text-xs bg-primary/10 text-primary px-2 py-1 rounded',
    },
    buttons: {
      download: 'bg-blue-600 hover:bg-blue-700',
      select: 'border-gray-300 text-gray-700 hover:bg-gray-50',
      delete: 'text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200',
      refresh: 'border-gray-300 text-gray-700 hover:bg-gray-50',
    },
  },
};

export function getModelPickerStyles(colorScheme: ColorScheme): ModelPickerStyles {
  return MODEL_PICKER_COLORS[colorScheme];
}
