// Ruoli lavoratore = stessa sorgente unica dei ruoli annuncio.
import { JOB_ROLES, type JobRole } from "@/lib/job-roles";

export const WORKER_ROLES = JOB_ROLES;

export type WorkerRole = JobRole;