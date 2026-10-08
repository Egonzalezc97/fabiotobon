# PROYECTO: PLATAFORMA DIGITAL PARA FABIO TOBÓN ODONTOLOGÍA

## 1. CONTEXTO

Estamos desarrollando una plataforma digital para el odontólogo **Fabio Tobón**.

El proyecto tiene tres grandes componentes que deben funcionar como un único ecosistema:

1. **Landing page pública para captación de pacientes.**
2. **Sistema privado de administración, CRM y agenda.**
3. **Agente de inteligencia artificial para WhatsApp.**

El objetivo no es crear solamente una página web bonita. Queremos construir una herramienta que permita a Fabio:

- atraer nuevos pacientes;
- mostrar sus procedimientos y resultados;
- recibir solicitudes de valoración;
- gestionar su agenda;
- administrar pacientes;
- consultar información clínica y administrativa;
- automatizar comunicaciones;
- reducir al mínimo la necesidad de una secretaria;
- convertir conversaciones de WhatsApp en citas reales.

La experiencia debe sentirse como un producto profesional de una clínica odontológica moderna, no como una página web genérica.

---

# 2. COMPONENTE 1 — LANDING PAGE PÚBLICA

La landing será la cara pública del proyecto y estará orientada principalmente a **convertir visitantes en pacientes**.

## Objetivo

La página debe generar confianza, mostrar resultados y provocar interés en los tratamientos.

No queremos una página excesivamente corporativa ni fría.

Debe transmitir:

- profesionalismo;
- confianza;
- higiene;
- tecnología;
- resultados;
- cercanía;
- exclusividad sin parecer inaccesible.

## Estilo visual

Utilizar principalmente:

- tonos grises;
- azul como color de identidad/acento;
- blanco;
- espacios amplios;
- tipografía moderna;
- fotografías de alta calidad;
- diseño premium y limpio.

Evitar una estética genérica de plantilla odontológica.

La interfaz debe ser moderna, elegante, rápida y responsive.

---

## Estructura inicial de la landing

### Home

Debe contener, como mínimo:

### Hero

Una sección inicial muy visual con:

- propuesta de valor;
- fotografía profesional;
- CTA para agendar valoración;
- CTA directo a WhatsApp.

El CTA principal debe conducir al proceso de agendamiento.

---

### Antes y después

Sección visual para mostrar resultados de procedimientos.

Ejemplo:

- diseño de sonrisa;
- rehabilitación oral;
- blanqueamiento;
- otros procedimientos que Fabio posteriormente defina.

Debe contemplarse que estas imágenes puedan ser administradas posteriormente desde el panel administrativo.

---

### Servicios / procedimientos

Crear inicialmente una lista razonable de procedimientos odontológicos que Fabio pueda ofrecer.

Por ejemplo:

- Diseño de sonrisa
- Rehabilitación oral
- Carillas
- Blanqueamiento dental
- Implantes dentales
- Coronas
- Endodoncia
- Ortodoncia
- Limpieza dental
- Restauraciones
- Extracciones
- Periodoncia
- Prótesis dentales
- Valoración odontológica

IMPORTANTE:

Esta lista es provisional.

Debe diseñarse el sistema para que Fabio pueda posteriormente:

- crear procedimientos;
- editar procedimientos;
- eliminar/desactivar procedimientos;
- modificar descripción;
- modificar duración;
- modificar precio si se decide mostrarlo;
- agregar imágenes.

No debemos asumir que todos estos servicios serán ofrecidos finalmente.

---

## Contacto

Debe existir una sección de contacto clara.

Debe incluir:

- información de contacto;
- ubicación;
- WhatsApp;
- botón para agendar valoración;
- información básica de atención.

---

## WhatsApp

Debe existir un CTA de WhatsApp visible en toda la experiencia pública.

Idealmente:

- botón flotante;
- CTA en hero;
- CTA después de servicios;
- CTA en contacto;
- CTA en secciones estratégicas.

---

# 3. SISTEMA DE AGENDAMIENTO PARA CLIENTES

Esta parte es crítica.

El cliente debe poder agendar una cita directamente desde la plataforma.

Pero el sistema debe distinguir entre:

## Paciente nuevo

Si una persona nunca ha tenido una cita con Fabio:

La única opción de cita disponible inicialmente será:

**Valoración odontológica.**

No debe poder seleccionar directamente procedimientos que requieren una evaluación previa.

---

## Paciente existente

Si la persona ya es paciente:

El sistema debe identificarla y permitirle seleccionar el tipo de cita/procedimiento que corresponda a su proceso.

Ejemplo:

Esteban González ya es paciente.

Podría visualizar:

- Control
- Diseño de sonrisa
- Sesión de procedimiento
- Blanqueamiento
- Rehabilitación
- etc.

Las opciones disponibles dependerán de la configuración de Fabio y/o del proceso del paciente.

---

# 4. DURACIÓN DE LOS PROCEDIMIENTOS

Cada tipo de cita debe tener una duración configurable.

Ejemplo:

- Valoración → 30 min
- Limpieza → 45 min
- Diseño de sonrisa → 2 horas
- Procedimiento X → 90 min

