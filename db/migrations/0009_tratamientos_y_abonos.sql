-- 0009 · Control de cuentas por paciente: tratamientos y abonos (no es pasarela ni facturación).
-- Pesos colombianos, enteros. Totales, saldos y estado de pago se CALCULAN (vistas), nunca se guardan.

CREATE TABLE tratamiento (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id     uuid NOT NULL REFERENCES paciente (id) ON DELETE RESTRICT,
  servicio_id     uuid REFERENCES servicio (id) ON DELETE RESTRICT,
  descripcion     text NOT NULL DEFAULT '' CHECK (length(descripcion) <= 500),
  -- Valor acordado al crear. No se reescribe nunca: los ajustes quedan como eventos.
  costo_inicial   integer NOT NULL CHECK (costo_inicial >= 0 AND costo_inicial <= 1000000000),
  -- Valor vigente tras los ajustes (descuentos o cambios del plan).
  costo_total     integer NOT NULL CHECK (costo_total >= 0 AND costo_total <= 1000000000),
  estado          text NOT NULL DEFAULT 'presupuestado'
                  CHECK (estado IN ('presupuestado', 'en_curso', 'terminado', 'cancelado')),
  -- Solo al cancelar: valor de lo realizado. El saldo se calcula contra este valor.
  valor_realizado integer CHECK (valor_realizado IS NULL OR (valor_realizado >= 0 AND valor_realizado <= 1000000000)),
  fecha_inicio    date,
  fecha_fin       date,
  notas           text NOT NULL DEFAULT '' CHECK (length(notas) <= 2000),
  creado_por      text,
  creado_en       timestamptz NOT NULL DEFAULT now(),
  actualizado_en  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tratamiento_con_que CHECK (servicio_id IS NOT NULL OR length(trim(descripcion)) > 0),
  CONSTRAINT tratamiento_cancelado_con_valor CHECK ((estado = 'cancelado') = (valor_realizado IS NOT NULL)),
  CONSTRAINT tratamiento_fechas CHECK (fecha_fin IS NULL OR fecha_inicio IS NULL OR fecha_fin >= fecha_inicio)
);

CREATE INDEX tratamiento_paciente_idx ON tratamiento (paciente_id, creado_en DESC);

CREATE TRIGGER tratamiento_actualizado BEFORE UPDATE ON tratamiento
  FOR EACH ROW EXECUTE FUNCTION marcar_actualizado();

