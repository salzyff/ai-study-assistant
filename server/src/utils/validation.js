export class RequestValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "RequestValidationError";
    this.statusCode = 400;
  }
}

export function stringField(value, name, options = {}) {
  const {
    required = true,
    min = required ? 1 : 0,
    max = 500,
  } = options;

  if (value === undefined || value === null || value === "") {
    if (!required) return null;
    throw new RequestValidationError(`${name} is required`);
  }

  if (typeof value !== "string") {
    throw new RequestValidationError(`${name} must be text`);
  }

  const cleanValue = value.trim();

  if (cleanValue.length < min) {
    throw new RequestValidationError(`${name} is too short`);
  }

  if (cleanValue.length > max) {
    throw new RequestValidationError(`${name} must be ${max} characters or fewer`);
  }

  return cleanValue;
}

export function integerField(value, name, options = {}) {
  const { required = true, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = options;

  if (value === undefined || value === null || value === "") {
    if (!required) return null;
    throw new RequestValidationError(`${name} is required`);
  }

  const number = Number(value);

  if (!Number.isInteger(number) || number < min || number > max) {
    throw new RequestValidationError(`${name} must be a whole number from ${min} to ${max}`);
  }

  return number;
}

export function enumField(value, name, allowedValues, fallback = null) {
  const selectedValue = value ?? fallback;

  if (!allowedValues.includes(selectedValue)) {
    throw new RequestValidationError(`${name} must be one of: ${allowedValues.join(", ")}`);
  }

  return selectedValue;
}

export function uuidField(value, name, options = {}) {
  const { required = true } = options;

  if ((value === undefined || value === null || value === "") && !required) {
    return null;
  }

  const cleanValue = stringField(value, name, { max: 50 });
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!uuidPattern.test(cleanValue)) {
    throw new RequestValidationError(`${name} must be a valid id`);
  }

  return cleanValue;
}

export function dateField(value, name, options = {}) {
  const { required = false } = options;

  if ((value === undefined || value === null || value === "") && !required) {
    return null;
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    throw new RequestValidationError(`${name} must be a valid date`);
  }

  return parsedDate.toISOString();
}

export function validateBody(validator) {
  return (req, res, next) => {
    try {
      req.validatedBody = validator(req.body || {});
      next();
    } catch (error) {
      if (error instanceof RequestValidationError) {
        return res.status(error.statusCode).json({ error: error.message });
      }

      next(error);
    }
  };
}
