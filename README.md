# Sistema APR (Agua Potable Rural)

Plataforma web para la administración de un Comité APR: gestión de socios/usuarios, lecturas de medidor, boletas, morosidad, caja, convenios (repactaciones), avisos y pago en línea.

## Módulos principales

- **Usuarios/Socios:** administración de clientes, datos de contacto y número de cliente.
- **Lecturas:** registro y edición con trazabilidad; historial por mes/año; exportación a Excel.
- **Boletas y Morosidad:** cálculo de deuda, estados y seguimiento.
- **Caja:** apertura/cierre de caja, registro de pagos y egresos.
- **Repactaciones (Convenios):** creación y control de convenios de pago.
- **Cortes / Préstamos / Avisos:** gestión operativa.
- **Pago en línea:** integración con Mercado Pago (retorno por éxito/fallo/pendiente + webhook).

## Roles

- **Administrador:** acceso completo a la administración.
- **Operador:** toma de lecturas (incluye soporte para foto del medidor).
- **Recaudador:** caja y registro de pagos.
- **Socio/Usuario:** portal de consulta y pagos.

## Arquitectura

- **Frontend:** React + Vite + Tailwind CSS (SPA)
- **Backend:** Node.js + Express
- **Base de datos:** PostgreSQL (Supabase)
- **Almacenamiento de fotos:** Supabase Storage (persistente)
- **Pagos:** Mercado Pago (preferencias, retornos y webhook)

## Despliegues (producción)

- **Frontend (Vercel):** `https://app-apr-frontend.vercel.app`
- **Backend/API (Render):** `https://app-apr.onrender.com`
- **DB (Supabase Postgres):** vía `DATABASE_URL`
- **Storage (Supabase):** bucket para fotos (operador/medidor)

## Requisitos

- Node.js (recomendado 18+)
- npm
- Acceso a Supabase (DB + Storage) y Mercado Pago (si se usa pago en línea)

## Instalación y ejecución (local)

### 1) Backend

```bash
cd backend
npm install
npm run dev
```

Por defecto levanta en `http://localhost:5000`.

### 2) Frontend

```bash
cd frontend
npm install
npm run dev
```

Por defecto levanta en `http://localhost:5173`.

## Variables de entorno

### Backend (`backend/.env`)

Ejemplo (no pegar secretos en repositorio):

```env
PORT=5000
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DB
JWT_SECRET=TU_SECRETO

# URLs
FRONTEND_URL=https://app-apr-frontend.vercel.app
BACKEND_URL=https://app-apr.onrender.com

# Mercado Pago
MP_ACCESS_TOKEN=APP_USR_...

# Supabase (Storage)
SUPABASE_URL=https://TU-PROYECTO.supabase.co
SUPABASE_ANON_KEY=eyJ...
```

Notas:
- `FRONTEND_URL` y `BACKEND_URL` se usan para construir `back_urls` y `notification_url` de Mercado Pago.
- El webhook de Mercado Pago es **POST** a: `/api/mercadopago/webhook`.

### Frontend (`frontend/.env` opcional)

El frontend detecta automáticamente el base URL (localhost vs producción). Si quieres forzarlo:

```env
VITE_API_URL=http://localhost:5000
```

## Comandos útiles

### Backend

- `npm run dev` inicia API con nodemon
- `npm run start` inicia API en modo producción

### Frontend

- `npm run dev` servidor de desarrollo
- `npm run build` build de producción
- `npm run preview` previsualización del build
- `npm run lint` eslint

## Flujo de pago en línea (Mercado Pago)

1. El frontend solicita al backend crear una preferencia.
2. El backend responde con `init_point` y el usuario es redirigido a Mercado Pago.
3. Mercado Pago retorna al frontend:
   - `/pago-exitoso`
   - `/pago-fallido`
   - `/pago-pendiente`
4. Mercado Pago notifica al backend vía webhook:
   - `POST /api/mercadopago/webhook`

## Estructura del repositorio

```text
app-apr/
  backend/   # API Node/Express
  frontend/  # React/Vite
```