No hardcodear estas duraciones.

Deben poder administrarse desde el panel.

La agenda debe calcular automáticamente los espacios disponibles dependiendo de:

- duración del procedimiento;
- horario de Fabio;
- bloqueos;
- otros eventos;
- citas existentes;
- días no laborables.

---

# 5. PANEL ADMINISTRATIVO

Debe existir un sistema privado de administración.

Inicialmente tendrá como mínimo:

- Dashboard
- Agenda
- CRM / Pacientes
- Historia clínica
- Procedimientos/servicios
- Configuración

La arquitectura debe permitir agregar módulos posteriormente.

---

# 6. CRM DE PACIENTES

Fabio debe poder visualizar sus pacientes en una tabla.

Ejemplo:

| Paciente | Documento | Estado | Estado de pago | Próxima cita |
|---|---|---|---|---|
| Esteban González | XXXXX | Activo | Pagado | 20/10/2026 |

El sistema debe permitir:

- buscar pacientes;
- filtrar;
- abrir ficha individual;
- editar información;
- consultar historial;
- consultar citas;
- consultar pagos/deudas;
- consultar estado del paciente.

---

# 7. FICHA INDIVIDUAL DEL PACIENTE

Al abrir un paciente debe existir una vista completa.

Debe poder visualizarse:

### Información personal

- nombre;
- documento;
- teléfono;
- WhatsApp;
- email;
- fecha de nacimiento;
- información relevante.

### Estado administrativo

- pagos;
- saldo pendiente;
- tratamientos;
- estado del tratamiento.

### Agenda

- próxima cita;
- citas anteriores;
- citas canceladas;
- citas reprogramadas.

### Historia clínica

Debe existir un módulo de historia clínica asociado al paciente.

La estructura exacta de la historia clínica debe definirse posteriormente con Fabio, ya que contiene información médica y debe diseñarse cuidadosamente.

NO inventar campos clínicos definitivos sin validarlos con Fabio.

---

# 8. CALENDARIO / AGENDA

La agenda será uno de los módulos centrales del sistema.

Debe permitir a Fabio visualizar claramente su día, semana y, si resulta conveniente, mes.

Debe poder:

- crear eventos;
- editar eventos;
- eliminar eventos;
- reprogramar eventos;
- bloquear horarios;
- bloquear días completos;
- visualizar citas de pacientes;
- visualizar eventos personales/profesionales.

---

## BLOQUEOS DE AGENDA

Fabio debe poder decir:

"El martes no trabajo."

o:

"El jueves de 12:00 a 14:00 no estoy disponible."

Ejemplos:

- almuerzo;
- reunión;
- cita personal;
- vacaciones;
- día no laboral;
- mantenimiento;
- evento profesional.

Estos bloqueos deben afectar automáticamente la disponibilidad pública.

Para el cliente simplemente aparecerá:

**No disponible.**

El cliente NO debe conocer el motivo interno del bloqueo.

---

# 9. RESERVAS

Cuando un cliente agenda:

1. El sistema valida disponibilidad.
2. Se crea la cita.
3. Se registra la cita en el CRM.
4. Se actualiza la agenda de Fabio.
5. Se envía confirmación al cliente.
6. Se envía confirmación a Fabio.

---

# 10. RECORDATORIOS

Para el cliente:

- confirmación inmediatamente después de reservar;
- recordatorio 24 horas antes;
- recordatorio 1 hora antes.

Para Fabio:

- notificación cuando se crea una nueva cita;
- recordatorio 1 hora antes.

---

# 11. CANCELACIONES

El cliente debe poder cancelar su cita mediante el mecanismo definido por el sistema.

Cuando una cita sea cancelada:

- se actualiza la agenda;
- se actualiza el CRM;
- se notifica al cliente;
- se notifica a Fabio.

Debe quedar registro de la cancelación.

---

# 12. REPROGRAMACIONES

Si el cliente reprograma:

1. se libera el espacio anterior;
2. se valida el nuevo horario;
3. se crea/actualiza la nueva cita;
4. se actualizan los registros;
5. se notifican ambas partes.

Las notificaciones deben indicar claramente el nuevo horario.

---

# 13. WHATSAPP + AGENTE DE IA

El tercer componente es un agente de IA conectado a WhatsApp.

Fabio actualmente no tiene secretaria.

La intención es construir un agente que funcione como primer punto de contacto con sus pacientes.

El agente debe comunicarse de forma natural, profesional y cercana, como representante de Fabio.

NO queremos un bot robótico basado exclusivamente en menús.

---

# 14. FUNCIONES DEL AGENTE

El agente debe poder responder preguntas frecuentes relacionadas con:

- procedimientos;
- información general;
- ubicación;
- horarios;
- preparación;
- cuidados generales;
- disponibilidad;
- proceso de valoración;
- información comercial autorizada.

---

# 15. PRECIOS

Si un cliente pregunta:

"¿Cuánto cuesta un diseño de sonrisa?"

El agente puede responder con información previamente autorizada por Fabio.

Pero el objetivo comercial no debe ser simplemente entregar un precio y terminar la conversación.

