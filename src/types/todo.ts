export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type Progress = 'not_started' | 'in_progress' | 'blocked' | 'completed';

export interface Tag {
  id: number;
  name: string;
  color: string;
  created_at: string;
}

export interface Project {
  id: number;
  name: string;
  color: string;
  icon: string;
  created_at: string;
  updated_at: string;
}

export interface TodoItem {
  id: number;
  title: string;
  description: string | null;
  completed: boolean;
  due_date: string | null;
  priority: Priority;
  progress: Progress;
  project_id: number | null;
  project_name?: string;
  project_color?: string;
  project_icon?: string;
  tags: Tag[];
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface CreateTodoData {
  title: string;
  description?: string;
  due_date?: string;
  priority?: Priority;
  progress?: Progress;
  project_id?: number;
  tag_ids?: number[];
}

export interface UpdateTodoData {
  title?: string;
  description?: string;
  due_date?: string | null;
  priority?: Priority;
  progress?: Progress;
  project_id?: number | null;
  completed?: boolean;
  tag_ids?: number[];
}

export interface TodoStats {
  total: number;
  completed: number;
  pending: number;
  urgent: number;
  overdue: number;
}

export interface TodoFilters {
  project_id?: number;
  completed?: boolean;
  priority?: Priority;
  progress?: Progress;
  sort_by?: 'created_at' | 'updated_at' | 'due_date' | 'priority' | 'title';
  sort_order?: 'ASC' | 'DESC';
  limit?: number;
}

export interface CreateProjectData {
  name: string;
  color?: string;
  icon?: string;
}

export interface UpdateProjectData {
  name?: string;
  color?: string;
  icon?: string;
}

export interface CreateTagData {
  name: string;
  color?: string;
}

export interface UpdateTagData {
  name?: string;
  color?: string;
}

// API Response types
export interface TodoApiResponse<T> {
  success: boolean;
  error?: string;
  todo?: T;
  todos?: T[];
  project?: Project;
  projects?: Project[];
  tag?: Tag;
  tags?: Tag[];
  stats?: TodoStats;
  id?: number;
}
