import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLES } from '../config/dynamo.js';

const SETTINGS_PK = 'global-settings';

const DEFAULT_PACKAGES = [
  {
    id: 'basico',
    nombre: 'Básico',
    precio: 450,
    periodo: 'mes',
    features: [
      'Acceso a todas las máquinas',
      'Vestidores y casilleros',
      'Horario completo',
      'Evaluación inicial',
    ],
    color: '#4A90D9',
    destacado: false,
  },
  {
    id: 'premium',
    nombre: 'Premium',
    precio: 850,
    periodo: 'mes',
    features: [
      'Todo lo del plan Básico',
      'Clases grupales ilimitadas',
      'App de seguimiento',
      'Asesoría nutricional básica',
    ],
    color: '#CF1B36',
    destacado: true,
  },
  {
    id: 'elite',
    nombre: 'Elite',
    precio: 1200,
    periodo: 'mes',
    features: [
      'Todo lo del plan Premium',
      'Coach personal dedicado',
      'Plan nutricional personalizado',
      'Suplementos con 10% dto',
    ],
    color: '#9B59B6',
    destacado: false,
  },
];

function normalizePackage(pkg = {}, idx = 0) {
  const rawPeriodo = String(pkg.periodo || '').trim().toLowerCase();
  const periodo = rawPeriodo === 'año' || rawPeriodo === 'anio' ? 'año' : 'mes';
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

const DEFAULT_CALENDAR = [
  { id: 'ev-1', fecha: '2026-01-10', titulo: 'Master class de fuerza', descripcion: 'Clase especial de técnica en sentadilla y peso muerto.' },
  { id: 'ev-2', fecha: '2026-01-15', titulo: 'Reto cardio', descripcion: 'Sesión grupal de resistencia de 60 minutos.' },
];

function normalizeSettings(item) {
  if (!item) {
    return {
      settingsId: SETTINGS_PK,
      packages: DEFAULT_PACKAGES,
      schedule: DEFAULT_SCHEDULE,
      calendar: DEFAULT_CALENDAR,
    };
  }
  return {
    settingsId: SETTINGS_PK,
    packages: Array.isArray(item.packages)
      ? item.packages.map((pkg, idx) => normalizePackage(pkg, idx))
      : DEFAULT_PACKAGES,
    schedule: item.schedule || DEFAULT_SCHEDULE,
    calendar: Array.isArray(item.calendar) ? item.calendar : DEFAULT_CALENDAR,
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
    schedule: all.schedule,
    calendar: all.calendar,
  };
}
