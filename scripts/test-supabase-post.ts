import { loadEnvFile } from "node:process";
try { loadEnvFile(".env"); } catch {}

async function main() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const res = await fetch(`${url}/storage/v1/object/logbook-private-uploads/test.txt`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      apikey: key,
      "content-type": "text/plain",
    },
    body: "hello",
  });
  console.log("Status:", res.status, res.ok, await res.text());
}

main().catch(console.error);
