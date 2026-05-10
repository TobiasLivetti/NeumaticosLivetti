-- ============================================================
-- Neumaticos Livetti — Schema
-- ============================================================

CREATE TABLE IF NOT EXISTS productos (
  id                     SERIAL PRIMARY KEY,
  medida                 VARCHAR(20)    NOT NULL,
  marca                  VARCHAR(50)    NOT NULL,
  rodado                 INTEGER,
  tipo                   VARCHAR(20),
  rotacion               VARCHAR(10),
  estado                 VARCHAR(20),
  cantidad               INTEGER        NOT NULL DEFAULT 0,
  costo                  NUMERIC(12,2)  NOT NULL DEFAULT 0,
  precio_manual          NUMERIC(12,2),
  precio_minorista_x2    NUMERIC(12,2),
  precio_minorista_x4    NUMERIC(12,2),
  precio_minorista_6c    NUMERIC(12,2),
  precio_reventa_a       NUMERIC(12,2),
  precio_reventa_b       NUMERIC(12,2),
  UNIQUE (medida, marca)
);

CREATE TABLE IF NOT EXISTS proveedores (
  id      SERIAL PRIMARY KEY,
  nombre  VARCHAR(50) NOT NULL,
  cuenta  VARCHAR(50),
  UNIQUE (nombre, cuenta)
);

CREATE TABLE IF NOT EXISTS pedidos_proveedor (
  id               SERIAL PRIMARY KEY,
  proveedor_id     INTEGER        NOT NULL REFERENCES proveedores(id),
  numero_factura   VARCHAR(20),
  ingreso          DATE           NOT NULL,
  fecha_pagar      DATE,
  importe_tt       NUMERIC(12,2)  NOT NULL DEFAULT 0,
  importe_lf       NUMERIC(12,2)  NOT NULL DEFAULT 0,
  estado           VARCHAR(10)    NOT NULL DEFAULT 'ABIERTO',
  observaciones    TEXT,
  created_at       TIMESTAMP      DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS factura_items (
  id               SERIAL PRIMARY KEY,
  pedido_id        INTEGER        NOT NULL REFERENCES pedidos_proveedor(id),
  producto_id      INTEGER        NOT NULL REFERENCES productos(id),
  cantidad         INTEGER        NOT NULL,
  costo_unitario   NUMERIC(12,2)  NOT NULL
);

CREATE TABLE IF NOT EXISTS pagos_proveedor (
  id            SERIAL PRIMARY KEY,
  proveedor_id  INTEGER        NOT NULL REFERENCES proveedores(id),
  fecha         DATE           NOT NULL,
  monto         NUMERIC(12,2)  NOT NULL,
  metodo        VARCHAR(20),
  pagador       VARCHAR(5)     NOT NULL CHECK (pagador IN ('TT', 'LF')),
  observaciones TEXT,
  created_at    TIMESTAMP      DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clientes (
  id      SERIAL PRIMARY KEY,
  nombre  VARCHAR(100) NOT NULL,
  tipo    VARCHAR(20)  CHECK (tipo IN ('REVENDEDOR', 'CONSUMIDOR_FINAL', 'UNICO')),
  telefono VARCHAR(20),
  zona    VARCHAR(50),
  scc_id  INTEGER
);

CREATE TABLE IF NOT EXISTS ventas (
  id          SERIAL PRIMARY KEY,
  cliente_id  INTEGER        REFERENCES clientes(id),
  fecha       DATE           NOT NULL,
  medio_pago  VARCHAR(20),
  total       NUMERIC(12,2),
  created_at  TIMESTAMP      DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS venta_items (
  id               SERIAL PRIMARY KEY,
  venta_id         INTEGER        NOT NULL REFERENCES ventas(id),
  producto_id      INTEGER        NOT NULL REFERENCES productos(id),
  cantidad         INTEGER        NOT NULL,
  precio_unitario  NUMERIC(12,2)  NOT NULL,
  costo_unitario   NUMERIC(12,2)  NOT NULL
);

CREATE TABLE IF NOT EXISTS movimientos (
  id               SERIAL PRIMARY KEY,
  fecha            DATE          NOT NULL,
  tipo             VARCHAR(10)   NOT NULL CHECK (tipo IN ('INGRESO', 'EGRESO')),
  concepto         VARCHAR(100),
  cuenta           VARCHAR(20)   CHECK (cuenta IN ('EFECTIVO', 'TRANSFERENCIA', 'RESERVA')),
  monto            NUMERIC(12,2) NOT NULL,
  referencia_tipo  VARCHAR(20),
  referencia_id    INTEGER,
  created_at       TIMESTAMP     DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS deudas_clientes (
  id               SERIAL PRIMARY KEY,
  cliente_id       INTEGER        NOT NULL REFERENCES clientes(id),
  venta_id         INTEGER        REFERENCES ventas(id),
  monto_original   NUMERIC(12,2)  NOT NULL,
  monto_pendiente  NUMERIC(12,2)  NOT NULL,
  fecha            DATE           NOT NULL,
  vencimiento      DATE,
  estado           VARCHAR(10)    NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE', 'COBRADO')),
  created_at       TIMESTAMP      DEFAULT NOW()
);

-- Proveedores base
INSERT INTO proveedores (nombre, cuenta) VALUES
  ('NEUMASUR',  NULL),
  ('CALZETTA',  NULL),
  ('SARACHO',   'mat'),
  ('SARACHO',   'escobar'),
  ('MIX',       NULL)
ON CONFLICT DO NOTHING;
