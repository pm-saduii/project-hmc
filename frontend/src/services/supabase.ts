// ===== SUPABASE CLIENT FOR FRONTEND =====
// Connection to Supabase PostgreSQL database
//
// Usage: import { supabase } from '../services/supabase'

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — running in demo mode'
  );
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder'
);

/**
 * Test Supabase connection
 */
export async function testSupabaseConnection(): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('projects')
      .select('count', { count: 'exact', head: true });
    if (error) throw error;
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if Supabase is configured (env vars present)
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}
