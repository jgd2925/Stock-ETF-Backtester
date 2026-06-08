import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface PaperTrade {
  id: string;
  user_id: string;
  symbol: string;
  name: string;
  type: "buy" | "sell";
  quantity: number;
  price: number;
  currency: string;
  created_at: string;
}
