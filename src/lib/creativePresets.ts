export type CreativePreset = {
  id: string;
  name: string;
  space: string;
  style: string;
  mood: string;
  prompt: string;
};

export const creativePresets: CreativePreset[] = [
  {
    id: 'luxury-villa',
    name: 'Luxury Villa',
    space: 'Living Room',
    style: 'Luxury',
    mood: 'Warm',
    prompt:
      'High-end private villa interior, generous proportions, premium stone and wood finishes, elegant furniture, refined architectural details, sophisticated warm atmosphere.',
  },
  {
    id: 'double-height',
    name: 'Double-height Living',
    space: 'Living Room',
    style: 'Contemporary',
    mood: 'Dramatic',
    prompt:
      'Double-height luxury living room with tall ceiling, large architectural glazing, dramatic vertical proportions and an impressive central lighting installation.',
  },
  {
    id: 'modern-mansion',
    name: 'Modern Mansion',
    space: 'Living Room',
    style: 'Modern',
    mood: 'Premium',
    prompt:
      'Large modern mansion interior with clean architecture, premium natural stone, dark timber, expansive glazing and refined contemporary furniture.',
  },
  {
    id: 'luxury-dining',
    name: 'Luxury Dining',
    space: 'Dining Room',
    style: 'Luxury',
    mood: 'Elegant',
    prompt:
      'Elegant formal dining room with premium dining furniture, stone and timber finishes, sophisticated table styling and strong visual focus on the chandelier.',
  },
  {
    id: 'hotel-lobby',
    name: 'Hotel Lobby',
    space: 'Hotel',
    style: 'Luxury',
    mood: 'Premium',
    prompt:
      'Five-star hotel lobby with generous ceiling height, elegant reception architecture, premium marble, refined seating and hospitality-grade interior design.',
  },
  {
    id: 'neo-classic',
    name: 'Neo Classic',
    space: 'Living Room',
    style: 'Classic',
    mood: 'Elegant',
    prompt:
      'Refined neo-classical luxury interior with elegant wall mouldings, symmetrical architecture, premium fabrics, stone details and sophisticated proportions.',
  },
];
