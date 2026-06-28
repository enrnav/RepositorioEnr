/**
 * ============================================================================
 * CONFIGURACIÓN DE DATADOG BROWSER RUM (Real User Monitoring)
 * ============================================================================
 * 
 * Para activar el monitoreo de Datadog en el Frontend, sigue estos pasos:
 * 
 * 1. Instala el SDK ejecutando en tu terminal:
 *    cd frontend
 *    npm install @datadog/browser-rum
 * 
 * 2. Configura tus credenciales de Datadog en este archivo (applicationId, clientToken, etc.).
 * 
 * 3. Descomenta todo el bloque de código de inicialización a continuación.
 * 
 * 4. Descomenta la importación de este archivo en 'frontend/src/main.jsx':
 *    import './monitoring/datadog';
 * ============================================================================
 */

/*
import { datadogRum } from '@datadog/browser-rum';

datadogRum.init({
  applicationId: 'TU_APPLICATION_ID', // Reemplazar con el ID de aplicación de tu dashboard de Datadog
  clientToken: 'TU_CLIENT_TOKEN',     // Reemplazar con el token de cliente generado en Datadog
  site: 'datadoghq.com',               // Cambiar a 'datadoghq.eu' si tu cuenta está en la región europea
  service: 'abarrotes-frontend',
  env: 'production',                   // Opciones: 'development', 'staging', 'production'
  version: '1.0.0',
  sessionSampleRate: 100,              // % de sesiones a rastrear (100 = todas)
  sessionReplaySampleRate: 20,         // % de sesiones grabadas en video/interacción
  trackUserInteractions: true,         // Rastrear clics y toques del usuario
  trackResources: true,                // Rastrear assets cargados, llamadas a APIs
  trackLongTasks: true,                // Rastrear tareas que bloqueen la UI
  defaultPrivacyLevel: 'mask-user-input', // Oculta datos sensibles escritos por el usuario
});

// Iniciar grabación de repetición de sesión
datadogRum.startSessionReplayRecording();
*/
