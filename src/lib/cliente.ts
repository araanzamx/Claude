import type { Api } from './api';
import { crearDemoApi } from './demoApi';
import { crearSupabaseApi } from './supabaseApi';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const api: Api = url && anonKey ? crearSupabaseApi(url, anonKey) : crearDemoApi();
