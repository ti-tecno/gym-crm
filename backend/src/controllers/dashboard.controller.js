import * as clientesRepo from '../repositories/clientes.repo.js';
import * as pagosRepo from '../repositories/pagos.repo.js';
import * as invRepo from '../repositories/inventario.repo.js';
import * as nomRepo from '../repositories/nomina.repo.js';

export async function summary(_req, res, next) {
  try {
    const [clientes, pagos, inventario, nomina] = await Promise.all([
      clientesRepo.listClientes({ limit: 100 }),
      pagosRepo.listPagos({ limit: 5 }),
      invRepo.listInventario(),
      nomRepo.listEmpleados(),
    ]);

    const today = new Date();
    const enDias = (iso) => Math.ceil((new Date(iso) - today) / 86_400_000);
    const activos = clientes.filter((c) => c.estado === 'Activo').length;
    const porVencer = clientes.filter((c) => { const d = enDias(c.vencimiento); return d > 0 && d <= 7; }).length;
    const vencidos = clientes.filter((c) => c.estado === 'Vencido').length;
    const ingresosMes = pagos.reduce((acc, p) => acc + Number(p.monto || 0), 0);
    const stockBajo = inventario.filter((i) => i.estado !== 'OK').length;
    const nominaPendiente = nomina.filter((n) => n.estado === 'Pendiente').length;

    res.json({
      kpis: { activos, ingresosMes, porVencer, vencidos, stockBajo, nominaPendiente },
      ultimosPagos: pagos,
      alertas: [
        vencidos ? `${vencidos} cliente(s) con pago vencido` : null,
        stockBajo ? `${stockBajo} artículo(s) bajo o crítico` : null,
        nominaPendiente ? `${nominaPendiente} nómina(s) pendiente(s)` : null,
      ].filter(Boolean),
      // Mock semanal para gráfico (se reemplaza por datos reales cuando exista la tabla de asistencias)
      asistenciaSemanal: [65, 78, 82, 60, 90, 95, 72],
    });
  } catch (e) { next(e); }
}
