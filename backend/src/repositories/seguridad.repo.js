/**
 * Registros de seguridad en gym_settings (misma tabla, misma llave `settingsId`; sin índices ni
 * tablas nuevas). Son ítems APARTE del de contenido ("global-settings"), así:
 *  - guardar Paquetes, Coaches, etc. (saveSettings hace leer-combinar-escribir del ítem global)
 *    nunca los toca ni los borra;
 *  - GET /settings/public y GET /settings/admin (que solo leen "global-settings") nunca los
 *    devuelven.
 *
 *   "sitio-seguridad"         teléfono del administrador y credenciales de MP cifradas
 *   "otp-admin#<userId>"      código de un solo uso vigente de ese usuario (solo hash)
 *
 * Cada ítem lleva `version` y toda escritura es condicional (bloqueo optimista): dos peticiones
 * simultáneas nunca pisan el cambio de la otra y un código no se puede usar dos veces.
 *
 * Fábrica con el cliente inyectado (no importa config/dynamo.js) para poder probarla sin BD.
 */
export const ID_SEGURIDAD = 'sitio-seguridad';
export const idOtp = (userId) => `otp-admin#${userId}`;

export function crearRepoSeguridad({ ddb, tabla, GetCommand, PutCommand }) {
  async function leer(settingsId) {
    const { Item } = await ddb.send(new GetCommand({ TableName: tabla, Key: { settingsId }, ConsistentRead: true }));
    return Item || null;
  }

  /**
   * Escribe el ítem completo si su versión sigue siendo `versionEsperada` (null = no debe existir).
   * Devuelve el ítem escrito, o null si otra petición lo cambió antes.
   */
  async function escribir(item, versionEsperada) {
    const nuevo = { ...item, version: (Number(versionEsperada) || 0) + 1, updatedAt: new Date().toISOString() };
    const condicion = versionEsperada == null
      ? { ConditionExpression: 'attribute_not_exists(settingsId)' }
      : { ConditionExpression: '#v = :v', ExpressionAttributeNames: { '#v': 'version' }, ExpressionAttributeValues: { ':v': versionEsperada } };
    try {
      await ddb.send(new PutCommand({ TableName: tabla, Item: nuevo, ...condicion }));
      return nuevo;
    } catch (e) {
      if (e?.name === 'ConditionalCheckFailedException') return null;
      throw e;
    }
  }

  return { leer, escribir };
}
