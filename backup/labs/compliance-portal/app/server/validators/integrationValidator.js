import { AppError } from "../exceptions/AppError.js";

export function validateIntegrationConfig(req, res, next) {
  const { storeUrl, apiKey } = req.body;
  if (!storeUrl || !storeUrl.startsWith("http")) {
    return next(new AppError("Invalid EverShop Store URL: Must start with http:// or https://", 400));
  }
  if (!apiKey || apiKey.trim().length < 10) {
    return next(new AppError("Invalid API Key: Must be at least 10 characters long.", 400));
  }
  next();
}
