export function getLocalYMD(date = new Date(), timeZone = 'UTC') {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(date); // en-CA returns YYYY-MM-DD
  } catch (e) {
    // Fallback if timeZone is invalid
    return date.toISOString().split('T')[0];
  }
}
