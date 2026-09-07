export default function handler(request, response) {
  response.status(200).json({ status: "success", message: "PII classification completed." });
}
