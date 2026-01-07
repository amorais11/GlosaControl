
export interface MedicalProcedure {
  id: string;
  patientName: string;
  date: string;
  procedureName: string;
  tussCode?: string;
  insurance: 'Particular' | 'Publico' | 'Unimed';
  paymentMethod?: 'Dinheiro' | 'Sicredi' | 'Banco do Brasil';
  procedureValue: number;
  status: 'pending' | 'paid' | 'glosa';
  receivedStatus: 'recebido' | 'nao_recebido';
  notes?: string;
  glosaAmount?: number;
}

export interface GlosaReportItem {
  patientName: string;
  date: string;
  procedure: string;
  tussCode?: string;
  honoAmount: number;
  glosaAmount: number;
  totalPaid: number;
  isGlosa: boolean;
}
