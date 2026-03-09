const { AppError, ERROR_CODES } = require("./errors");
const { isDateStr, isMonthStr, compareDateStr } = require("./date");

function assertString(value, field, opts = {}) {
  const { required = true, maxLen = 255, minLen = 0 } = opts;
  if (value === undefined || value === null || value === "") {
    if (required) {
      throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, `${field}不能为空`);
    }
    return;
  }
  if (typeof value !== "string") {
    throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, `${field}必须是字符串`);
  }
  if (value.length < minLen || value.length > maxLen) {
    throw new AppError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      `${field}长度必须在${minLen}-${maxLen}之间`
    );
  }
}

function assertDate(value, field) {
  if (!isDateStr(value)) {
    throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, `${field}格式必须为yyyy-MM-dd`);
  }
}

function assertMonth(value, field) {
  if (!isMonthStr(value)) {
    throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, `${field}格式必须为yyyy-MM`);
  }
}

function assertDateRange(startDate, endDate, startField, endField) {
  if (!endDate) return;
  if (compareDateStr(startDate, endDate) > 0) {
    throw new AppError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      `${startField}不能晚于${endField}`
    );
  }
}

function assertEnum(value, field, enums) {
  if (!enums.includes(value)) {
    throw new AppError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      `${field}必须是[${enums.join(", ")}]之一`
    );
  }
}

module.exports = {
  assertString,
  assertDate,
  assertMonth,
  assertDateRange,
  assertEnum,
};
