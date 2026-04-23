export type Currency = 'UZS' | 'USD' | 'RUB';

export function formatPrice(
  price: number | string | null | undefined,
  currency: Currency | string = 'USD',
): string {
  if (price == null || price === '') return '';
  const numPrice = Number(price);
  if (isNaN(numPrice)) return String(price);

  // Format with basic separators for thousands
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(numPrice).replace(/,/g, ' ');

  switch (currency) {
    case 'UZS':
      return `${formatted} so'm`;
    case 'USD':
      return `$${formatted}`;
    case 'RUB':
      return `${formatted} ₽`;
    default:
      return `${formatted} ${currency}`;
  }
}
