
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { dbService } from './services/dbService';
import { analyzePdfForGlosas } from './services/geminiService';
import { MedicalProcedure, GlosaReportItem } from './types';
import { 
  PlusIcon, 
  DocumentMagnifyingGlassIcon, 
  TableCellsIcon, 
  CheckCircleIcon,
  CloudArrowUpIcon,
  DocumentArrowDownIcon,
  XCircleIcon,
  PencilSquareIcon,
  ArrowPathIcon,
  MagnifyingGlassCircleIcon,
  ExclamationCircleIcon,
  FunnelIcon,
  BackspaceIcon,
  ListBulletIcon,
  ShieldCheckIcon,
  ShieldExclamationIcon,
  UsersIcon,
  BanknotesIcon
} from '@heroicons/react/24/outline';

export default function App() {
  const [procedures, setProcedures] = useState<MedicalProcedure[]>([]);
  const [patientName, setPatientName] = useState('');
  const [examDate, setExamDate] = useState('');
  const [procedureName, setProcedureName] = useState('');
  const [tussCode, setTussCode] = useState('');
  const [insurance, setInsurance] = useState<MedicalProcedure['insurance']>('Unimed');
  const [paymentMethod, setPaymentMethod] = useState<MedicalProcedure['paymentMethod']>('Dinheiro');
  const [procedureValue, setProcedureValue] = useState<string>('');
  
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [glosaReport, setGlosaReport] = useState<GlosaReportItem[]>([]);
  const [activeTab, setActiveTab] = useState<'register' | 'list' | 'analyze'>('register');

  const loadData = useCallback(() => {
    const data = dbService.getProcedures();
    setProcedures([...data]);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const normalize = (text: string) => text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

  const filteredProcedures = useMemo(() => {
    return procedures.filter(p => {
      if (!startDate && !endDate) return true;
      const [day, month, year] = p.date.split('/').map(Number);
      const procDate = new Date(year, month - 1, day);
      if (startDate) {
        const sDate = new Date(startDate);
        sDate.setHours(0, 0, 0, 0);
        if (procDate < sDate) return false;
      }
      if (endDate) {
        const eDate = new Date(endDate);
        eDate.setHours(23, 59, 59, 999);
        if (procDate > eDate) return false;
      }
      return true;
    });
  }, [procedures, startDate, endDate]);

  const glosaSummary = useMemo(() => {
    const glosados = glosaReport.filter(item => item.isGlosa);
    const totalGlosa = glosados.reduce((acc, curr) => acc + curr.glosaAmount, 0);
    const uniquePatients = Array.from(new Set(glosados.map(i => i.patientName)));
    return { totalGlosa, uniquePatients };
  }, [glosaReport]);

  const crossReferencedData = useMemo(() => {
    if (glosaReport.length === 0) return { matched: [], unmatchedManual: [] };
    const manualUnimed = procedures.filter(p => p.insurance === 'Unimed');
    const matched: { manual: MedicalProcedure; ai: GlosaReportItem }[] = [];
    const unmatchedManual: MedicalProcedure[] = [];

    manualUnimed.forEach(manual => {
      const foundInAi = glosaReport.find(ai => 
        normalize(ai.patientName).includes(normalize(manual.patientName)) || 
        normalize(manual.patientName).includes(normalize(ai.patientName))
      );
      if (foundInAi) matched.push({ manual, ai: foundInAi });
      else unmatchedManual.push(manual);
    });
    return { matched, unmatchedManual };
  }, [procedures, glosaReport]);

  const resetForm = () => {
    setPatientName('');
    setExamDate('');
    setProcedureName('');
    setTussCode('');
    setProcedureValue('');
    setInsurance('Unimed');
    setPaymentMethod('Dinheiro');
    setEditingId(null);
  };

  const handleAddProcedure = (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientName || !examDate || !procedureName) return;
    const data: Omit<MedicalProcedure, 'id'> = {
      patientName,
      date: examDate.includes('-') ? examDate.split('-').reverse().join('/') : examDate,
      procedureName,
      tussCode,
      insurance,
      paymentMethod: insurance === 'Particular' ? paymentMethod : undefined,
      procedureValue: procedureValue ? parseFloat(procedureValue) : 0,
      status: 'pending',
      receivedStatus: 'nao_recebido'
    };
    if (editingId) {
      const existing = procedures.find(p => p.id === editingId);
      dbService.updateProcedure({ ...existing!, ...data });
    } else {
      dbService.saveProcedure(data);
    }
    resetForm();
    loadData();
    if (editingId) setActiveTab('list');
  };

  const handleEdit = (p: MedicalProcedure) => {
    setEditingId(p.id);
    setPatientName(p.patientName);
    const dateParts = p.date.split('/');
    if (dateParts.length === 3) setExamDate(`${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`);
    else setExamDate(p.date);
    setProcedureName(p.procedureName);
    setTussCode(p.tussCode || '');
    setInsurance(p.insurance);
    setPaymentMethod(p.paymentMethod || 'Dinheiro');
    setProcedureValue(p.procedureValue ? p.procedureValue.toString() : '');
    setActiveTab('register');
  };

  const handleUpdatePayment = (id: string, status: MedicalProcedure['receivedStatus']) => {
    dbService.updateReceivedStatus(id, status);
    loadData();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsAnalyzing(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const report = await analyzePdfForGlosas(base64, file.type);
        setGlosaReport(report);
        report.forEach(item => {
          dbService.updateProcedureStatus(item.patientName, item.date, item.procedure, item.isGlosa ? 'glosa' : 'paid', item.glosaAmount);
        });
        loadData();
        setIsAnalyzing(false);
      };
      reader.readAsDataURL(file);
    } catch (error: any) {
      alert(error.message);
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 font-sans text-[#4A2311]">
      <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex flex-col items-start gap-4">
          <div className="flex flex-col items-start">
             <div className="flex items-center gap-2">
                <span className="text-6xl text-[#E67E22] font-handwriting leading-none">J</span>
                <span className="text-6xl text-[#8B3E2F] font-handwriting leading-none">M</span>
             </div>
             <div className="text-[10px] tracking-[0.25em] text-[#8B3E2F] font-bold uppercase mt-2">Dra. Joelma Morais</div>
          </div>
          <div className="h-1.5 w-24 bg-[#E67E22] rounded-full"></div>
        </div>
        <div className="flex bg-white rounded-2xl shadow-lg p-1.5 border border-[#E67E22]/10 overflow-hidden">
          <button onClick={() => { resetForm(); setActiveTab('register'); }} className={`px-6 py-3 rounded-xl transition-all flex items-center gap-2 font-black text-xs uppercase tracking-widest ${activeTab === 'register' ? 'bg-[#E67E22] text-white shadow-md' : 'text-[#8B3E2F] hover:bg-orange-50'}`}>
            <PlusIcon className="w-5 h-5 stroke-[2.5]" /> {editingId ? 'Editar' : 'Cadastro'}
          </button>
          <button onClick={() => setActiveTab('list')} className={`px-6 py-3 rounded-xl transition-all flex items-center gap-2 font-black text-xs uppercase tracking-widest ${activeTab === 'list' ? 'bg-[#E67E22] text-white shadow-md' : 'text-[#8B3E2F] hover:bg-orange-50'}`}>
            <TableCellsIcon className="w-5 h-5 stroke-[2.5]" /> Registros
          </button>
          <button onClick={() => setActiveTab('analyze')} className={`px-6 py-3 rounded-xl transition-all flex items-center gap-2 font-black text-xs uppercase tracking-widest ${activeTab === 'analyze' ? 'bg-[#E67E22] text-white shadow-md' : 'text-[#8B3E2F] hover:bg-orange-50'}`}>
            <DocumentMagnifyingGlassIcon className="w-5 h-5 stroke-[2.5]" /> Auditoria AI
          </button>
        </div>
      </header>

      <main className="animate-fadeIn">
        {activeTab === 'register' && (
          <div className="bg-white rounded-[2.5rem] shadow-2xl p-12 max-w-3xl mx-auto border-t-[12px] border-[#E67E22] relative overflow-hidden">
            <div className="mb-10 flex items-center gap-5">
              <div className="p-4 bg-orange-100 rounded-3xl text-[#E67E22]">
                {editingId ? <PencilSquareIcon className="w-8 h-8" /> : <PlusIcon className="w-8 h-8 stroke-[2.5]" />}
              </div>
              <div>
                <h2 className="text-3xl font-black text-[#8B3E2F] tracking-tight">{editingId ? 'Editar Atendimento' : 'Novo Atendimento'}</h2>
                <p className="text-gray-400 font-bold text-xs uppercase tracking-widest mt-1">Gestão de Honorários Médicos</p>
              </div>
            </div>
            <form onSubmit={handleAddProcedure} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-[10px] font-black text-[#8B3E2F] mb-2 uppercase tracking-[0.2em] ml-1">Convênio</label>
                  <select value={insurance} onChange={(e) => setInsurance(e.target.value as any)} className="w-full px-6 py-4 rounded-2xl border-2 border-gray-100 bg-gray-50 text-gray-900 font-bold focus:border-[#E67E22] transition-all outline-none">
                    <option value="Unimed">Unimed</option>
                    <option value="Particular">Particular</option>
                    <option value="Publico">Público</option>
                  </select>
                </div>
                <div className={`${insurance === 'Particular' ? '' : 'hidden'}`}>
                  <label className="block text-[10px] font-black text-[#8B3E2F] mb-2 uppercase tracking-[0.2em] ml-1">Pagamento</label>
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as any)} className="w-full px-6 py-4 rounded-2xl border-2 border-gray-100 bg-gray-50 text-gray-900 font-bold focus:border-[#E67E22] transition-all outline-none">
                    <option value="Dinheiro">Dinheiro</option>
                    <option value="Sicredi">Sicredi</option>
                    <option value="Banco do Brasil">Banco do Brasil</option>
                  </select>
                </div>
                <div className={`${insurance === 'Particular' ? '' : 'md:col-span-2'}`}>
                  <label className="block text-[10px] font-black text-[#8B3E2F] mb-2 uppercase tracking-[0.2em] ml-1">Valor do Procedimento</label>
                  <div className="relative">
                    <span className="absolute left-6 top-1/2 -translate-y-1/2 text-[#E67E22] font-black">R$</span>
                    <input type="number" step="0.01" value={procedureValue} onChange={(e) => setProcedureValue(e.target.value)} className="w-full pl-14 pr-6 py-4 rounded-2xl border-2 border-gray-100 bg-gray-50 text-gray-900 font-bold focus:border-[#E67E22] transition-all outline-none" placeholder="0.00" />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-[#8B3E2F] mb-2 uppercase tracking-[0.2em] ml-1">Nome do Paciente</label>
                <input type="text" value={patientName} onChange={(e) => setPatientName(e.target.value)} className="w-full px-6 py-4 rounded-2xl border-2 border-gray-100 bg-gray-50 text-gray-900 font-bold focus:border-[#E67E22] transition-all outline-none" placeholder="Nome completo" required />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-black text-[#8B3E2F] mb-2 uppercase tracking-[0.2em] ml-1">Data</label>
                  <input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} className="w-full px-6 py-4 rounded-2xl border-2 border-gray-100 bg-gray-50 text-gray-900 font-bold focus:border-[#E67E22] transition-all outline-none" required />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-[#8B3E2F] mb-2 uppercase tracking-[0.2em] ml-1">Código TUSS</label>
                  <input type="text" value={tussCode} onChange={(e) => setTussCode(e.target.value)} className="w-full px-6 py-4 rounded-2xl border-2 border-gray-100 bg-gray-50 text-gray-900 font-bold focus:border-[#E67E22] transition-all outline-none" placeholder="Opcional" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-[#8B3E2F] mb-2 uppercase tracking-[0.2em] ml-1">Descrição do Procedimento</label>
                <input type="text" value={procedureName} onChange={(e) => setProcedureName(e.target.value)} className="w-full px-6 py-4 rounded-2xl border-2 border-gray-100 bg-gray-50 text-gray-900 font-bold focus:border-[#E67E22] transition-all outline-none" placeholder="Nome do exame" required />
              </div>
              <button type="submit" className="w-full bg-gradient-to-br from-[#E67E22] to-[#D35400] text-white font-black py-5 rounded-2xl shadow-xl transition-all hover:-translate-y-1 uppercase tracking-widest text-sm flex items-center justify-center gap-3">
                {editingId ? <ArrowPathIcon className="w-5 h-5 stroke-[3]" /> : <CheckCircleIcon className="w-5 h-5 stroke-[3]" />}
                {editingId ? 'Salvar Alterações' : 'Concluir Cadastro'}
              </button>
            </form>
          </div>
        )}

        {activeTab === 'list' && (
          <div className="bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-orange-50">
            <div className="p-10 border-b border-orange-50 flex flex-col md:flex-row justify-between items-center gap-6 bg-gradient-to-r from-white to-orange-50/20">
              <h2 className="text-3xl font-black text-[#8B3E2F] tracking-tight">Atendimentos Registrados</h2>
            </div>
            <div className="px-10 py-6 bg-gray-50/40 border-b border-orange-50/50 flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#8B3E2F]/10 rounded-lg text-[#8B3E2F]"><FunnelIcon className="w-5 h-5" /></div>
                <span className="text-[10px] font-black text-[#8B3E2F] uppercase tracking-widest">Filtrar Período</span>
              </div>
              <div className="flex items-center gap-4 flex-wrap">
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="px-4 py-2 bg-white border border-orange-100 rounded-xl text-xs font-bold text-[#8B3E2F] outline-none" />
                <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">até</span>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="px-4 py-2 bg-white border border-orange-100 rounded-xl text-xs font-bold text-[#8B3E2F] outline-none" />
                {(startDate || endDate) && <button onClick={() => {setStartDate(''); setEndDate('');}} className="flex items-center gap-2 px-4 py-2 text-[#E67E22] font-black uppercase tracking-widest text-[10px]"><BackspaceIcon className="w-4 h-4" /> Limpar</button>}
              </div>
            </div>
            <div className="overflow-x-auto px-4 pb-10">
              <table className="w-full text-left border-separate border-spacing-y-4">
                <thead className="text-[#8B3E2F]/50 text-[9px] uppercase tracking-[0.3em] font-black">
                  <tr><th>Paciente & Data</th><th>Convênio</th><th>Procedimento</th><th>Faturamento</th><th>Pagamento</th><th>Ações</th></tr>
                </thead>
                <tbody>
                  {filteredProcedures.map((p) => (
                    <tr key={p.id} className="group transition-all hover:translate-x-1">
                      <td className="px-6 py-6 bg-gray-50/50 rounded-l-[1.5rem]"><div className="font-black text-[#8B3E2F] text-sm uppercase">{p.patientName}</div><div className="text-[10px] text-gray-400 font-bold mt-1">{p.date}</div></td>
                      <td className="px-6 py-6 bg-gray-50/50"><span className={`inline-block px-3 py-1.5 rounded-xl text-[9px] font-black uppercase ${p.insurance === 'Unimed' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600'}`}>{p.insurance}</span></td>
                      <td className="px-6 py-6 bg-gray-50/50 text-xs font-bold text-[#8B3E2F]">{p.procedureName}</td>
                      <td className="px-6 py-6 bg-gray-50/50 text-right font-black text-[#8B3E2F]">R$ {p.procedureValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                      <td className="px-6 py-6 bg-gray-50/50"><div className="flex justify-center gap-2">
                        <button onClick={() => handleUpdatePayment(p.id, 'recebido')} className={`p-2 rounded-xl transition-all ${p.receivedStatus === 'recebido' ? 'bg-emerald-500 text-white' : 'text-gray-300 hover:text-emerald-500'}`}><CheckCircleIcon className="w-6 h-6"/></button>
                        <button onClick={() => handleUpdatePayment(p.id, 'nao_recebido')} className={`p-2 rounded-xl transition-all ${p.receivedStatus === 'nao_recebido' ? 'bg-rose-500 text-white' : 'text-gray-300 hover:text-rose-500'}`}><XCircleIcon className="w-6 h-6"/></button>
                      </div></td>
                      <td className="px-6 py-6 bg-gray-50/50 rounded-r-[1.5rem] text-center"><button onClick={() => handleEdit(p)} className="p-2 text-gray-400 hover:text-[#E67E22] transition-colors"><PencilSquareIcon className="w-5 h-5"/></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'analyze' && (
          <div className="space-y-12 max-w-6xl mx-auto pb-20">
            <div className="bg-white rounded-[3rem] shadow-2xl p-16 border-4 border-dashed border-orange-100 text-center relative">
              <div className="max-w-md mx-auto relative z-10">
                <div className="mb-10 inline-block p-8 bg-[#E67E22]/10 rounded-[3rem] text-[#E67E22]"><CloudArrowUpIcon className="w-20 h-20" /></div>
                <h2 className="text-4xl font-black text-[#8B3E2F] mb-6 uppercase">Auditoria AI</h2>
                <label className={`block p-14 rounded-[2.5rem] transition-all border-4 bg-white shadow-2xl cursor-pointer ${isAnalyzing ? 'opacity-50 pointer-events-none' : 'hover:border-[#E67E22]'}`}>
                  <input type="file" accept="application/pdf,image/*" onChange={handleFileUpload} className="hidden" disabled={isAnalyzing} />
                  {isAnalyzing ? (
                    <div className="flex flex-col items-center gap-4"><div className="w-12 h-12 border-4 border-[#E67E22] border-t-transparent rounded-full animate-spin" /><span className="text-[#E67E22] font-black uppercase">Analisando...</span></div>
                  ) : (
                    <div className="flex flex-col items-center uppercase"><span className="text-[#8B3E2F] font-black text-2xl">Carregar Extrato</span><span className="text-gray-300 text-[10px] mt-2 tracking-widest">PDF UNIMED</span></div>
                  )}
                </label>
              </div>
            </div>

            {glosaReport.length > 0 && (
              <div className="space-y-16 animate-slideUp">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                  <div className="lg:col-span-5 bg-gradient-to-br from-white to-rose-50/30 rounded-[2.5rem] shadow-2xl p-8 border border-rose-100 flex flex-col items-center text-center">
                    <div className="w-20 h-20 bg-rose-500 rounded-3xl shadow-xl shadow-rose-200 flex items-center justify-center text-white mb-6">
                      <BanknotesIcon className="w-10 h-10" />
                    </div>
                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mb-2">Impacto Financeiro de Glosas</div>
                    <div className="text-5xl font-black text-rose-600 tracking-tight">
                      <span className="text-2xl align-top mr-1">R$</span>
                      {glosaSummary.totalGlosa.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  </div>

                  <div className="lg:col-span-7 bg-white rounded-[2.5rem] shadow-2xl border border-[#E67E22]/20 overflow-hidden">
                    <div className="bg-[#8B3E2F] px-8 py-5 flex items-center gap-4">
                      <UsersIcon className="w-6 h-6 text-[#E67E22]" />
                      <h4 className="text-white font-black text-xs uppercase tracking-widest">Lista de Pacientes com Glosa</h4>
                    </div>
                    <div className="max-h-[220px] overflow-y-auto custom-scrollbar">
                      <table className="w-full text-left">
                        <tbody className="divide-y divide-gray-50">
                          {glosaSummary.uniquePatients.map((patient, idx) => (
                            <tr key={idx} className="hover:bg-orange-50/30 transition-colors">
                              <td className="px-8 py-4 flex items-center gap-4">
                                <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center font-black text-[10px]">{idx + 1}</div>
                                <span className="font-black text-[#8B3E2F] text-xs uppercase">{patient}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <section>
                  <div className="flex items-center gap-3 mb-6 px-4">
                    <MagnifyingGlassCircleIcon className="w-10 h-10 text-emerald-500" />
                    <h3 className="text-2xl font-black text-[#8B3E2F] uppercase tracking-tighter">Conferência Individual</h3>
                  </div>
                  <div className="grid grid-cols-1 gap-6">
                    {crossReferencedData.matched.map((match, idx) => (
                      <div key={idx} className="bg-white rounded-[2rem] shadow-xl overflow-hidden border border-emerald-50 grid grid-cols-1 md:grid-cols-2">
                        <div className="p-8 border-r border-gray-100">
                          <div className="text-[10px] font-black text-gray-400 uppercase mb-4 tracking-widest">Seu Registro</div>
                          <h4 className="text-lg font-black text-[#8B3E2F] uppercase">{match.manual.patientName}</h4>
                          <div className="mt-4"><span className="text-xl font-black text-[#8B3E2F]">R$ {match.manual.procedureValue.toFixed(2)}</span></div>
                        </div>
                        <div className={`p-8 ${match.ai.isGlosa ? 'bg-rose-50/30' : 'bg-emerald-50/30'}`}>
                          <div className="flex justify-between items-start mb-4">
                            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Extrato IA</div>
                            {match.ai.isGlosa ? <span className="bg-rose-500 text-white px-3 py-1 rounded-full text-[9px] font-black uppercase">Glosa</span> : <span className="bg-emerald-500 text-white px-3 py-1 rounded-full text-[9px] font-black uppercase">Pago</span>}
                          </div>
                          <h4 className="text-lg font-black text-gray-900 uppercase">{match.ai.patientName}</h4>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}
          </div>
        )}
      </main>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&display=swap');
        .font-handwriting { font-family: 'Dancing Script', cursive; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #E67E22; border-radius: 10px; }
      `}</style>
    </div>
  );
}
