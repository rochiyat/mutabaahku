// Sesuai Google Form "Mutaba'ah Yaumiah UPA Cilbar" dan bobot di PLANNING.md bagian 3.

const perDay = (unit, noneLabel) => [
  ...[7, 6, 5, 4, 3, 2, 1].map((n) => ({ label: `${n} ${unit}`, score: Math.round((n / 7) * 100) })),
  { label: noneLabel, score: 0 },
];

const yesNo = [
  { label: 'Ya', score: 100 },
  { label: 'Tidak', score: 0 },
];

const jamaah = [
  { label: '7 Kali', score: 100 },
  { label: '4-6 Kali', score: 70 },
  { label: 'Kurang dari 4 Kali', score: 35 },
  { label: 'Tidak Pernah', score: 0 },
];

export const indicators = [
  {
    code: 'tilawah',
    label: 'Tilawah Sepekan',
    type: 'choice',
    options: [
      ...perDay('Lembar', 'Tidak Tilawah').slice(0, 7),
      { label: 'Kurang 1 Lembar', score: 5 },
      { label: 'Tidak Tilawah', score: 0 },
    ],
  },
  { code: 'dhuha', label: 'Sholat Dhuha Sepekan', type: 'choice', options: perDay('Kali', 'Tidak Mengerjakan') },
  { code: 'jamaah_shubuh', label: 'Sholat Berjamaah Shubuh Sepekan', type: 'choice', options: jamaah },
  { code: 'jamaah_isya', label: "Sholat Berjamaah Isya Sepekan", type: 'choice', options: jamaah },
  { code: 'qiyamul_lail', label: 'Qiyamul Lail Sepekan', type: 'choice', options: perDay('Kali', 'Tidak Mengerjakan') },
  {
    code: 'matsurat',
    label: "Al Ma'tsurat Sepekan",
    type: 'choice',
    options: [
      { label: 'Lebih dari 3 Kali', score: 100 },
      { label: '3 Kali', score: 75 },
      { label: 'Kurang dari 3 Kali', score: 40 },
      { label: 'Tidak Mengerjakan', score: 0 },
    ],
  },
  {
    code: 'rawatib',
    label: 'Rawatib Harian',
    type: 'choice',
    options: [
      { label: 'Lebih dari 4 rakaat sehari', score: 100 },
      { label: 'Stabil tercapai minimal 4 rakaat sehari', score: 80 },
      { label: 'Kurang dari 4 rakaat sehari', score: 40 },
    ],
  },
  {
    code: 'istighfar_sholawat',
    label: 'Istighfar dan Sholawat Harian',
    type: 'choice',
    options: [
      { label: '100 kali rutin', score: 100 },
      { label: '100 kali kadang-kadang', score: 65 },
      { label: 'Kurang dari 100 kali', score: 35 },
      { label: 'Hampir tidak pernah mengerjakan', score: 0 },
    ],
  },
  { code: 'infaq', label: 'Infaq Pekan Ini', type: 'boolean', options: yesNo },
  { code: 'silaturahmi', label: 'Silaturahmi Pekan Ini', type: 'boolean', options: yesNo },
  { code: 'olahraga', label: 'Olah Raga/Riyadhah Pekan Ini', type: 'boolean', options: yesNo },
  { code: 'birrul_walidain', label: 'Birrul Walidain Pekan Ini (minimal mendoakan)', type: 'boolean', options: yesNo },
];
