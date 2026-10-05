// rank order, lowest to highest — the dashboard relies on this order
export const BELT_LABELS: Record<string, string> = {
  practitioner: "Practitioner",
  white_belt: "White Belt",
  low_yellow: "Low Yellow",
  high_yellow: "High Yellow",
  low_blue: "Low Blue",
  high_blue: "High Blue",
  low_red: "Low Red",
  high_red: "High Red",
  low_brown: "Low Brown",
  high_brown: "High Brown",
  first_dan_black_belt: "1st Dan Black Belt",
  second_dan_black_belt: "2nd Dan Black Belt",
  third_dan_black_belt: "3rd Dan Black Belt",
  fourth_dan_black_belt: "4th Dan Black Belt",
};
export const BELT_COLORS: Record<string, string> = {
  practitioner: "bg-green-100 text-green-800 ring-green-300",
  white_belt: "bg-white text-gray-800 ring-gray-400",
  low_yellow: "bg-yellow-50 text-yellow-800 ring-yellow-200",
  high_yellow: "bg-yellow-400 text-yellow-950 ring-yellow-500",
  low_blue: "bg-blue-50 text-blue-800 ring-blue-200",
  high_blue: "bg-blue-600 text-white ring-blue-700",
  low_red: "bg-red-50 text-red-800 ring-red-200",
  high_red: "bg-red-600 text-white ring-red-700",
  low_brown: "bg-orange-50 text-orange-800 ring-orange-200",
  high_brown: "bg-orange-800 text-white ring-orange-900",
  first_dan_black_belt: "bg-gray-900 text-white ring-gray-600",
  second_dan_black_belt: "bg-gray-900 text-white ring-sky-500",
  third_dan_black_belt: "bg-gray-900 text-white ring-rose-500",
  fourth_dan_black_belt: "bg-gray-900 text-white ring-amber-500",
};

export const formatBeltLabel = (belt: string) => BELT_LABELS[belt] ?? belt;
