function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function optional(name: string, fallback?: string): string | undefined {
  return process.env[name] ?? fallback;
}

export const env = {
  NEXT_PUBLIC_SUPABASE_URL: required('NEXT_PUBLIC_SUPABASE_URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: required('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  SUPABASE_SERVICE_ROLE_KEY: required('SUPABASE_SERVICE_ROLE_KEY'),
  SUPABASE_DB_POOLER_URL: required('SUPABASE_DB_POOLER_URL'),
  OPENAI_API_KEY: optional('OPENAI_API_KEY'),
  OPENAI_EXPENSE_MODEL: optional('OPENAI_EXPENSE_MODEL', 'gpt-4o'),
  OPENAI_ASSISTANT_MODEL: optional('OPENAI_ASSISTANT_MODEL', 'gpt-4o'),
  PORT: Number(process.env.PORT ?? 8080),
};
