# Seguridad y secretos

## Qué sí guarda GitHub

- Código fuente.
- Esquema y migraciones.
- Archivos públicos de diseño.
- Plantilla Excel.
- Nombres de variables requeridas.

## Qué nunca debe guardarse

- `SUPABASE_SERVICE_ROLE_KEY`.
- Contraseñas o correos de empleados exportados.
- Cookies, tokens de sesión o tokens de GitHub.
- Copias de la base D1 con información real.
- Archivos `.env.local` o equivalentes.

## Controles existentes

- Cookie `HttpOnly`, `Secure` y `SameSite=Strict`.
- Token local aleatorio y hash SHA-256 almacenado en D1.
- Verificación de mismo origen para escrituras de cuenta.
- Permisos por rol comprobados en el servidor.
- Función Edge separada para acciones que requieren privilegios de Supabase.
- Bitácora con usuario, rol, acción y fecha.

## Si una llave se publica por accidente

1. Revócala o rótala inmediatamente en el proveedor correspondiente.
2. Elimínala del archivo y del historial de Git.
3. Revisa los registros de acceso.
4. No basta con crear otro commit que la borre: la llave anterior seguiría visible en el historial.
