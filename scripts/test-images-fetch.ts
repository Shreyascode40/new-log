const urls = [
  "/media/group-members/cmv0x2kup000htmhlncftdvvv-1791548407989.jpg",
  "/media/group-members/cmv0x2kup000itmhl0sxcc3nf-1791548500898.jpg",
  "/media/group-members/cmv0x2kup000jtmhla7onvof1-1791550138705.png",
  "/media/group-members/cmv0x2kup000ktmhlzlpz0naf-1791550151969.png",
];

async function main() {
  for (const url of urls) {
    const fullUrl = `http://localhost:3000${url}`;
    try {
      const res = await fetch(fullUrl);
      console.log(`${url} -> HTTP ${res.status}, content-type: ${res.headers.get("content-type")}, bytes: ${(await res.arrayBuffer()).byteLength}`);
    } catch (e: any) {
      console.error(`${url} -> ERROR:`, e.message);
    }
  }
}

main();