-- Historial: creación, ajustes de costo (antes, después y motivo), cambios de estado, cancelación, abonos.
-- DPF (no construido): cuotas con fechas de pago y estado "en mora" se colgarían de `tratamiento` en otra tabla.
CREATE TABLE tratamiento_evento (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tratamiento_id  uuid NOT NULL REFERENCES tratamiento (id) ON DELETE RESTRICT,
  tipo            text NOT NULL CHECK (tipo IN ('creado', 'costo_ajustado', 'estado_cambiado', 'cancelado',
                                                'abono_registrado', 'abono_anulado', 'paciente_cambiado', 'editado')),
  antes           jsonb,
  despues         jsonb,
  motivo          text,
  actor_id        text,
  ocurrido_en     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX tratamiento_evento_idx ON tratamiento_evento (tratamiento_id, id);

CREATE TRIGGER tratamiento_evento_solo_insercion BEFORE UPDATE OR DELETE ON tratamiento_evento
  FOR EACH ROW EXECUTE FUNCTION solo_insercion();

-- Abono: no se borra; se anula una sola vez, con motivo.
CREATE TABLE abono (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tratamiento_id          uuid NOT NULL REFERENCES tratamiento (id) ON DELETE RESTRICT,
  valor                   integer NOT NULL CHECK (valor > 0 AND valor <= 1000000000),
  fecha                   date NOT NULL,
  medio                   text NOT NULL CHECK (medio IN ('efectivo', 'transferencia', 'tarjeta', 'otro')),
  referencia              text NOT NULL DEFAULT '' CHECK (length(referencia) <= 120),
  registrado_por          text,
  -- Confirmación explícita de que este abono deja saldo a favor del paciente.
  confirma_saldo_a_favor  boolean NOT NULL DEFAULT false,
  creado_en               timestamptz NOT NULL DEFAULT now(),
  anulado_en              timestamptz,
  anulado_por             text,
  motivo_anulacion        text CHECK (motivo_anulacion IS NULL OR length(motivo_anulacion) BETWEEN 3 AND 300),
  CONSTRAINT abono_anulacion_completa CHECK ((anulado_en IS NULL) = (motivo_anulacion IS NULL))
);

CREATE INDEX abono_tratamiento_idx ON abono (tratamiento_id) WHERE anulado_en IS NULL;
CREATE INDEX abono_fecha_idx ON abono (fecha) WHERE anulado_en IS NULL;

-- Valor contra el que se mide la deuda: el costo vigente, o lo realizado si se canceló.
CREATE FUNCTION tratamiento_base(estado text, costo_total integer, valor_realizado integer) RETURNS integer
  LANGUAGE sql IMMUTABLE AS $$ SELECT CASE WHEN estado = 'cancelado' THEN valor_realizado ELSE costo_total END $$;

-- Tope: la suma de abonos vigentes no supera la base, salvo confirmación explícita de saldo a favor.
-- Bloquea la fila del tratamiento: dos abonos simultáneos no pueden pasarse del tope.
CREATE FUNCTION abono_verificar_tope() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  t record;
  vigentes bigint;
BEGIN
  SELECT estado, costo_total, valor_realizado INTO t FROM tratamiento WHERE id = NEW.tratamiento_id FOR UPDATE;
  SELECT coalesce(sum(valor), 0) INTO vigentes FROM abono WHERE tratamiento_id = NEW.tratamiento_id AND anulado_en IS NULL;
  IF vigentes + NEW.valor > tratamiento_base(t.estado, t.costo_total, t.valor_realizado) AND NOT NEW.confirma_saldo_a_favor THEN
    RAISE EXCEPTION 'TOPE_ABONOS: % excede la base en %', NEW.valor,
      vigentes + NEW.valor - tratamiento_base(t.estado, t.costo_total, t.valor_realizado)
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER abono_tope BEFORE INSERT ON abono FOR EACH ROW EXECUTE FUNCTION abono_verificar_tope();

-- Un abono no se borra ni se edita: solo se anula, una vez, sin cambiar nada más.
CREATE FUNCTION abono_proteger() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.anulado_en IS NULL AND NEW.anulado_en IS NOT NULL
     AND (to_jsonb(NEW) - 'anulado_en' - 'anulado_por' - 'motivo_anulacion')
       = (to_jsonb(OLD) - 'anulado_en' - 'anulado_por' - 'motivo_anulacion') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'abono no se borra ni se edita: solo se anula, una vez, con motivo';
END;
$$;

CREATE TRIGGER abono_proteger BEFORE UPDATE OR DELETE ON abono FOR EACH ROW EXECUTE FUNCTION abono_proteger();

-- Al bajar el costo o cancelar con un valor realizado menor a lo abonado, también exige confirmación.
-- La función de dominio activa `app.confirmar_saldo_a_favor` solo cuando el usuario lo confirmó.
-- `costo_inicial` no cambia nunca.
CREATE FUNCTION tratamiento_verificar_cambios() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  vigentes bigint;
BEGIN
  IF NEW.costo_inicial <> OLD.costo_inicial THEN
    RAISE EXCEPTION 'costo_inicial no se modifica: los ajustes quedan como eventos';
  END IF;
  IF tratamiento_base(NEW.estado, NEW.costo_total, NEW.valor_realizado)
     < tratamiento_base(OLD.estado, OLD.costo_total, OLD.valor_realizado) THEN
    SELECT coalesce(sum(valor), 0) INTO vigentes FROM abono WHERE tratamiento_id = NEW.id AND anulado_en IS NULL;
    IF vigentes > tratamiento_base(NEW.estado, NEW.costo_total, NEW.valor_realizado)
       AND coalesce(current_setting('app.confirmar_saldo_a_favor', true), '') <> 'on' THEN
      RAISE EXCEPTION 'TOPE_ABONOS: lo abonado supera el nuevo valor en %',
        vigentes - tratamiento_base(NEW.estado, NEW.costo_total, NEW.valor_realizado)
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tratamiento_cambios BEFORE UPDATE ON tratamiento FOR EACH ROW EXECUTE FUNCTION tratamiento_verificar_cambios();

-- ---------------------------------------------------------------------------
-- Vistas (cálculo al leer). DPF: un tratamiento "presupuestado" aún no es deuda: no cuenta en la cartera
-- ni en el estado de pago del paciente, aunque sí puede recibir abonos (anticipos).
-- ---------------------------------------------------------------------------
CREATE VIEW tratamiento_saldo AS
SELECT
  t.id AS tratamiento_id,
  t.paciente_id,
  t.estado,
  tratamiento_base(t.estado, t.costo_total, t.valor_realizado) AS base,
  coalesce(a.abonado, 0)::integer AS abonado,
  (tratamiento_base(t.estado, t.costo_total, t.valor_realizado) - coalesce(a.abonado, 0))::integer AS saldo,
  CASE
    WHEN tratamiento_base(t.estado, t.costo_total, t.valor_realizado) - coalesce(a.abonado, 0) < 0 THEN 'saldo_a_favor'
    WHEN tratamiento_base(t.estado, t.costo_total, t.valor_realizado) - coalesce(a.abonado, 0) = 0 THEN 'saldado'
    WHEN coalesce(a.abonado, 0) = 0 THEN 'sin_abonos'
    ELSE 'con_saldo'
  END AS estado_pago
FROM tratamiento t
LEFT JOIN (
  SELECT tratamiento_id, sum(valor) AS abonado FROM abono WHERE anulado_en IS NULL GROUP BY tratamiento_id
) a ON a.tratamiento_id = t.id;

CREATE VIEW paciente_cartera AS
SELECT
  p.id AS paciente_id,
  coalesce(sum(ts.base), 0)::integer AS deuda,
  coalesce(sum(ts.abonado), 0)::integer AS abonado,
  coalesce(sum(ts.saldo), 0)::integer AS saldo,
  CASE
    WHEN count(ts.tratamiento_id) = 0 THEN 'sin_tratamientos'
    WHEN coalesce(sum(ts.saldo), 0) < 0 THEN 'saldo_a_favor'
    WHEN coalesce(sum(ts.saldo), 0) = 0 THEN 'saldado'
    WHEN coalesce(sum(ts.abonado), 0) = 0 THEN 'sin_abonos'
    ELSE 'con_saldo'
  END AS estado_pago,
  (SELECT min(c.inicio) FROM cita c
    WHERE c.paciente_id = p.id AND c.estado IN ('pendiente', 'confirmada') AND c.inicio > now()) AS proxima_cita
FROM paciente p
LEFT JOIN tratamiento_saldo ts ON ts.paciente_id = p.id AND ts.estado <> 'presupuestado'
GROUP BY p.id;
