export const APP_ROUTES = {
  HOME: '/',
  DASHBOARD: '/dashboard',
  VERIFY: '/verify',
  REGISTER: '/register',
  DOCUMENT: (id: string) => `/document/${id}`
};

export const STORAGE_KEYS = {
  TOKEN: 'ltn_token',
  USER: 'ltn_user'
};
