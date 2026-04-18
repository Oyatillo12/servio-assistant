const API = '/api';

// ── Types ──────────────────────────────────────────────────

export interface Product {
  id: number;
  name: string;
  description: string;
  price: number | null;
  isActive: boolean;
  clientId: number;
}

export interface Service {
  id: number;
  name: string;
  description: string;
  price: number | null;
  isActive: boolean;
  clientId: number;
}

export interface BotConfig {
  welcomeMessage?: string;
  menuButtons?: {
    products?: boolean;
    services?: boolean;
    order?: boolean;
    contact?: boolean;
    language?: boolean;
    aiChat?: boolean;
  };
  buttonIcons?: {
    products?: string;
    services?: string;
    order?: string;
    contact?: string;
    language?: string;
    aiChat?: string;
  };
  contactPhone?: string;
  contactWebsite?: string;
}

export interface Client {
  id: number;
  name: string;
  slug: string;
  systemPrompt: string;
  isActive: boolean;
  type: 'order' | 'lead';
  defaultLang: 'uz' | 'ru' | 'en';
  currency: 'UZS' | 'USD' | 'RUB';
  hasProducts: boolean;
  hasServices: boolean;
  adminChatId: number | null;
  botConfig: string | null;
  products: Product[];
  services: Service[];
  createdAt: string;
  updatedAt: string;
}

export interface AuthUser {
  id: number;
  login: string;
  email: string | null;
  phone: string | null;
  role: 'super_admin' | 'client_admin';
  clientId: number | null;
  isActive: boolean;
}

export interface AdminUser {
  id: number;
  login: string;
  email: string | null;
  phone: string | null;
  role: 'super_admin' | 'client_admin';
  clientId: number | null;
  isActive: boolean;
  createdAt: string;
}

export interface DashboardStats {
  totalClients: number;
  totalConversations: number;
  totalMessages: number;
  messagesToday: number;
  totalOrders: number;
  totalLeads: number;
  recentActivity: Array<{ clientId: number; clientName: string; messageCount: number }>;
  recentOrders: OrderData[];
  recentLeads: LeadData[];
}

export interface ChatMessage {
  id: number;
  chatId: number;
  clientId: number;
  role: 'user' | 'assistant';
  message: string;
  createdAt: string;
}

export interface OrderItemData {
  id: number;
  productId: number;
  productName: string;
  price: number | null;
  quantity: number;
}

export interface OrderData {
  id: number;
  chatId: number;
  clientId: number;
  items: OrderItemData[];
  phone: string;
  address: string | null;
  status: string;
  createdAt: string;
}

export interface LeadData {
  id: number;
  chatId: number;
  clientId: number;
  name: string;
  phone: string;
  notes: string | null;
  status: string;
  createdAt: string;
}

// ── HTTP helper ────────────────────────────────────────────

function getToken(): string | null {
  return localStorage.getItem('token');
}

async function request<T>(url: string, opts?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, { ...opts, headers });

  if (res.status === 401) {
    localStorage.removeItem('token');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status}: ${body}`);
  }

  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return undefined as T;
  }
  return res.json();
}

// ── API ────────────────────────────────────────────────────

export const api = {
  auth: {
    login: (login: string, password: string) =>
      request<{ token: string; user: AuthUser }>(`${API}/auth/login`, {
        method: 'POST',
        body: JSON.stringify({ login, password }),
      }),
    me: () => request<AuthUser>(`${API}/auth/me`),
  },

  users: {
    list: () => request<AdminUser[]>(`${API}/auth/users`),
    create: (data: { login: string; password: string; email?: string; phone?: string; role?: string; clientId?: number }) =>
      request<AdminUser>(`${API}/auth/users`, { method: 'POST', body: JSON.stringify(data) }),
    resetPassword: (id: number, newPassword: string) =>
      request<void>(`${API}/auth/users/${id}/reset-password`, {
        method: 'PATCH',
        body: JSON.stringify({ newPassword }),
      }),
    toggleActive: (id: number) =>
      request<{ isActive: boolean }>(`${API}/auth/users/${id}/active`, { method: 'PATCH' }),
    changePassword: (currentPassword: string, newPassword: string) =>
      request<void>(`${API}/auth/users/me/password`, {
        method: 'PATCH',
        body: JSON.stringify({ currentPassword, newPassword }),
      }),
  },

  clients: {
    list: () => request<Client[]>(`${API}/clients`),
    get: (id: number) => request<Client>(`${API}/clients/${id}`),
    create: (data: Partial<Client> & { adminCredentials?: { login: string; password: string } }) =>
      request<Client>(`${API}/clients`, { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<Client>) =>
      request<Client>(`${API}/clients/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id: number) =>
      request<void>(`${API}/clients/${id}`, { method: 'DELETE' }),
  },

  products: {
    add: (clientId: number, data: { name: string; description?: string; price?: number }) =>
      request<Product>(`${API}/clients/${clientId}/products`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (productId: number, data: { name?: string; description?: string; price?: number; isActive?: boolean }) =>
      request<Product>(`${API}/clients/products/${productId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    remove: (productId: number) =>
      request<void>(`${API}/clients/products/${productId}`, { method: 'DELETE' }),
  },

  services: {
    add: (clientId: number, data: { name: string; description?: string; price?: number }) =>
      request<Service>(`${API}/clients/${clientId}/services`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (serviceId: number, data: { name?: string; description?: string; price?: number; isActive?: boolean }) =>
      request<Service>(`${API}/clients/services/${serviceId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    remove: (serviceId: number) =>
      request<void>(`${API}/clients/services/${serviceId}`, { method: 'DELETE' }),
  },

  orders: {
    byClient: (clientId: number) =>
      request<OrderData[]>(`${API}/orders/client/${clientId}`),
    get: (id: number) =>
      request<OrderData>(`${API}/orders/${id}`),
    updateStatus: (id: number, status: string) =>
      request<void>(`${API}/orders/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
  },

  leads: {
    byClient: (clientId: number) =>
      request<LeadData[]>(`${API}/leads/client/${clientId}`),
    get: (id: number) =>
      request<LeadData>(`${API}/leads/${id}`),
    updateStatus: (id: number, status: string) =>
      request<void>(`${API}/leads/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
  },

  analytics: {
    dashboard: () => request<DashboardStats>(`${API}/analytics/dashboard`),
    messages: (clientId: number, page = 1) =>
      request<{ data: ChatMessage[]; total: number }>(
        `${API}/analytics/clients/${clientId}/messages?page=${page}&limit=50`,
      ),
  },

  ai: {
    generateDescription: (data: { name: string; type: 'product' | 'service'; keywords?: string }) =>
      request<{ description: string }>(`${API}/ai/generate-description`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },
};
