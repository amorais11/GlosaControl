
import { MedicalProcedure } from '../types';

const DB_KEY = 'medglosa_procedures';

export const dbService = {
  getProcedures: (): MedicalProcedure[] => {
    const data = localStorage.getItem(DB_KEY);
    return data ? JSON.parse(data) : [];
  },

  saveProcedure: (procedure: Omit<MedicalProcedure, 'id'>) => {
    const procedures = dbService.getProcedures();
    const newProcedure: MedicalProcedure = {
      ...procedure,
      id: crypto.randomUUID(),
    };
    procedures.push(newProcedure);
    localStorage.setItem(DB_KEY, JSON.stringify(procedures));
    return newProcedure;
  },

  updateProcedure: (updatedProcedure: MedicalProcedure) => {
    const procedures = dbService.getProcedures();
    const updated = procedures.map(p => p.id === updatedProcedure.id ? updatedProcedure : p);
    localStorage.setItem(DB_KEY, JSON.stringify(updated));
  },

  updateReceivedStatus: (id: string, status: MedicalProcedure['receivedStatus'], notes?: string) => {
    const procedures = dbService.getProcedures();
    const updated = procedures.map(p => {
      if (p.id === id) {
        return { ...p, receivedStatus: status, notes: notes ?? p.notes };
      }
      return p;
    });
    localStorage.setItem(DB_KEY, JSON.stringify(updated));
  },

  updateProcedureStatus: (patientName: string, date: string, procedureName: string, status: MedicalProcedure['status'], glosaAmount?: number) => {
    const procedures = dbService.getProcedures();
    const updated = procedures.map(p => {
      const matchName = p.patientName.toLowerCase().trim() === patientName.toLowerCase().trim();
      const matchDate = p.date === date;
      const matchProc = p.procedureName.toLowerCase().includes(procedureName.toLowerCase());
      
      if (matchName && matchDate && matchProc) {
        return { ...p, status, glosaAmount };
      }
      return p;
    });
    localStorage.setItem(DB_KEY, JSON.stringify(updated));
  }
};
