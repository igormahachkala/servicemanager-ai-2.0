type CategoryShape = {
  id: string;
  name: string;
  instructions?: string | null;
};

type LocationShape = {
  id: string;
  name: string;
  city?: string | null;
  address?: string | null;
  platformCode?: string | null;
};

export type TicketDescriptionInput = {
  category: CategoryShape;
  location: LocationShape;
  title?: string | null;
  description?: string | null;
};

export type BuiltTicketDescription = {
  title: string;
  description: string;
  possibleCauses: string[];
  recommendedActions: string[];
};

function normalizeLine(value?: string | null) {
  return (value || '').trim().replace(/\s+/g, ' ');
}

function splitInstructionHints(instructions?: string | null) {
  const normalized = (instructions || '')
    .split(/\r?\n|[.;]/)
    .map((part) => normalizeLine(part))
    .filter(Boolean);

  return normalized.slice(0, 3);
}

export function buildTicketDescription(input: TicketDescriptionInput): BuiltTicketDescription {
  const categoryName = normalizeLine(input.category.name) || 'Service request';
  const locationName = normalizeLine(input.location.name) || 'selected location';
  const locationTail = [normalizeLine(input.location.city), normalizeLine(input.location.address)]
    .filter(Boolean)
    .join(', ');
  const locationLabel = locationTail ? `${locationName} (${locationTail})` : locationName;

  const possibleCauses = splitInstructionHints(input.category.instructions);
  const recommendedActions = [
    `Проверить точку ${locationLabel}.`,
    `Подтвердить категорию "${categoryName}" на месте.`,
    possibleCauses[0] ? `Начать с проверки: ${possibleCauses[0]}.` : 'Выполнить первичную диагностику по категории.',
  ];

  const generatedTitle = normalizeLine(input.title) || categoryName;
  const generatedDescription =
    normalizeLine(input.description) ||
    [
      `Быстрый запрос по категории "${categoryName}".`,
      `Локация: ${locationLabel}.`,
      input.category.instructions ? `Инструкция категории: ${normalizeLine(input.category.instructions)}.` : 'Требуется диагностика и подтверждение причины на месте.',
    ].join(' ');

  return {
    title: generatedTitle,
    description: generatedDescription,
    possibleCauses,
    recommendedActions,
  };
}
