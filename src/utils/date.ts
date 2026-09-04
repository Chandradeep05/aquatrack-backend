export const getUTCDayRange = (dateInput?: Date | string) => {
  const date = dateInput ? new Date(dateInput) : new Date();
  const startOfDay = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0)
  );
  const endOfDay = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999)
  );
  const dateString = startOfDay.toISOString().split('T')[0];
  return { startOfDay, endOfDay, dateString };
};
