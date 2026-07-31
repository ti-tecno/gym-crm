import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLES } from '../config/dynamo.js';

const SETTINGS_PK = 'global-settings';

const DEFAULT_PACKAGES = [
  {
    id: 'mensual',
    nombre: 'Mensual',
    precio: 500,
    periodo: 'mes',
    features: [
      'Acceso completo al gimnasio',
      'Vestidores y casilleros',
      'Horario completo',
      'Sin permanencia mínima',
    ],
    color: '#4A90D9',
    destacado: false,
  },
  {
    id: 'estudiante',
    nombre: 'Estudiante',
    precio: 400,
    periodo: 'mes',
    features: [
      'Acceso completo al gimnasio',
      'Válido con credencial de estudiante vigente',
      'Vestidores y casilleros',
      'Horario completo',
    ],
    color: '#2ECC71',
    destacado: false,
  },
  {
    id: 'trimestre',
    nombre: 'Trimestre',
    precio: 1450,
    periodo: 'trimestre',
    features: [
      'Todo lo del plan Mensual',
      'Ahorra vs. pagar mes a mes',
      'Evaluación física inicial',
      'Acceso a clases grupales',
    ],
    color: '#CF1B36',
    destacado: true,
  },
  {
    id: 'semestre',
    nombre: 'Semestre',
    precio: 2500,
    periodo: 'semestre',
    features: [
      'Todo lo del plan Trimestre',
      'Mayor ahorro por mes',
      'Seguimiento de progreso',
      'Asesoría nutricional básica',
    ],
    color: '#9B59B6',
    destacado: false,
  },
  {
    id: 'anual',
    nombre: 'Anual',
    precio: 2999,
    periodo: 'anualidad',
    features: [
      'Todo lo del plan Semestre',
      'El mejor precio por mes',
      'Plan de entrenamiento personalizado',
      'Congelamiento de membresía disponible',
    ],
    color: '#E8A33D',
    destacado: false,
  },
];

const DEFAULT_PROMOTIONS = [
  {
    id: 'promo-3x2',
    nombre: '3x2 en Membresía',
    descripcion: 'Paga 2 meses y llévate el tercero gratis.',
    precio: 999,
    periodo: '3 meses',
    badge: '3X2',
    color: '#CF1B36',
  },
  {
    id: 'promo-pareja',
    nombre: 'Promo Pareja',
    descripcion: 'Inscríbete junto a tu pareja y ambos entrenan con descuento especial.',
    precio: 950,
    periodo: 'mes (los dos)',
    badge: 'PAREJA',
    color: '#9B59B6',
  },
];

const PERIODOS_VALIDOS = ['trimestre', 'semestre', 'anualidad', 'mes', 'año'];

function normalizePeriodo(raw) {
  const v = String(raw || '').trim().toLowerCase();
  if (v === 'anio') return 'año';
  return PERIODOS_VALIDOS.includes(v) ? v : 'trimestre';
}

function normalizePackage(pkg = {}, idx = 0) {
  const periodo = normalizePeriodo(pkg.periodo);
  return {
    id: String(pkg.id || '').trim() || `plan-${idx + 1}`,
    nombre: String(pkg.nombre || '').trim() || `Plan ${idx + 1}`,
    precio: Number.isFinite(Number(pkg.precio)) ? Number(pkg.precio) : 0,
    periodo,
    features: Array.isArray(pkg.features)
      ? pkg.features.map((f) => String(f).trim()).filter(Boolean)
      : [],
    color: String(pkg.color || '').trim() || '#4A90D9',
    destacado: !!pkg.destacado,
  };
}

const DEFAULT_SCHEDULE = {
  days: ['LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES'],
  classColors: {
    ZUMBA: '#E07840',
    PILATES: '#3BAFC7',
    'CARDIO BOX': '#3D8B66',
    'MUAY THAI': '#C97088',
    'DANZA URBANA': '#8B5BB5',
    YOGA: '#C4B830',
  },
  slots: [
    { time: '8:00 – 8:50 a.m.', classes: [null, 'ZUMBA', null, 'ZUMBA', null] },
    { time: '9:00 – 9:50 a.m.', classes: ['PILATES', 'CARDIO BOX', 'PILATES', 'CARDIO BOX', 'ZUMBA'] },
    { time: '10:00 – 10:50 a.m.', classes: [null, null, null, null, 'PILATES'] },
    { time: '5:00 – 5:50 p.m.', classes: ['MUAY THAI', null, null, null, null] },
    { time: '6:00 – 6:50 p.m.', classes: ['ZUMBA', null, 'MUAY THAI', 'ZUMBA', 'MUAY THAI'] },
    { time: '7:00 – 7:50 p.m.', classes: ['DANZA URBANA', 'YOGA', 'DANZA URBANA', 'YOGA', 'DANZA URBANA'] },
    { time: '8:00 – 8:50 p.m.', classes: [null, 'PILATES', null, null, null] },
  ],
};

