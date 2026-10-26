export const IMG = (n: string) => `${import.meta.env.BASE_URL}img/${n}`;

export interface Drop {
  key: string;
  holiday: string;
  hook: [string, string, string];
  font: string;
  flourish: string;
  field: string;
  ink: string;
  accent: string;
  hero: { photo: string; name: string; from: string; was: string };
  side: { photo: string; name: string; from: string }[];
}

export const DROPS: Drop[] = [
  {
    key: 'halloween',
    holiday: 'Halloween',
    hook: ['SLESS', 'AFTER DARK', 'TRICK OR TEE'],
    font: "'Creepster', cursive",
    flourish: 'treats, not tricks',
    field: '#1a0f2e',
    ink: '#f6f3eb',
    accent: '#ff7a1a',
    hero: { photo: 'product-660.jpg', name: 'Sless After Dark Halloween Tee', from: '20.00', was: '25.00' },
    side: [
      { photo: 'product-330.jpg', name: 'Heavy Blend Hoodie', from: '34.40' },
      { photo: 'product-238.jpg', name: 'Oversized Garment-Dyed Tee', from: '28.80' },
    ],
  },
  {
    key: 'thanksgiving',
    holiday: 'Thanksgiving',
    hook: ['BE', 'THANKFUL', 'FOR SLESS'],
    font: "'Rye', serif",
    flourish: 'pass the savings',
    field: '#f6f3eb',
    ink: '#0a0a0a',
    accent: '#c2410c',
    hero: { photo: 'product-260.jpg', name: 'Be Thankful for Sless! Triblend Tee', from: '38.40', was: '48.00' },
    side: [{ photo: 'product-323.jpg', name: 'Garment-Dyed Sweatshirt', from: '56.00' }],
  },
  {
    key: 'christmas',
    holiday: 'Christmas',
    hook: ['SLESS', 'IS CHEER', 'SLEIGH IT'],
    font: "'Mountains of Christmas', cursive",
    flourish: 'unwrap 20% off',
    field: '#0f3d26',
    ink: '#f6f3eb',
    accent: '#ffd700',
    hero: { photo: 'product-735.jpg', name: 'Sless Is Cheer Christmas Tee', from: '20.00', was: '25.00' },
    side: [{ photo: 'product-314.jpg', name: 'Heavy Blend Crewneck', from: '28.80' }],
  },
];
