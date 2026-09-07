export async function generateCsv(name, data) {
  // Simulate compilation delay and return mocked buffer / csv contents
  await new Promise(resolve => setTimeout(resolve, 200));
  return {
    filename: `${name.toLowerCase().replace(/\s+/g, "_")}.csv`,
    contentType: "text/csv",
    content: Buffer.from("id,name,status,timestamp\n1,Rahul Sharma,Approved,2026-08-04T10:30:00Z\n2,Priya Patel,Revoked,2026-08-04T09:15:00Z")
  };
}
