const RAW_API_URL = import.meta.env.VITE_API_URL;

export const API_BASE_URL = RAW_API_URL ?? '';
export const API_DISPLAY_URL = RAW_API_URL || 'http://localhost:8800';
