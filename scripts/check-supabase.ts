import { loadEnvFile } from "node:process";
try { loadEnvFile(".env"); } catch {}
import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  console.log("Supabase URL:", url);
  const supabase = createClient(url, key);
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) {
    console.error("List buckets error:", error);
    return;
  }
  console.log("Buckets:", buckets?.map((b) => b.name));

  for (const b of buckets || []) {
    const { data: files } = await supabase.storage.from(b.name).list("group-members");
    console.log(`Files in ${b.name}/group-members:`, files?.map((f) => f.name));
  }
}

main().catch(console.error);
