export interface APIResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

export interface PaginatedResponse<T> extends APIResponse<T> {
  page: number
  totalPages: number
  totalItems: number
}