Debe conducir naturalmente hacia:

**"Si quieres conocer cuál sería la mejor opción para tu caso, podemos agendar una valoración con Fabio."**

Y posteriormente ofrecer el enlace de agenda.

---

# 16. CONVERSIÓN DE WHATSAPP A CITA

Ejemplo conceptual:

Cliente:

"Hola, quiero saber cuánto cuesta un diseño de sonrisa."

IA:

Responde la información autorizada.

Después:

"Para saber exactamente qué tratamiento necesitas y darte una recomendación adecuada, lo ideal es realizar una valoración con Fabio. Si quieres, puedo ayudarte a agendarla."

Si el cliente acepta:

IA → proporciona enlace de agenda.

El cliente completa el proceso.

La cita queda registrada automáticamente en el sistema.

---

# 17. EL AGENTE NO DEBE INVENTAR INFORMACIÓN

Esto es MUY importante.

El agente jamás debe inventar:

- precios;
- diagnósticos;
- tratamientos;
- disponibilidad;
- horarios;
- resultados;
- información clínica;
- promociones;
- políticas.

Debe responder únicamente utilizando información autorizada y disponible en el sistema.

Cuando no tenga información suficiente debe reconocerlo y derivar a valoración o contacto humano.

---

# 18. ARQUITECTURA GENERAL

Los tres componentes deben compartir información.

Conceptualmente:

CLIENTE
↓
LANDING
↓
WHATSAPP / AGENDA
↓
CITA
↓
CRM
↓
HISTORIA CLÍNICA
↓
SEGUIMIENTO

Y paralelamente:

WHATSAPP
↓
AGENTE IA
↓
AGENDA
↓
CRM

La información no debe duplicarse innecesariamente.

Una cita creada desde:

- la landing;
- el panel administrativo;
- WhatsApp;

debe terminar representando la misma entidad de cita dentro del sistema.

---

# 19. PRINCIPIOS DE DESARROLLO

Antes de comenzar a programar:

1. Analiza completamente estos requerimientos.
2. Identifica ambigüedades.
3. Identifica funcionalidades faltantes.
4. Propón arquitectura.
5. Propón estructura de base de datos.
6. Propón estructura de módulos.
7. Propón flujo de autenticación/autorización.
8. Propón integración de WhatsApp.
9. Propón sistema de notificaciones.
10. Propón estrategia de calendario y disponibilidad.
11. Identifica riesgos técnicos.
12. Identifica información que debemos confirmar con Fabio.

NO empieces inmediatamente a construir todo.

Primero presenta una propuesta técnica y funcional.

---

# 20. PRINCIPIO FUNDAMENTAL

Queremos construir un sistema real que pueda utilizar Fabio diariamente.

Por lo tanto:

- evitar sobreingeniería innecesaria;
- evitar funcionalidades decorativas;
- evitar duplicación;
- evitar hardcodear reglas de negocio;
- mantener arquitectura escalable;
- priorizar seguridad;
- priorizar mantenibilidad;
- priorizar una excelente experiencia de usuario.

El sistema debe estar preparado para crecer posteriormente.

---

# 21. FASES PROPUESTAS

Propón un desarrollo por fases.

Una posible estructura sería:

### FASE 1
Landing + identidad visual + servicios + contacto + WhatsApp.

### FASE 2
Usuarios + pacientes + CRM + autenticación.

### FASE 3
Agenda + disponibilidad + bloqueos + reservas.

### FASE 4
Notificaciones + cancelaciones + reprogramaciones.

### FASE 5
Historia clínica.

### FASE 6
WhatsApp + agente IA.

### FASE 7
Optimización, seguridad, pruebas y despliegue.

Pero puedes modificar estas fases si encuentras una estructura técnicamente superior.

---

# 22. TU PRIMERA TAREA

Antes de escribir código, quiero que actúes como:

- arquitecto de software;
- product manager;
- UX/UI designer;
- desarrollador full-stack senior.

Analiza este documento y entrégame:

1. Arquitectura propuesta.
2. Stack tecnológico recomendado y justificación.
3. Estructura del proyecto.
4. Modelo de datos inicial.
5. Entidades principales.
6. Relaciones entre entidades.
7. Flujo completo de reserva.
8. Flujo de cancelación.
9. Flujo de reprogramación.
10. Arquitectura del calendario.
11. Arquitectura del CRM.
12. Arquitectura del agente de WhatsApp.
13. Sistema de notificaciones.
14. Seguridad y roles.
15. Riesgos técnicos.
16. Información que debemos preguntarle a Fabio antes de continuar.
17. División recomendada por fases/MVP.

No escribas todavía toda la aplicación.

Primero quiero revisar y aprobar la arquitectura.

Una vez aprobada, construiremos el proyecto progresivamente.

## REGLA IMPORTANTE

Cuando una decisión de negocio no esté definida, NO la inventes.

Márcala como:

**DECISIÓN PENDIENTE DE FABIO**

y propón las alternativas disponibles.

El objetivo es que el código termine reflejando las necesidades reales de Fabio y no supuestos inventados durante el desarrollo.