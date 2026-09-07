// AppError carries the numeric code in `statusCode`; its `status` field holds
// the word "fail"/"error". Reading `status` here made res.status("fail") throw
// RangeError, turning every 400 into a 500 HTML stack trace.
const errorHandler = (err, req, res, next) => {
  const status = Number.isInteger(err.statusCode) ? err.statusCode
    : Number.isInteger(err.status) ? err.status
    : 500;
  if (status >= 500) console.error(err.stack);
  res.status(status).json({ error: err.message || "Internal Server Error", status });
};

export { errorHandler };
