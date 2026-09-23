// rank order, lowest to highest — the dashboard relies on this order
export const BELT_LABELS: Record<string, string> = {
  practitioner: 'Practitioner',
  white_belt: 'White Belt',
  low_yellow: 'Low Yellow',
  high_yellow: 'High Yellow',
  low_blue: 'Low Blue',
  high_blue: 'High Blue',
  low_red: 'Low Red',
  high_red: 'High Red',
  low_brown: 'Low Brown',
  high_brown: 'High Brown',
  first_dan_black_belt: '1st Dan Black Belt',
  second_dan_black_belt: '2nd Dan Black Belt',
  third_dan_black_belt: '3rd Dan Black Belt',
  fourth_dan_black_belt: '4th Dan Black Belt',
}

export const formatBeltLabel = (belt: string) => BELT_LABELS[belt] ?? belt
