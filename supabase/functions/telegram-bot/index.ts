// Punto de entrada de la Edge Function: la logica esta en handler.ts.
import { handler } from './handler.ts'

Deno.serve(handler)
