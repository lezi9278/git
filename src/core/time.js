export function toDateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function toMonthKey(value = new Date()) {
  return toDateKey(value).slice(0, 7);
}

export function parseLocalDateTime(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    return null;
  }
  const [yearText, monthText, dayText, hourText, minuteText] = value
    .split(/[-T:]/)
    .map(Number);
  const date = new Date(yearText, monthText - 1, dayText, hourText, minuteText, 0, 0);
  if (
    date.getFullYear() !== yearText ||
    date.getMonth() !== monthText - 1 ||
    date.getDate() !== dayText ||
    date.getHours() !== hourText ||
    date.getMinutes() !== minuteText
  ) {
    return null;
  }
  return date;
}

export function isValidDateKey(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

export function isValidDateTimeValue(value) {
  return parseLocalDateTime(value) !== null;
}

export function addMinutesToLocalDateTime(value, minutes) {
  const date = parseLocalDateTime(value);
  if (!date) {
    return null;
  }
  date.setMinutes(date.getMinutes() + minutes);
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatLocalDateTime(value) {
  return typeof value === "string" ? value.replace("T", " ") : "";
}