const DEFAULT_COACHES = [
  {
    id: 'coach-1',
    name: 'Arnold Schwarzenegger',
    role: 'Hipertrofia & Fuerza',
    desc: 'Planificación avanzada para desarrollo muscular, volumen y progresión de cargas.',
    image: '/images/coaches/arnoldo.png',
  },
  {
    id: 'coach-2',
    name: 'Chris Bumstead',
    role: 'Classic Physique',
    desc: 'Técnica, estética y estructura de entrenamiento para un físico balanceado y competitivo.',
    image: '/images/coaches/cbum.jpg',
  },
  {
    id: 'coach-3',
    name: 'Sergio Oliva',
    role: 'Potencia & Volumen',
    desc: 'Enfoque en densidad muscular, intensidad y ejecución en ejercicios compuestos.',
    image: '/images/coaches/oliva.jpg',
  },
  {
    id: 'coach-4',
    name: 'Ronnie Coleman',
    role: 'Entrenamiento de Alto Rendimiento',
    desc: 'Rutinas de alta exigencia para fuerza máxima, disciplina y rendimiento total.',
    image: '/images/coaches/ronnie.png',
  },
];

const DEFAULT_CALENDAR = [
  { id: 'ev-1', fecha: '2026-01-10', titulo: 'Master class de fuerza', descripcion: 'Clase especial de técnica en sentadilla y peso muerto.' },
  { id: 'ev-2', fecha: '2026-01-15', titulo: 'Reto cardio', descripcion: 'Sesión grupal de resistencia de 60 minutos.' },
];

function normalizeCoach(c = {}, idx = 0) {
  return {
    id: String(c.id || '').trim() || `coach-${idx + 1}`,
    name: String(c.name || '').trim() || `Coach ${idx + 1}`,
    role: String(c.role || '').trim(),
    desc: String(c.desc || '').trim(),
    image: String(c.image || '').trim(),
  };
}

function normalizeSettings(item) {
  if (!item) {
    return {
      settingsId: SETTINGS_PK,
      packages: DEFAULT_PACKAGES,
      promotions: DEFAULT_PROMOTIONS,
      schedule: DEFAULT_SCHEDULE,
      calendar: DEFAULT_CALENDAR,
      coaches: DEFAULT_COACHES,
    };
  }
  return {
    settingsId: SETTINGS_PK,
    packages: Array.isArray(item.packages)
      ? item.packages.map((pkg, idx) => normalizePackage(pkg, idx))
      : DEFAULT_PACKAGES,
    promotions: Array.isArray(item.promotions) && item.promotions.length > 0
      ? item.promotions
      : DEFAULT_PROMOTIONS,
    schedule: item.schedule || DEFAULT_SCHEDULE,
    calendar: Array.isArray(item.calendar) ? item.calendar : DEFAULT_CALENDAR,
    coaches: Array.isArray(item.coaches) && item.coaches.length > 0
      ? item.coaches.map((c, idx) => normalizeCoach(c, idx))
      : DEFAULT_COACHES,
  };
}

export async function getSettings() {
  const { Item } = await ddb.send(new GetCommand({
    TableName: TABLES.SETTINGS,
    Key: { settingsId: SETTINGS_PK },
  }));
  return normalizeSettings(Item);
}

export async function saveSettings(next) {
  const current = await getSettings();
  const merged = {
    ...current,
    ...next,
    settingsId: SETTINGS_PK,
    updatedAt: new Date().toISOString(),
  };
  await ddb.send(new PutCommand({
    TableName: TABLES.SETTINGS,
    Item: merged,
  }));
  return merged;
}

export async function getPublicSettings() {
  const all = await getSettings();
  return {
    packages: all.packages,
    promotions: all.promotions,
    schedule: all.schedule,
    calendar: all.calendar,
    coaches: all.coaches,
  };
}
