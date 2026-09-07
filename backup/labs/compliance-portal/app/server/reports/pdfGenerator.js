export async function generatePdf(name, data) {
  // Simulate compilation delay and return mocked buffer / metadata
  await new Promise(resolve => setTimeout(resolve, 300));
  return {
    filename: `${name.toLowerCase().replace(/\s+/g, "_")}.pdf`,
    contentType: "application/pdf",
    content: Buffer.from("MOCK_PDF_DATA")
  };
}
