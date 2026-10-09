export const DDPRO_TIME_ZONE = "Europe/Istanbul";

const dateTimeFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: DDPRO_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

const getDateTimeParts = (date) =>
  Object.fromEntries(
    dateTimeFormatter.formatToParts(date)
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, Number(value)])
  );

const getDateTimeFormatter = (dateStyle, timeStyle) =>
  new Intl.DateTimeFormat("tr-TR", {
    ...(dateStyle === "short"
      ? { day: "2-digit", month: "2-digit", year: "numeric" }
      : dateStyle === "long"
        ? { day: "2-digit", month: "long", year: "numeric" }
        : { dateStyle }),
    ...(timeStyle ? { hour: "2-digit", minute: "2-digit" } : {}),
    hourCycle: "h23",
    timeZone: DDPRO_TIME_ZONE,
  });

export const formatDateTime = (value, { dateStyle = "short", timeStyle = "short" } = {}) => {
  if (value === undefined || value === null || value === "") return "";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : getDateTimeFormatter(dateStyle, timeStyle).format(date);
};

export const formatDateOnly = (value, { dateStyle = "short" } = {}) => {
  if (value === undefined || value === null || value === "") return "";
  const dateOnly = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = dateOnly ? new Date(`${value}T12:00:00.000Z`) : new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : getDateTimeFormatter(dateStyle).format(date);
};

export const toDateTimeLocalInput = (value) => {
  if (value === undefined || value === null || value === "") return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const { year, month, day, hour, minute } = getDateTimeParts(date);
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
};

export const fromDateTimeLocalInput = (value) => {
  const match = typeof value === "string" &&
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) throw new Error("Tarih ve saat Europe/Istanbul biçiminde olmalıdır.");
  const [, yearText, monthText, dayText, hourText, minuteText, secondText = "0"] = match;
  const target = {
    year: Number(yearText),
    month: Number(monthText),
    day: Number(dayText),
    hour: Number(hourText),
    minute: Number(minuteText),
    second: Number(secondText),
  };
  const targetEpoch = Date.UTC(
    target.year,
    target.month - 1,
    target.day,
    target.hour,
    target.minute,
    target.second
  );
  const normalizedTarget = new Date(targetEpoch);
  if (
    normalizedTarget.getUTCFullYear() !== target.year ||
    normalizedTarget.getUTCMonth() + 1 !== target.month ||
    normalizedTarget.getUTCDate() !== target.day ||
    target.hour > 23 ||
    target.minute > 59 ||
    target.second > 59
  ) {
    throw new Error("Tarih ve saat geçerli değil.");
  }

  let epoch = targetEpoch;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const actual = getDateTimeParts(new Date(epoch));
    const actualEpoch = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second
    );
    const difference = targetEpoch - actualEpoch;
    epoch += difference;
    if (difference === 0) return new Date(epoch).toISOString();
  }
  throw new Error("Bu yerel saat Europe/Istanbul saat diliminde geçerli değil.");
};
