import { supabase } from './supabase'

export async function getUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function signInWithEmail(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password })
}

export async function signOut() {
  return supabase.auth.signOut()
}