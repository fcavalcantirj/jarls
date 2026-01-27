const NORSE_FIRST_NAMES = [
  'Bjorn',
  'Ragnar',
  'Sigurd',
  'Ivar',
  'Harald',
  'Leif',
  'Erik',
  'Thorin',
  'Gunnar',
  'Olaf',
  'Sven',
  'Ulf',
  'Knut',
  'Freyja',
  'Astrid',
  'Helga',
  'Ingrid',
  'Sigrid',
  'Thyra',
  'Brynhild',
  'Gudrun',
  'Ragnhild',
  'Solveig',
  'Hilda',
  'Eira',
];

const NORSE_EPITHETS = [
  'the Bold',
  'the Brave',
  'the Wise',
  'the Red',
  'the Strong',
  'the Silent',
  'the Fierce',
  'Ironside',
  'Bloodaxe',
  'the Fair',
  'the Fearless',
  'Shieldbreaker',
  'the Swift',
  'Stormborn',
  'the Cunning',
  'Wolfheart',
  'the Unyielding',
  'Ravenclaw',
  'the Grim',
  'Frostbane',
];

export function generateNorseName(): string {
  const first = NORSE_FIRST_NAMES[Math.floor(Math.random() * NORSE_FIRST_NAMES.length)];
  const epithet = NORSE_EPITHETS[Math.floor(Math.random() * NORSE_EPITHETS.length)];
  return `${first} ${epithet}`;
}
