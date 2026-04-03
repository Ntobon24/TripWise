# TripWise

Aplicación web para planificar viajes según un **presupuesto** definido por el usuario. Incluye **frontend** (Angular), **API** (NestJS) y persistencia en **PostgreSQL** hospedado en **Supabase**.

---

## Tecnologías principales

| Área | Tecnología |
|------|------------|
| Lenguajes | **TypeScript** (frontend y backend) |
| Frontend | **Angular** (SPA, componentes standalone, HttpClient) |
| Backend | **Node.js** + **NestJS** (REST, JWT, validación con class-validator) |
| Base de datos | **PostgreSQL** en **Supabase** (conexión directa o *Session pooler* / `DATABASE_URL`) |
| ORM | **TypeORM** (entidades `users`, `travel_plans`) |
| Cliente Supabase | **@supabase/supabase-js** (uso opcional server-side) |
| Datos externos | **FlightAPI** (precios de vuelos ida) · **GeoDB** (RapidAPI, ciudades) · **OpenTripMap** (puntos de interés) |
| Autenticación API | **JWT** (Bearer) |

---

## Requisitos previos

1. **Node.js** (recomendado: **LTS 20.x o 22.x**). Comprueba con:
   ```bash
   node -v
   npm -v
   ```
2. **npm** (viene con Node).
3. Cuenta en **Supabase** con proyecto creado y contraseña de base de datos (o URI de conexión del panel **Connect**).
4. Claves opcionales para datos en vivo: **FlightAPI**, **GeoDB** (RapidAPI), **OpenTripMap** (ver `Backend/.env.example`).

---

## 1. Clonar el repositorio

```bash
git clone <url-de-tu-repo>
cd TripWise
```

---

## 2. Backend (NestJS)

```bash
cd Backend
npm install
```

### Variables de entorno

Crea el archivo **`Backend/.env`** (no lo subas a git; puedes partir de `Backend/.env.example`). Debe incluir al menos:

- **Base de datos**: `DATABASE_URL` (recomendado: URI de **Session pooler** desde Supabase → *Connect* → tipo **URI**) o variables `SUPABASE_*` según tu configuración.
- **JWT**: `JWT_SECRET` (cadena larga y aleatoria).
- **Supabase**: `SUPABASE_URL`, claves anon/publishable/secret según uses el cliente JS en el servidor.
- **Vuelos**: `FLIGHTAPI_API_KEY` — [FlightAPI](https://www.flightapi.io/) (precios vía endpoint *oneway trip*). Opcional: `FLIGHTAPI_REGION` (código ISO país, p. ej. `US`) si necesitas el path extendido; por defecto se prueba primero el formato documentado sin región y luego con región.
- **Ciudades**: `GEODB_RAPIDAPI_KEY`, `GEODB_RAPIDAPI_HOST=wft-geo-db.p.rapidapi.com` — [GeoDB Cities en RapidAPI](https://rapidapi.com/wirefreethought/api/geodb-cities).
- **Lugares**: `OPENTRIPMAP_API_KEY` — [OpenTripMap](https://opentripmap.io/docs).
- **Reservadas** (reconocidas en `GET /travel/status`, sin integración HTTP aún): `TRIPADVISOR_API_KEY`, `VIATOR_API_KEY`.

Si en Windows aparece **`ENOTFOUND`** al host `db.xxx.supabase.co`, usa la URI del **Session pooler** (IPv4) tal como la muestra Supabase.

### Ejecutar la API en desarrollo

```bash
cd Backend
npm run start:dev
```

Por defecto la API escucha en **http://localhost:3000**. Comprueba con:

- `GET http://localhost:3000/health`
- `GET http://localhost:3000/travel/status` — estado de integraciones

---

## 3. Frontend (Angular)

Angular CLI y dependencias se instalan en la carpeta del proyecto (no hace falta instalar `@angular/cli` de forma global).

```bash
cd Frontend
npm install
```

### URL del backend

Asegúrate de que la URL del API coincida con tu backend. En desarrollo suele estar en:

- `Frontend/src/environments/environment.development.ts` → `apiBaseUrl: 'http://localhost:3000'`

En producción, ajusta `Frontend/src/environments/environment.ts`.

### Ejecutar la aplicación web

```bash
cd Frontend
npm start
```

O, si `ng` no está en el PATH:

```bash
npx ng serve
```

Abre el navegador en **http://localhost:4200** (puerto por defecto de Angular).

---

## 4. Resumen rápido (dos terminales)

| Terminal | Carpeta | Comando |
|----------|---------|---------|
| 1 | `Backend` | `npm run start:dev` |
| 2 | `Frontend` | `npm start` |

Orden recomendado: primero el **backend**, luego el **frontend**.

---

## 5. Scripts útiles

**Backend**

- `npm run build` — compila a `dist/`
- `npm run start:prod` — ejecuta la build (tras `npm run build`)

**Frontend**

- `npm run build` — build de producción
- `npm test` — pruebas unitarias (Karma)

---

## Notas

- **Supabase Realtime**: los datos de negocio se guardan en Postgres; el cliente Realtime puede usarse desde el front con la `anon key` si activas tablas en `supabase_realtime`.
- **FlightAPI**: las búsquedas consumen créditos según el plan del proveedor; origen y destino admiten **2–8 letras** (p. ej. MX o MEX). Códigos ISO de dos letras conocidos (p. ej. MX) se mapean al aeropuerto principal en el backend antes de llamar a la API.
- **GeoDB** en la exploración de ciudades no siempre devuelve IATA de aeropuerto; para vuelos introduce manualmente códigos como `BOG`, `MAD`, etc.
- No compartas claves secretas ni subas `.env` al repositorio.
